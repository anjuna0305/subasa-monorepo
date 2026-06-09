
import { VoiceRecorder } from "@/utils/voiceStream";
import { useRef, useState } from "react";

interface VoiceChangeDetector {
  start: () => void;
  pause: () => void;
}

export const useVoiceRecorder = (
  wsUrl: string,
  detector: VoiceChangeDetector,
) => {
  const voiceRef = useRef<VoiceRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const start = async () => {
    voiceRef.current = new VoiceRecorder(wsUrl);
    await voiceRef.current.init();
    voiceRef.current.start();
    detector.start();
    setIsRecording(true);
  };

  const stop = () => {
    voiceRef.current?.stop();
    voiceRef.current = null;
    detector.pause();
    setIsRecording(false);
  };

  const cancel = () => {
    voiceRef.current?.cancel();
    voiceRef.current = null;
    detector.pause();
    setIsRecording(false);
  };

  return { start, stop, cancel, isRecording };
};
