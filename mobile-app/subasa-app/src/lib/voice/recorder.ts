import { AudioQuality, IOSOutputFormat, type RecordingOptions } from 'expo-audio';
import { Platform } from 'react-native';

import { VoiceTuning } from '@/lib/config';

/**
 * The ASR service decodes with libsndfile first and only falls back to ffmpeg, so iOS
 * records 16 kHz mono WAV and skips the transcode entirely. Android's recorder cannot
 * produce WAV, so it sends AAC in an mp4 container and takes the fallback path.
 */
export const recordingOptions: RecordingOptions = {
  isMeteringEnabled: true,
  extension: Platform.OS === 'ios' ? '.wav' : '.m4a',
  sampleRate: 16_000,
  numberOfChannels: 1,
  bitRate: 128_000,
  android: {
    extension: '.m4a',
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
    sampleRate: 16_000,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128_000,
  },
  ios: {
    extension: '.wav',
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    sampleRate: 16_000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
};

export type TurnEndReason = 'speech-ended' | 'no-speech' | 'max-length';

export type SilenceDetector = {
  /** Feed a metering sample. Returns a reason once the turn should end. */
  push(metering: number | undefined, elapsedMs: number): TurnEndReason | null;
};

/**
 * Decides when the user has stopped talking, from the recorder's dBFS metering samples.
 * Pure and synchronous so the thresholds can be reasoned about (and tested) on their own.
 */
export function createSilenceDetector(tuning = VoiceTuning): SilenceDetector {
  let hasSpoken = false;
  let lastVoiceMs = 0;

  return {
    push(metering, elapsedMs) {
      // A missing sample is treated as silence rather than as speech, so a recorder that
      // never reports metering times out instead of recording until the hard cap.
      const level = metering ?? -160;

      if (level > tuning.silenceFloorDb) {
        hasSpoken = true;
        lastVoiceMs = elapsedMs;
      }

      if (elapsedMs >= tuning.maxUtteranceMs) return 'max-length';

      if (!hasSpoken) {
        return elapsedMs >= tuning.noSpeechTimeoutMs ? 'no-speech' : null;
      }

      if (elapsedMs < tuning.minUtteranceMs) return null;

      return elapsedMs - lastVoiceMs >= tuning.silenceHoldMs ? 'speech-ended' : null;
    },
  };
}

/** Maps a dBFS reading onto 0..1 for the level meter in the call UI. */
export function meteringToLevel(metering: number | undefined): number {
  if (metering == null || !Number.isFinite(metering)) return 0;
  const floor = -60;
  const normalized = (metering - floor) / (0 - floor);
  return Math.max(0, Math.min(1, normalized));
}
