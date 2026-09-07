import { Box, IconButton, Typography } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import LiteCard from "./LiteCard";
import InvisibleInput from "./InvisibleInput";
import { Message } from "@/types/message";
import MessageBox from "./MessageBox";
import AudioWaveform, { AudioWaveformHandle } from "./AudioWaveForm";
import { API_ENDPOINTS } from "@/utils/api";
import { useAsrRecorder } from "@/hooks/useAsrRecorder";
import { CustomChatbot } from "@/types/custom-chatbot";
import axiosInstance from "@/api/axios";

interface Props {
  chatbotData: CustomChatbot;
  heroImageUrl: string;
}

type RecordingState = "idle" | "recording" | "processing";

type SendMessageResponse = {
  response: string;
};

const sendCustomMessage = async (
  message: string,
  retrievalKey: string,
): Promise<string> => {
  const res = await axiosInstance.post<SendMessageResponse>(
    API_ENDPOINTS.CUSTOM_CHATBOT_API(retrievalKey),
    { message },
  );
  return res.data.response;
};

// The gateway synthesizes, stores the wav, and returns an absolute URL for it.
const fetchTtsAudioUrl = async (text: string): Promise<string> => {
  const payload = {
    text: text.trim(),
    speaker: "mettananda",
    speaker_type: "single",
    voice: "male",
    input_type: "sinhala",
  };
  const response = await axiosInstance.post<{ audioUrl: string }>(
    API_ENDPOINTS.TTS_GENERATE,
    payload,
  );
  return response.data.audioUrl;
};

export default function CustomChatShell({ chatbotData, heroImageUrl }: Props) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isSending, setIsSending] = useState(false);

  const waveformRef = useRef<AudioWaveformHandle>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const updateMessage = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setMessage(event.target.value);
  };

  const processAndSendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const userMsgId = Date.now();
      const botMsgId = userMsgId + 10;

      setMessages((prev) => [
        ...prev,
        { id: userMsgId, text: trimmed, role: "user" },
        { id: botMsgId, text: "processing...", role: "bot" },
      ]);
      setMessage("");

      try {
        setIsSending(true);
        const botResponse = await sendCustomMessage(
          trimmed,
          chatbotData.url_path,
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId
              ? { ...m, text: botResponse, audioLoading: false }
              : m,
          ),
        );

        // setMessages((prev) => [
        //   ...prev,
        //   {
        //     id: botMsgId,
        //     text: botResponse,
        //     role: "bot",
        //     audioLoading: true,
        //   },
        // ]);

        try {
          const audioUrl = await fetchTtsAudioUrl(botResponse);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botMsgId ? { ...m, audioUrl, audioLoading: false } : m,
            ),
          );
        } catch {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === botMsgId ? { ...m, audioLoading: false } : m,
            ),
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSending(false);
      }
    },
    [chatbotData.url_path],
  );

  // Same VAD + SSE path the ASR page uses, so speech stops on silence and the
  // transcript streams in rather than arriving in one lump.
  const {
    start: startRecording,
    stop: stopRecording,
    isRecording,
    isTranscribing,
  } = useAsrRecorder({
    onTranscript: (transcript) => {
      waveformRef.current?.stop();
      void processAndSendText(transcript);
    },
  });

  const recordingState: RecordingState = isRecording
    ? "recording"
    : isTranscribing
      ? "processing"
      : "idle";

  const handleSend = () => {
    processAndSendText(message);
  };

  const handleMicClick = async () => {
    if (recordingState === "idle") {
      waveformRef.current?.start();
      await startRecording();
    } else if (recordingState === "recording") {
      waveformRef.current?.stop();
      await stopRecording();
    }
  };

  const isInputDisabled =
    isSending ||
    recordingState === "recording" ||
    recordingState === "processing";

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
          <Box
            component="img"
            src={heroImageUrl}
            alt={chatbotData.chatbot_name}
            sx={{
              width: "200px",
              height: "200px",
              objectFit: "cover",
              borderRadius: 2,
              mb: 2,
            }}
          />
          <Typography variant="h4" gutterBottom sx={{ textAlign: "center" }}>
            {chatbotData.chatbot_name}
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ textAlign: "center" }}
          >
            {chatbotData.description}
          </Typography>
        </Box>
      )}

      {messages.length > 0 && (
        <Box
          sx={{
            flexGrow: 1,
            overflowY: "auto",
            p: 2,
            flexDirection: "column",
            gap: 2,
            width: "100%",
            maxWidth: "900px",
          }}
        >
          {messages.map((msg) => (
            <MessageBox messageObject={msg} key={msg.id} />
          ))}
          <div ref={bottomRef} />
        </Box>
      )}

      {recordingState === "processing" && (
        <Box sx={{ width: "100%", maxWidth: "900px", px: 2, mb: 1 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: "center" }}
          >
            Processing...
          </Typography>
        </Box>
      )}

      <LiteCard
        sx={{
          alignItems: "center",
          width: "100%",
          maxWidth: "900px",
          px: 2,
          mb: 2,
        }}
      >
        <InvisibleInput
          fullWidth
          multiline
          maxRows={6}
          value={message}
          onChange={(event) => updateMessage(event)}
          onKeyDown={(event) => {
            if (event.key == "Enter") {
              event.preventDefault();
              handleSend();
            }
          }}
          placeholder="Message..."
          disabled={isInputDisabled}
        />

        <Box
          sx={{
            height: "3rem",
            width: "100%",
            display: "flex",
            flexDirection: "row-reverse",
            alignItems: "center",
          }}
        >
          <Box sx={{ height: "3rem", display: "flex" }}>
            <Box
              sx={{
                width: "100%",
                maxWidth: "900px",
                visibility: recordingState !== "idle" ? "visible" : "hidden",
              }}
            >
              <AudioWaveform ref={waveformRef} height={60} />
            </Box>

            <Box>
              {message === "" && recordingState === "idle" ? (
                <IconButton
                  sx={{ ml: 1 }}
                  color="success"
                  onClick={handleMicClick}
                  disabled={isSending}
                >
                  <MicIcon />
                </IconButton>
              ) : recordingState !== "idle" ? (
                <IconButton
                  color="error"
                  onClick={handleMicClick}
                  disabled={recordingState === "processing"}
                >
                  <StopIcon />
                </IconButton>
              ) : (
                <IconButton
                  color="primary"
                  onClick={handleSend}
                  disabled={isSending}
                >
                  <SendIcon />
                </IconButton>
              )}
            </Box>
          </Box>
        </Box>
      </LiteCard>
    </Box>
  );
}
