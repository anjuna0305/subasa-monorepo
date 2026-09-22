import { useEffect, useRef, useState } from "react";
import { Box, IconButton, Slider, Typography } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";

interface AudioPlayerProps {
  audioData: Blob | ArrayBuffer;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({ audioData }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [audio, setAudio] = useState(null);

  useEffect(() => {
    const blob =
      audioData instanceof ArrayBuffer
        ? new Blob([audioData], { type: "audio/wav" })
        : audioData;

    const url = URL.createObjectURL(blob);
    setObjectUrl(url);

    return () => URL.revokeObjectURL(url); // cleanup
  }, [audioData]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !muted;
    setMuted(!muted);
  };

  const handleSeek = (_: Event, value: number | number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value as number;
    setCurrentTime(value as number);
  };

  const handleVolume = (_: Event, value: number | number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = value as number;
    setVolume(value as number);
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        width: "100%",
        px: 1,
      }}
    >
      {/* hidden native audio element */}
      {objectUrl && (
        <audio
          ref={audioRef}
          src={objectUrl}
          onTimeUpdate={() =>
            setCurrentTime(audioRef.current?.currentTime ?? 0)
          }
          onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Play / Pause */}
      <IconButton onClick={togglePlay} size="small">
        {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
      </IconButton>

      {/* Current time */}
      <Typography variant="caption" sx={{ minWidth: 36 }}>
        {formatTime(currentTime)}
      </Typography>

      {/* Seek bar */}
      <Slider
        size="small"
        min={0}
        max={duration || 1}
        value={currentTime}
        onChange={handleSeek}
        sx={{ flexGrow: 1 }}
      />

      {/* Duration */}
      <Typography variant="caption" sx={{ minWidth: 36 }}>
        {formatTime(duration)}
      </Typography>

      {/* Mute */}
      <IconButton onClick={toggleMute} size="small">
        {muted ? <VolumeOffIcon /> : <VolumeUpIcon />}
      </IconButton>

      {/* Volume slider */}
      <Slider
        size="small"
        min={0}
        max={1}
        step={0.01}
        value={muted ? 0 : volume}
        onChange={handleVolume}
        sx={{ width: 80 }}
      />
    </Box>
  );
}
