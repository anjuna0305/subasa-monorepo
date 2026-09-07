import { useCallback, useRef, useState } from "react";
import { useMicVAD } from "@ricky0123/vad-react";

import { API_ENDPOINTS } from "@/utils/api";
import { encodeWav, transcribeStream } from "@/utils/asrStream";

const VAD_ASSETS = {
  baseAssetPath: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/dist/",
  onnxWASMBasePath: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/",
};

interface Options {
  /** Called once a full utterance has been transcribed. */
  onTranscript?: (transcript: string) => void;
}

/**
 * Mic capture with voice-activity detection, streamed to the ASR service.
 *
 * The VAD hands back a whole utterance as 16 kHz mono Float32 the moment the
 * speaker stops, which is exactly the format the models want, so the audio is
 * wrapped as WAV and posted. Partial tokens arrive over SSE while the model
 * decodes.
 */
export function useAsrRecorder({ onTranscript }: Options = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  // The VAD keeps firing while a previous utterance is still decoding, so the
  // callback reads this rather than closing over stale state.
  const cancelledRef = useRef(false);

  const handleSpeech = useCallback(
    async (audio: Float32Array) => {
      if (cancelledRef.current) return;

      const controller = new AbortController();
      abortRef.current = controller;
      setIsTranscribing(true);
      setPartial("");
      setError(null);

      try {
        const transcript = await transcribeStream(
          API_ENDPOINTS.ASR_TRANSCRIBE_STREAM,
          encodeWav(audio),
          {
            signal: controller.signal,
            onDelta: (_delta, soFar) => setPartial(soFar),
            onError: (message) => setError(message),
          },
        );
        if (!cancelledRef.current && transcript) {
          onTranscript?.(transcript);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError((e as Error).message);
        }
      } finally {
        setIsTranscribing(false);
        setPartial("");
        abortRef.current = null;
      }
    },
    [onTranscript],
  );

  const vad = useMicVAD({
    ...VAD_ASSETS,
    startOnLoad: false,
    onSpeechEnd: handleSpeech,
  });

  const start = useCallback(async () => {
    cancelledRef.current = false;
    setError(null);
    await vad.start();
    setIsRecording(true);
  }, [vad]);

  const stop = useCallback(async () => {
    // pause() flushes the utterance in progress, so the final phrase still
    // reaches onSpeechEnd rather than being dropped.
    await vad.pause();
    setIsRecording(false);
  }, [vad]);

  const cancel = useCallback(async () => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    await vad.pause();
    setIsRecording(false);
    setIsTranscribing(false);
    setPartial("");
  }, [vad]);

  return {
    start,
    stop,
    cancel,
    isRecording,
    isTranscribing,
    partial,
    error,
    isLoading: vad.loading,
    isSpeaking: vad.userSpeaking,
  };
}
