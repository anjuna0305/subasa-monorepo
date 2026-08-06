/**
 * Runtime configuration. Expo inlines `EXPO_PUBLIC_*` variables at build time, so
 * these come from `.env` (see `.env.example`) rather than from a native config.
 */

const trimSlash = (value: string) => value.replace(/\/+$/, '');

export const API_BASE_URL = trimSlash(
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:7010'
);

/**
 * ASR is called exactly as the web client calls it: the deployed route directly, with no
 * API key. The metered gateway proxy (`/api/{service_key}/{path}`) is not finished yet.
 */
export const ASR_TRANSCRIBE_URL =
  process.env.EXPO_PUBLIC_ASR_TRANSCRIBE_URL ?? 'https://subasa.lk/voc-si/api/asr/transcribe';

/** `url_path` of the chatbot this build opens, e.g. `sri-lanka-constitution`. */
export const CHATBOT_URL_PATH = process.env.EXPO_PUBLIC_CHATBOT_PATH ?? '';

/** Voice defaults, matching what the web client sends to `/tts/generate`. */
export const TTS_VOICE = {
  speaker: process.env.EXPO_PUBLIC_TTS_SPEAKER ?? 'mettananda',
  speaker_type: 'single',
  voice: process.env.EXPO_PUBLIC_TTS_VOICE ?? 'male',
  input_type: 'sinhala',
} as const;

/**
 * Streamed synthesis starts playing after the first sentence instead of waiting for the
 * whole reply. Set EXPO_PUBLIC_TTS_STREAMING=false to fall back to the file-based
 * `/tts/generate` route if a device's player struggles with a chunked wav.
 */
export const TTS_STREAMING = (process.env.EXPO_PUBLIC_TTS_STREAMING ?? 'true') !== 'false';

export const RequestTimeouts = {
  /** Chatbot replies and speech synthesis are both slow paths. */
  default: 20_000,
  transcribe: 60_000,
  chat: 90_000,
  tts: 90_000,
} as const;

/**
 * End-of-turn detection. `metering` is reported in dBFS, so silence sits near -160 and
 * speech peaks well above the floor. These are starting points — they need tuning on a
 * real device in the room the app will actually be used in.
 */
export const VoiceTuning = {
  /** How often the recorder status is polled while listening. */
  meteringIntervalMs: 150,
  /** Levels below this count as silence. */
  silenceFloorDb: -38,
  /** Silence this long after speech ends the turn. */
  silenceHoldMs: 1_200,
  /** Utterances shorter than this can't end a turn, so a cough doesn't trigger one. */
  minUtteranceMs: 600,
  /** Give up listening if the user never says anything. */
  noSpeechTimeoutMs: 10_000,
  /** Hard cap on a single turn. */
  maxUtteranceMs: 30_000,
} as const;
