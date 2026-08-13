const trimSlash = (value: string) => value.replace(/\/+$/, "");

export const API_BASE_URL = trimSlash(
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:7010",
);
export const ASR_TRANSCRIBE_URL =
  process.env.EXPO_PUBLIC_ASR_TRANSCRIBE_URL ??
  "https://subasa.lk/voc-si/api/asr/transcribe";

export const CHATBOT_URL_PATH = process.env.EXPO_PUBLIC_CHATBOT_PATH ?? "";

export const TTS_VOICE = {
  speaker: process.env.EXPO_PUBLIC_TTS_SPEAKER ?? "mettananda",
  speaker_type: "single",
  voice: process.env.EXPO_PUBLIC_TTS_VOICE ?? "male",
  input_type: "sinhala",
} as const;

export const TTS_STREAMING =
  (process.env.EXPO_PUBLIC_TTS_STREAMING ?? "true") !== "false";

export const RequestTimeouts = {
  default: 20_000,
  transcribe: 60_000,
  chat: 90_000,
  tts: 90_000,
} as const;

export const VoiceTuning = {
  meteringIntervalMs: 150,
  silenceFloorDb: -38,
  silenceHoldMs: 1_200,
  minUtteranceMs: 600,
  noSpeechTimeoutMs: 10_000,
  maxUtteranceMs: 30_000,
} as const;
