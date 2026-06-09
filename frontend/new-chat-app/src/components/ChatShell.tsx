
import { Box, Button } from "@mui/material";
import IconButton from "@mui/material/IconButton";
import SendIcon from "@mui/icons-material/Send";
import { ChangeEvent, ReactNode, useEffect, useRef, useState } from "react";
import { Typography } from "@mui/material";
import LiteCard from "./LiteCard";
import InvisibleInput from "./InvisibleInput";
import { Message } from "@/types/message";
import { VoiceChat } from "@mui/icons-material";
import MessageBox from "./MessageBox";
import { API_ENDPOINTS } from "@/utils/api";
import axiosInstance from "@/api/axios";

interface Props {
  heading?: ReactNode;
}

type ChatResponse = {
  response: string;
};

const sendMessage = async (message: string): Promise<string> => {
  const response = await axiosInstance.post<ChatResponse>(
    API_ENDPOINTS.CHATBOT_CHAT,
    { message },
  );
  return response.data.response;
};

export default function ChatShell({ heading }: Props) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingAllowed, setTypingAllowed] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isSending, setIsSending] = useState<boolean>(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const updateMessage = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement, Element>,
  ) => {
    console.log("value is updated.");
    setMessage(event.target.value);
  };

  const handleSend = async () => {
    setIsSending(true);
    const sendingMessage = message.trim();
    if (!sendingMessage) return;
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), text: sendingMessage, role: "user" },
    ]);
    setMessage("");

    try {
      const response = await sendMessage(sendingMessage);
      if (response) displayResponse(response);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const displayResponse = (response: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        text: response,
        role: "bot",
      },
    ]);
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
      {/*TODO add a rate limiter*/}
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

      {/* messages area */}
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

      {/*text box part*/}
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
          disabled={!typingAllowed}
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
          {/* send icon */}
          <Box sx={{ height: "3rem", display: "flex" }}>
            {message === "" ? (
              <IconButton sx={{ ml: 1 }} color="primary" onClick={handleSend}>
                <VoiceChat />
              </IconButton>
            ) : (
              <IconButton
                color="primary"
                onClick={handleSend}
                disabled={isSending ? true : false}
              >
                <SendIcon />
              </IconButton>
            )}
          </Box>
        </Box>
      </LiteCard>
    </Box>
  );
}
