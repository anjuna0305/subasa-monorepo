
import { Box, SelectChangeEvent } from "@mui/material";
import IconButton from "@mui/material/IconButton";
import SendIcon from "@mui/icons-material/Send";
import { ChangeEvent, ReactNode, useEffect, useRef, useState } from "react";
import { Typography } from "@mui/material";
import LiteCard from "./LiteCard";
import InvisibleInput from "./InvisibleInput";
import { Message } from "@/types/message";
import { VoiceChat } from "@mui/icons-material";
import ColorBgButton from "./ColorBgButton";
import GenericSelector from "./GenericSelector";

interface Props {
  heading?: ReactNode;
}

interface Voice {
  id: string;
  labelName: string;
  codeName: string;
}

interface CharType {
  id: string;
  labelName: string;
  codeName: string;
}

const getVoices = async (): Promise<Voice[]> => {
  return [
    {
      id: "1",
      labelName: "Male",
      codeName: "male-001",
    },
    {
      id: "2",
      labelName: "Female",
      codeName: "female-001",
    },
  ] as Voice[];
};

const getCharTypes = async (): Promise<CharType[]> => {
  return [
    {
      id: "1",
      labelName: "Sinhala",
      codeName: "sinhala-001",
    },
    {
      id: "2",
      labelName: "Roman",
      codeName: "roman-001",
    },
  ] as Voice[];
};

export default function TtsShell({ heading }: Props) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingAllowed, setTypingAllowed] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [voice, setVoice] = useState<Voice>();
  const [voiceList, setVoiceList] = useState<Voice[]>([]);
  const [charType, setCharType] = useState<CharType>();
  const [charTypeList, setCharTypeList] = useState<CharType[]>([]);

  useEffect(() => {
    const fetchVoiceList = async () => {
      const data = await getVoices();
      if (data) setVoiceList(data);
      else setVoiceList([] as Voice[]);
    };

    const fetchCharList = async () => {
      const data = await getCharTypes();
      if (data) setCharTypeList(data);
      else setCharTypeList([] as Voice[]);
    };

    fetchCharList();
    fetchVoiceList();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const updateMessage = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement, Element>,
  ) => {
    console.log("value is updated.");
    setMessage(event.target.value);
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
            <Box
              key={msg.id}
              sx={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <Box
                sx={{
                  maxWidth: "90%",
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  bgcolor: msg.role === "user" ? "primary.main" : "grey.200",
                  color: msg.role === "user" ? "white" : "text.primary",
                }}
              >
                <Typography>{msg.text}</Typography>
              </Box>
            </Box>
          ))}
          <div ref={bottomRef} />
        </Box>
      )}

      {/*text box part*/}
      <LiteCard
        // paddingBottom={5}
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
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* send icon */}
          <Box sx={{ height: "3rem", display: "flex" }}>
            <GenericSelector<Voice>
              selected={voice}
              onSelect={setVoice}
              loader={getVoices}
              getKey={(v: Voice) => v.id}
              getLabel={(v: Voice) => v.labelName}
              getValue={(v: Voice) => v.codeName}
              defaultSelectOption
            />

            <GenericSelector<CharType>
              selected={charType}
              onSelect={setCharType}
              loader={getCharTypes}
              getKey={(ct: CharType) => ct.id}
              getLabel={(ct: CharType) => ct.labelName}
              getValue={(ct: CharType) => ct.codeName}
              // defaultSelect={charTypeList[0]}
              defaultSelectOption
            />
            {/*<IconButton
              color="primary"
              onClick={handleSend}
              disabled={message ? false : true}
            >
              <SendIcon />
            </IconButton>*/}
          </Box>
          <Box sx={{ height: "3rem", display: "flex" }}>
            <ColorBgButton>කථනයට හරවන්න 2</ColorBgButton>
          </Box>
        </Box>
        {/*<Box
          sx={{ height: "3rem", display: "flex" }}
        >
          {message === "" ? (
            <div />
          ) : (
            <IconButton color="primary" onClick={handleSend}>
              <SendIcon />
            </IconButton>
          )}
        </Box>*/}
      </LiteCard>
    </Box>
  );
}
