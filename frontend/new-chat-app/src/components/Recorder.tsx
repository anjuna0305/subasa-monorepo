
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { Box, Button, Typography } from "@mui/material";
import { useMicVAD } from "@ricky0123/vad-react";
import { API_ENDPOINTS } from "@/utils/api";

export default function Recorder() {
  // custom webhook to stream audio while recording.
  // not the most efficient way to do this, but there are no other way i found.
  const { start, stop, cancel, isRecording } = useVoiceRecorder(
    API_ENDPOINTS.ASR_WS,
    useMicVAD({
      baseAssetPath: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/dist/",
      onnxWASMBasePath: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/",
      onSpeechEnd: (audio) => {
        handleStop();
      },
      startOnLoad: false,
    }),
  );

  // speech detector.

  const handleStop = () => {
    stop();
  };

  const handleStart = () => {
    start();
  };

  const handleCancel = () => {
    cancel();
  };

  return (
    <Box
      sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}
    >
      <Typography variant="h1">
        {isRecording ? "recording" : "not recording"}
      </Typography>

      <Button onClick={handleStart} variant="contained">
        start recording
      </Button>
      <Button onClick={handleStop} variant="contained" color="secondary">
        stop recording
      </Button>
      <Button onClick={handleCancel} variant="contained" color="error">
        cancel recording
      </Button>
    </Box>
  );
}
