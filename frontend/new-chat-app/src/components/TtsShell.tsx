import {
  Alert,
  Box,
  CircularProgress,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import { ChangeEvent, ReactNode, useState } from "react";

import LiteCard from "./LiteCard";
import InvisibleInput from "./InvisibleInput";
import ColorBgButton from "./ColorBgButton";
import {
  DEFAULT_TTS_VOICE,
  generateTtsAudio,
  TTS_VOICES,
  TtsVoiceOption,
} from "@/api/tts";

interface Props {
  heading?: ReactNode;
}

const MAX_CHARS = 2000;

export default function TtsShell({ heading }: Props) {
  const [text, setText] = useState("");
  const [option, setOption] = useState<TtsVoiceOption>(DEFAULT_TTS_VOICE);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = text.trim().length > 0 && !isGenerating;

  const updateText = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setText(event.target.value.slice(0, MAX_CHARS));
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setError(null);
    try {
      // Replacing the URL is enough to reload the player; the previous file
      // stays on the gateway, which serves it from disk.
      setAudioUrl(await generateTtsAudio(text, option));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "කථනය ජනනය කිරීමට නොහැකි විය.",
      );
      setAudioUrl(null);
    } finally {
      setIsGenerating(false);
    }
  };

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
      {!audioUrl && (
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

      {audioUrl && (
        <Box sx={{ width: "100%", maxWidth: "900px", pb: 2 }}>
          {/* keyed on the URL so a new synthesis resets playback position */}
          <audio key={audioUrl} controls src={audioUrl} style={{ width: "100%" }}>
            <track kind="captions" />
          </audio>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ width: "100%", maxWidth: "900px", mb: 2 }}>
          {error}
        </Alert>
      )}

      <LiteCard
        sx={{
          alignItems: "center",
          width: "100%",
          maxWidth: "900px",
          px: 2,
        }}
      >
        <InvisibleInput
          fullWidth
          multiline
          maxRows={8}
          value={text}
          onChange={updateText}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void handleGenerate();
            }
          }}
          placeholder="කථනයට හැරවීමට පෙළ ඇතුළත් කරන්න..."
          disabled={isGenerating}
        />

        <Box
          sx={{
            minHeight: "3rem",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Select
              size="small"
              value={option.id}
              onChange={(event) => {
                const found = TTS_VOICES.find((v) => v.id === event.target.value);
                if (found) setOption(found);
              }}
              disabled={isGenerating}
            >
              {TTS_VOICES.map((voice) => (
                <MenuItem key={voice.id} value={voice.id}>
                  {voice.label}
                </MenuItem>
              ))}
            </Select>
            <Typography variant="caption" color="text.secondary">
              {text.length}/{MAX_CHARS}
            </Typography>
          </Box>

          <ColorBgButton onClick={handleGenerate} disabled={!canGenerate}>
            {isGenerating ? (
              <CircularProgress size={18} sx={{ mr: 1 }} />
            ) : null}
            කථනයට හරවන්න
          </ColorBgButton>
        </Box>
      </LiteCard>
    </Box>
  );
}
