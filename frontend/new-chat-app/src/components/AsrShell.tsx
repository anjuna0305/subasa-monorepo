
import { Box, CircularProgress, Typography } from "@mui/material";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import TextDisplayBox from "./TextDisplayBox";
import ColorBgIconButton from "./ColorBgIconButton";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { Mic } from "@mui/icons-material";
import CloseIcon from "@mui/icons-material/Close";
import StopIcon from "@mui/icons-material/Stop";
import { useAsrRecorder } from "@/hooks/useAsrRecorder";
import AudioWaveform, { AudioWaveformHandle } from "./AudioWaveForm";

interface Props {
  heading?: ReactNode;
}

export default function AsrShell({ heading }: Props) {
  const audioWaveRef = useRef<AudioWaveformHandle>(null);
  const [copied, setCopied] = useState(false);
  // Finalised utterances accumulate; the in-flight one is shown separately.
  const [transcript, setTranscript] = useState("");

  const appendTranscript = useCallback((utterance: string) => {
    setTranscript((prev) => (prev ? `${prev} ${utterance}` : utterance));
  }, []);

  const {
    start,
    stop,
    cancel,
    isRecording,
    isTranscribing,
    partial,
    error,
    isLoading,
  } = useAsrRecorder({ onTranscript: appendTranscript });

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, partial]);

  const handleStartRecording = async () => {
    audioWaveRef.current?.start();
    await start();
  };

  const handleStopRecording = async () => {
    audioWaveRef.current?.stop();
    await stop();
  };

  const handleCancelRecording = async () => {
    audioWaveRef.current?.stop();
    await cancel();
  };

  const handleCopyToClipBoard = async () => {
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasContent = Boolean(transcript || partial);

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        flexGrow: 1,
        height: "100%",
        width: "100%",
        px: 2,
        mx: "auto",
      }}
    >
      {/* headed area */}
      {!hasContent && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            paddingBottom: 3,
            alignItems: "center",
            width: "100%",
            maxWidth: "900px",
            px: 2,
          }}
        >
          {heading}
        </Box>
      )}

      <Box
        sx={{
          pb: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
        }}
      >
        <Box>
          <AudioWaveform ref={audioWaveRef} />
        </Box>
        <Box sx={{ width: "110px", display: "flex", alignItems: "center" }}>
          {!isRecording ? (
            <ColorBgIconButton
              tooltip={isLoading ? "Loading speech model" : "Start recording"}
              onClick={handleStartRecording}
              disabled={isLoading}
            >
              {isLoading ? <CircularProgress size={20} /> : <Mic />}
            </ColorBgIconButton>
          ) : (
            <Box sx={{ display: "flex" }}>
              <ColorBgIconButton
                tooltip="Stop recording"
                onClick={handleStopRecording}
              >
                <StopIcon />
              </ColorBgIconButton>
              <ColorBgIconButton
                tooltip="Cancel recording"
                onClick={handleCancelRecording}
              >
                <CloseIcon />
              </ColorBgIconButton>
            </Box>
          )}
        </Box>
      </Box>

      {/*text box part*/}
      <TextDisplayBox
        // paddingBottom={5}
        sx={{
          alignItems: "center",
          width: "100%",
          maxWidth: "900px",
          height: "250px",
          px: 2,
          position: "relative",
        }}
      >
        <Box
          sx={{
            overflowY: "auto",
            height: "100%",
            width: "100%",
            scrollbarWidth: "none", // Firefox
            "&::-webkit-scrollbar": {
              display: "none", // Chrome, Safari, Edge
            },
          }}
        >
          <Typography
            sx={{
              whiteSpace: "pre-wrap",
              color: hasContent ? "text.primary" : "text.secondary",
            }}
          >
            {hasContent ? (
              <>
                {transcript}
                {/* the utterance still decoding is dimmed until it finalises */}
                {partial && (
                  <Typography component="span" sx={{ opacity: 0.55 }}>
                    {transcript ? " " : ""}
                    {partial}
                  </Typography>
                )}
              </>
            ) : isRecording ? (
              "අසමින් සිටී..."
            ) : (
              "පටිගත කිරීම ආරම්භ කිරීමට මයික්‍රොෆෝනය ඔබන්න."
            )}
          </Typography>
          {error && (
            <Typography sx={{ mt: 1 }} color="error" variant="body2">
              {error}
            </Typography>
          )}
          <div ref={bottomRef} />
        </Box>
        {isTranscribing && (
          <Box sx={{ position: "absolute", bottom: "12px", left: "12px" }}>
            <CircularProgress size={16} />
          </Box>
        )}
        {hasContent && (
          <Box sx={{ position: "absolute", bottom: "8px", right: "8px" }}>
            <ColorBgIconButton
              tooltip={copied ? "Copied" : "Copy to clipboard"}
              onClick={handleCopyToClipBoard}
            >
              <ContentCopyIcon />
            </ColorBgIconButton>
          </Box>
        )}
      </TextDisplayBox>
    </Box>
  );
}
