
import { Box, Button, Tooltip, Typography } from "@mui/material";
import { ChangeEvent, ReactNode, useEffect, useRef, useState } from "react";
import { Message } from "@/types/message";
import TextDisplayBox from "./TextDisplayBox";
import ColorBgIconButton from "./ColorBgIconButton";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import MicIcon from "@mui/icons-material/Mic";
import { HideImage, Mic } from "@mui/icons-material";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useCustomMicVAD } from "@/hooks/useCustomMicVad";
import { API_ENDPOINTS } from "@/utils/api";
import { useMicVAD } from "@ricky0123/vad-react";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";
import Waveform2 from "./WaveForm2";
import AudioWaveform, { AudioWaveformHandle } from "./AudioWaveForm";

interface Props {
  heading?: ReactNode;
}

export default function AsrShell({ heading }: Props) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const audioWaveRef = useRef<AudioWaveformHandle>(null);

  const { start, stop, cancel, isRecording } = useVoiceRecorder(
    API_ENDPOINTS.ASR_WS,
    useMicVAD({
      baseAssetPath: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/dist/",
      onnxWASMBasePath: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/",
      onSpeechEnd: (audio) => {
        handleSendRecording();
      },
      startOnLoad: false,
    }),
  );

  const handleSendRecording = () => {
    audioWaveRef.current?.stop();
    stop();
  };

  const handleStartRecording = () => {
    audioWaveRef.current?.start();
    start();
  };

  const handleCancelRecording = () => {
    audioWaveRef.current?.stop();
    cancel();
  };

  const [copied, setCopied] = useState<boolean>(false);
  const [responseMessage, setResponseMessage] = useState<string>(`
    ඇමෙරිකාව සහ ඉරානය අතර තීරණාත්මක සාම සාකච්ඡා අද (10) පාකිස්තානයේ
    මැදිහත් වීමෙන්, පාකිස්තානයේ ඉස්ලාමාබාද් අගනුවරදී පැවැත්වෙයි. සාම
    සාකච්ඡා හේතුවෙන්, ඉස්ලාමාබාද් අගනුවරට විශේෂ ආරක්ෂාවක් යොදා ඇත. විශේෂ
    ද පැවැසෙයි. හෝටලයට ඉහළින් ගුවන් කලාපය ද වසා දමා ඇත.
  `);
  const [typingAllowed, setTypingAllowed] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const updateMessage = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement, Element>,
  ) => {
    console.log("value is updated.");
    setMessage(event.target.value);
  };

  const handleCopyToClipBoard = async () => {
    await navigator.clipboard.writeText(responseMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = () => {
    if (!message.trim()) return;
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), text: message, role: "user" },
      {
        id: Date.now() + 2,
        text: "this is the message from bot mf",
        role: "bot",
      },
    ]);
    setMessage("");
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
      {/* headed area */}
      {messages.length == 0 && (
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
        <Box sx={{ width: "80px" }}>
          {!isRecording ? (
            <Box>
              <ColorBgIconButton
                tooltip="Start recording"
                onClick={handleStartRecording}
              >
                <Mic />
              </ColorBgIconButton>
            </Box>
          ) : (
            <Box>
              <ColorBgIconButton
                tooltip="Cancel the recoring"
                onClick={handleCancelRecording}
              >
                <CloseIcon />
              </ColorBgIconButton>
              <ColorBgIconButton
                tooltip="Send the recording"
                onClick={handleSendRecording}
              >
                <SendIcon />
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
          <Typography sx={{ height: "100%" }}>{responseMessage}</Typography>
        </Box>
        <Box sx={{ position: "absolute", bottom: "8px", right: "8px" }}>
          <ColorBgIconButton
            tooltip={copied ? "Copied" : "Copy to clipboard"}
            onClick={handleCopyToClipBoard}
          >
            <ContentCopyIcon />
          </ColorBgIconButton>
        </Box>
      </TextDisplayBox>
    </Box>
  );
}
