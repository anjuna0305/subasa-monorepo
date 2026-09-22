import axiosInstance from "@/api/axios";
import { API_ENDPOINTS } from "@/utils/api";

export interface TtsRequest {
  text: string;
  speaker: string;
  speaker_type: "single" | "multi";
  voice: "male" | "female";
  input_type: "sinhala" | "romanized";
}

export interface TtsVoiceOption {
  id: string;
  label: string;
  speaker: string;
  speaker_type: "single" | "multi";
  voice: "male" | "female";
  input_type: "sinhala" | "romanized";
}

/**
 * The six checkpoints the TTS service loads, keyed the same way it keys them:
 * `${speaker_type}_${voice}_${input_type}`. There is no multi-speaker
 * romanized model, which is why that pair is absent.
 */
export const TTS_VOICES: TtsVoiceOption[] = [
  {
    id: "single_male_sinhala",
    label: "මෙත්තානන්ද (පිරිමි, සිංහල)",
    speaker: "mettananda",
    speaker_type: "single",
    voice: "male",
    input_type: "sinhala",
  },
  {
    id: "single_female_sinhala",
    label: "ඔෂධි (ගැහැනු, සිංහල)",
    speaker: "oshadi",
    speaker_type: "single",
    voice: "female",
    input_type: "sinhala",
  },
  {
    id: "multi_male_sinhala",
    label: "බහු කථික (පිරිමි, සිංහල)",
    speaker: "mettananda",
    speaker_type: "multi",
    voice: "male",
    input_type: "sinhala",
  },
  {
    id: "multi_female_sinhala",
    label: "බහු කථික (ගැහැනු, සිංහල)",
    speaker: "oshadi",
    speaker_type: "multi",
    voice: "female",
    input_type: "sinhala",
  },
  {
    id: "single_male_romanized",
    label: "Mettananda (male, romanized)",
    speaker: "mettananda",
    speaker_type: "single",
    voice: "male",
    input_type: "romanized",
  },
  {
    id: "single_female_romanized",
    label: "Oshadi (female, romanized)",
    speaker: "oshadi",
    speaker_type: "single",
    voice: "female",
    input_type: "romanized",
  },
];

export const DEFAULT_TTS_VOICE = TTS_VOICES[0];

/**
 * The gateway synthesizes, stores the wav and hands back an absolute URL, so
 * the caller can drop the result straight into an <audio> element.
 */
export async function generateTtsAudio(
  text: string,
  option: TtsVoiceOption = DEFAULT_TTS_VOICE,
): Promise<string> {
  const payload: TtsRequest = {
    text: text.trim(),
    speaker: option.speaker,
    speaker_type: option.speaker_type,
    voice: option.voice,
    input_type: option.input_type,
  };
  const response = await axiosInstance.post<{ audioUrl: string }>(
    API_ENDPOINTS.TTS_GENERATE,
    payload,
  );
  return response.data.audioUrl;
}
