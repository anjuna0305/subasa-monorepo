"use strict";
/**
 * Runtime configuration. Expo inlines `EXPO_PUBLIC_*` variables at build time, so
 * these come from `.env` (see `.env.example`) rather than from a native config.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceTuning = exports.RequestTimeouts = exports.TTS_STREAMING = exports.TTS_VOICE = exports.CHATBOT_URL_PATH = exports.ASR_TRANSCRIBE_URL = exports.API_BASE_URL = void 0;
const trimSlash = (value) => value.replace(/\/+$/, '');
exports.API_BASE_URL = trimSlash(process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:7010');
/**
 * ASR is called exactly as the web client calls it: the deployed route directly, with no
 * API key. The metered gateway proxy (`/api/{service_key}/{path}`) is not finished yet.
 */
exports.ASR_TRANSCRIBE_URL = process.env.EXPO_PUBLIC_ASR_TRANSCRIBE_URL ?? 'https://subasa.lk/voc-si/api/asr/transcribe';
/** `url_path` of the chatbot this build opens, e.g. `sri-lanka-constitution`. */
exports.CHATBOT_URL_PATH = process.env.EXPO_PUBLIC_CHATBOT_PATH ?? '';
/** Voice defaults, matching what the web client sends to `/tts/generate`. */
exports.TTS_VOICE = {
    speaker: process.env.EXPO_PUBLIC_TTS_SPEAKER ?? 'mettananda',
    speaker_type: 'single',
    voice: process.env.EXPO_PUBLIC_TTS_VOICE ?? 'male',
    input_type: 'sinhala',
};
/**
 * Streamed synthesis starts playing after the first sentence instead of waiting for the
 * whole reply. Set EXPO_PUBLIC_TTS_STREAMING=false to fall back to the file-based
 * `/tts/generate` route if a device's player struggles with a chunked wav.
 */
exports.TTS_STREAMING = (process.env.EXPO_PUBLIC_TTS_STREAMING ?? 'true') !== 'false';
exports.RequestTimeouts = {
    /** Chatbot replies and speech synthesis are both slow paths. */
    default: 20000,
    transcribe: 60000,
    chat: 90000,
    tts: 90000,
};
/**
 * End-of-turn detection. `metering` is reported in dBFS, so silence sits near -160 and
 * speech peaks well above the floor. These are starting points — they need tuning on a
 * real device in the room the app will actually be used in.
 */
exports.VoiceTuning = {
    /** How often the recorder status is polled while listening. */
    meteringIntervalMs: 150,
    /** Levels below this count as silence. */
    silenceFloorDb: -38,
    /** Silence this long after speech ends the turn. */
    silenceHoldMs: 1200,
    /** Utterances shorter than this can't end a turn, so a cough doesn't trigger one. */
    minUtteranceMs: 600,
    /** Give up listening if the user never says anything. */
    noSpeechTimeoutMs: 10000,
    /** Hard cap on a single turn. */
    maxUtteranceMs: 30000,
};
