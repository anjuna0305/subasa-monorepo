import { Message } from "@/types/message";
import { Box, Typography, IconButton, CircularProgress } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";
import { useRef, useState, useCallback, useEffect } from "react";

interface Props {
  messageObject: Message;
}

export default function MessageBox({ messageObject }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayStop = useCallback(() => {
    if (!messageObject.audioUrl) return;

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      return;
    }

    const audio = new Audio(messageObject.audioUrl);
    audioRef.current = audio;

    audio.onplaying = () => setIsPlaying(true);
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);
    audio.play().catch(() => setIsPlaying(false));
  }, [messageObject.audioUrl, isPlaying]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const isUser = messageObject.role === "user";

  return (
    <Box
      key={messageObject.id}
      sx={{
        py: 1.5,
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        alignItems: "flex-start",
        gap: 1,
      }}
    >
      {!isUser && (
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            bgcolor: "primary.main",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            mt: 0.5,
          }}
        >
          <SmartToyIcon sx={{ fontSize: 16 }} />
        </Box>
      )}

      <Box
        sx={{
          maxWidth: "75%",
          px: 2,
          py: 1.25,
          borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          bgcolor: isUser
            ? "primary.main"
            : "background.paper",
          color: isUser ? "white" : "text.primary",
          border: isUser ? "none" : "1px solid",
          borderColor: isUser ? "transparent" : "divider",
          boxShadow: isUser
            ? "0 1px 4px rgba(37,99,235,0.25)"
            : "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <Typography sx={{ fontSize: "0.9375rem", lineHeight: 1.55 }}>
          {messageObject.text}
        </Typography>
        {messageObject.role === "bot" && messageObject.audioLoading && (
          <Box sx={{ mt: 0.5, display: "flex", alignItems: "center" }}>
            <CircularProgress size={16} sx={{ color: "primary.main" }} />
          </Box>
        )}
        {messageObject.role === "bot" &&
          messageObject.audioUrl &&
          !messageObject.audioLoading && (
            <Box sx={{ mt: 0.5 }}>
              <IconButton
                size="small"
                onClick={handlePlayStop}
                sx={{
                  color: "primary.main",
                  "&:hover": { bgcolor: "primary.light", color: "white" },
                }}
              >
                {isPlaying ? <StopIcon /> : <PlayArrowIcon />}
              </IconButton>
            </Box>
          )}
      </Box>

      {isUser && (
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            bgcolor: "secondary.main",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            mt: 0.5,
          }}
        >
          <PersonIcon sx={{ fontSize: 16 }} />
        </Box>
      )}
    </Box>
  );
}