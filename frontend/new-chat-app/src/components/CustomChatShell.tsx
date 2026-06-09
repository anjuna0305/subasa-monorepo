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
import { CustomChatbot } from "@/types/custom-chatbot";
import { reencodeAudio } from "@/utils/audio";
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

const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  const formData = new FormData();
  formData.append("file", audioBlob, "audio.wav");
  const response = await axiosInstance.post<{ transcription: string }>(
    API_ENDPOINTS.ASR_TRANSCRIBE,
    formData,
    { withCredentials: false },
  );
  return response.data.transcription;
};

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
    { withCredentials: false },
  );
  return `${API_ENDPOINTS.TTS_GENERATE.replace("/voicebot-generate-audio", "")}${response.data.audioUrl}?t=${Date.now()}`;
};

export default function CustomChatShell({ chatbotData, heroImageUrl }: Props) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const waveformRef = useRef<AudioWaveformHandle>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  const handleSend = () => {
    processAndSendText(message);
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.start();
      waveformRef.current?.start();
      setRecordingState("recording");
    } catch (err) {
      console.error("Microphone access error:", err);
    }
  };

  const handleStopRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;

    setRecordingState("processing");
    waveformRef.current?.stop();

    const pendingChunks = [...audioChunksRef.current];

    await new Promise<void>((resolve) => {
      recorder.onstop = () => {
        resolve();
      };
      recorder.stop();
    });

    const combinedChunks = [...pendingChunks, ...audioChunksRef.current];
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    const audioBlob = new Blob(combinedChunks, { type: "audio/webm" });

    try {
      const wavBlob = await reencodeAudio(audioBlob);
      const transcription = await transcribeAudio(wavBlob);
      if (transcription.trim()) {
        processAndSendText(transcription);
      }
    } catch (err) {
      console.error("ASR error:", err);
    } finally {
      setRecordingState("idle");
    }
  };

  const handleMicClick = () => {
    if (recordingState === "idle") {
      handleStartRecording();
    } else if (recordingState === "recording") {
      handleStopRecording();
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
