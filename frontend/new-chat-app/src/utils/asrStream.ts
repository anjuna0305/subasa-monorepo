// Speech goes to the ASR service as a 16 kHz mono WAV and comes back as an SSE
// stream of partial tokens. This replaces an earlier WebSocket client that
// talked to a server which never existed in this repo.

export type AsrStreamEvent =
  | { delta: string }
  | { transcription: string; done: true }
  | { error: string };

export interface TranscribeHandlers {
  onDelta?: (delta: string, soFar: string) => void;
  onDone?: (transcript: string) => void;
  onError?: (message: string) => void;
  signal?: AbortSignal;
}

/**
 * Wrap Float32 PCM in a 16-bit WAV container.
 *
 * The VAD hands us exactly this: mono Float32 at 16 kHz, which is also what the
 * ASR models expect, so no resampling is needed. It has to be a real container
 * because the service decodes with libsndfile, which cannot read raw webm/opus
 * from MediaRecorder.
 */
export function encodeWav(pcm: Float32Array, sampleRate = 16000): Blob {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + pcm.length * bytesPerSample);
  const view = new DataView(buffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  const dataBytes = pcm.length * bytesPerSample;
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // format: PCM
  view.setUint16(22, 1, true); // channels: mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < pcm.length; i++) {
    const sample = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function parseEvent(raw: string): AsrStreamEvent | null {
  const line = raw.split("\n").find((l) => l.startsWith("data:"));
  if (!line) return null;
  try {
    return JSON.parse(line.slice(5).trim()) as AsrStreamEvent;
  } catch {
    return null;
  }
}

/**
 * POST audio and read the SSE response, calling back per token.
 *
 * EventSource cannot be used here because it only issues GET and cannot carry
 * an audio body, so the stream is read off fetch's response body directly.
 */
export async function transcribeStream(
  url: string,
  audio: Blob,
  handlers: TranscribeHandlers = {},
): Promise<string> {
  const form = new FormData();
  form.append("file", audio, "speech.wav");

  const response = await fetch(url, {
    method: "POST",
    body: form,
    signal: handlers.signal,
  });

  if (!response.ok || !response.body) {
    const message = `Transcription failed (${response.status})`;
    handlers.onError?.(message);
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  let transcript = "";
  let final: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffered += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line; the last chunk may be partial.
    const frames = buffered.split("\n\n");
    buffered = frames.pop() ?? "";

    for (const frame of frames) {
      const event = parseEvent(frame);
      if (!event) continue;

      if ("error" in event) {
        handlers.onError?.(event.error);
        throw new Error(event.error);
      }
      if ("delta" in event) {
        transcript += event.delta;
        handlers.onDelta?.(event.delta, transcript);
      }
      if ("transcription" in event) {
        final = event.transcription;
      }
    }
  }

  const result = (final ?? transcript).trim();
  handlers.onDone?.(result);
  return result;
}
