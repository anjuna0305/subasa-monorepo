/*
 * k6 load test for the two inference services.
 *
 * Deliberately low VU counts: ASR and TTS hold the model in a single process
 * and synthesise on the request thread, so concurrency past a handful queues
 * rather than parallelises. The point is to find where that queue forms.
 *
 *   k6 run -e ASR_URL=http://localhost:7000 -e TTS_URL=http://localhost:7002 \
 *          loadtests/asr_tts.js
 */

import http from "k6/http";
import { check } from "k6";
import { Trend } from "k6/metrics";

const ASR_URL = __ENV.ASR_URL || "http://localhost:7000";
const TTS_URL = __ENV.TTS_URL || "http://localhost:7002";

const asrLatency = new Trend("asr_latency", true);
const ttsLatency = new Trend("tts_latency", true);

export const options = {
  scenarios: {
    asr: {
      executor: "constant-vus",
      vus: Number(__ENV.ASR_VUS || 3),
      duration: __ENV.DURATION || "2m",
      exec: "transcribe",
    },
    tts: {
      executor: "constant-vus",
      vus: Number(__ENV.TTS_VUS || 3),
      duration: __ENV.DURATION || "2m",
      exec: "synthesize",
      startTime: "5s",
    },
  },
  thresholds: {
    // Baselines, not targets — record what you actually measure in the README.
    asr_latency: ["p(95)<20000"],
    tts_latency: ["p(95)<20000"],
    http_req_failed: ["rate<0.05"],
  },
};

// A one-second 16 kHz mono WAV, built once per VU rather than per iteration.
function makeWav(seconds = 1.0, freq = 220) {
  const sampleRate = 16000;
  const frames = Math.floor(sampleRate * seconds);
  const buffer = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(buffer);

  const writeString = (offset, text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + frames * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, frames * 2, true);

  for (let i = 0; i < frames; i++) {
    const sample = 0.2 * Math.sin((2 * Math.PI * freq * i) / sampleRate);
    view.setInt16(44 + i * 2, sample * 32767, true);
  }
  return buffer;
}

const wav = makeWav();

export function transcribe() {
  const response = http.post(`${ASR_URL}/transcribe`, {
    file: http.file(wav, "speech.wav", "audio/wav"),
  });
  asrLatency.add(response.timings.duration);
  check(response, { "asr ok": (r) => r.status === 200 });
}

export function synthesize() {
  const response = http.post(
    `${TTS_URL}/generate`,
    JSON.stringify({
      text: "ආයුබෝවන්. මෙය පරීක්ෂණ වාක්‍යයකි.",
      speaker: "mettananda",
      speaker_type: "single",
      voice: "male",
      input_type: "sinhala",
    }),
    { headers: { "Content-Type": "application/json" } },
  );
  ttsLatency.add(response.timings.duration);
  check(response, { "tts ok": (r) => r.status === 200 });
}
