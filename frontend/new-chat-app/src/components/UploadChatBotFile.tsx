import {
  Alert,
  Box,
  IconButton,
  Input,
  LinearProgress,
  Tooltip,
  Typography,
} from "@mui/material";
import { ChangeEvent, DragEvent, ReactNode, useEffect, useRef, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";

import LiteCard from "./LiteCard";
import ColorBgButton from "./ColorBgButton";
import ColorBgIconButton from "./ColorBgIconButton";
import { uploadDocument, validateDocument } from "@/api/documentChat";

type UploadedFile = {
  fileName: string | null;
  file: File | null;
};

interface Props {
  heading?: ReactNode;
  /** Called with the document key once the upload has been processed. */
  onUploaded?: (documentKey: string) => void;
}

const EMPTY: UploadedFile = { fileName: null, file: null };

export default function UploadChatBotFile({ heading, onUploaded }: Props) {
  const [uploadFile, setUploadFile] = useState<UploadedFile>(EMPTY);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [documentKey, setDocumentKey] = useState<string | null>(null);
  const dropZone = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Dropping a file anywhere else in the window would otherwise navigate
    // away from the app.
    const handleWindowDrop = (e: globalThis.DragEvent) => {
      if (
        e.dataTransfer?.items &&
        [...e.dataTransfer.items].some((item) => item.kind === "file")
      ) {
        e.preventDefault();
      }
    };

    const handleWindowDragOver = (e: globalThis.DragEvent) => {
      if (!e.dataTransfer) return;
      const fileItems = [...e.dataTransfer.items].filter(
        (item) => item.kind === "file",
      );
      if (fileItems.length > 0) {
        e.preventDefault();
        if (!dropZone.current?.contains(e.target as Node)) {
          e.dataTransfer.dropEffect = "none";
        }
      }
    };

    window.addEventListener("drop", handleWindowDrop);
    window.addEventListener("dragover", handleWindowDragOver);

    return () => {
      window.removeEventListener("drop", handleWindowDrop);
      window.removeEventListener("dragover", handleWindowDragOver);
    };
  }, []);

  const selectFile = (file: File) => {
    const validationError = validateDocument(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setDocumentKey(null);
    setProgress(0);
    setUploadFile({ fileName: file.name, file });
  };

  const handleFileSend = async () => {
    if (!uploadFile.file || isSending) return;
    setIsSending(true);
    setError(null);
    setProgress(0);
    try {
      const result = await uploadDocument(uploadFile.file, setProgress);
      setDocumentKey(result.document_key);
      onUploaded?.(result.document_key);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "ගොනුව උඩුගත කිරීම අසාර්ථක විය.",
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleDragOnDropZone = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer) return;
    const fileItems = [...e.dataTransfer.items].filter(
      (item) => item.kind === "file",
    );
    if (fileItems.length > 0) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer) return;
    const files = [...event.dataTransfer.items]
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (files.length === 0) return;
    event.preventDefault();
    selectFile(files[0]);
  };

  const removeFile = () => {
    if (inputRef.current) inputRef.current.value = "";
    setUploadFile(EMPTY);
    setDocumentKey(null);
    setProgress(0);
    setError(null);
  };

  const handleInputClick = () => inputRef.current?.click();

  const handleChangeInputFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) selectFile(file);
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

      <Box>
        <ColorBgButton onClick={handleInputClick} disabled={!!uploadFile.file}>
          <Typography>ලේඛනයක් තෝරාගන්න</Typography>
        </ColorBgButton>
      </Box>

      <Box sx={{ p: 2 }}>
        <Typography>හෝ</Typography>
      </Box>

      <Input
        inputRef={inputRef}
        type="file"
        id="file-input"
        sx={{ display: "none" }}
        inputProps={{ accept: ".txt,.pdf" }}
        onChange={handleChangeInputFile}
      />

      <LiteCard
        sx={{
          width: "600px",
          maxWidth: "100%",
          height: "200px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
        onDrop={handleDrop}
        ref={dropZone}
        onDragOver={handleDragOnDropZone}
      >
        {uploadFile.file ? (
          <Box
            sx={{
              display: "flex",
              height: "100%",
              flexDirection: "column-reverse",
            }}
          >
            <Box sx={{ width: "96px" }}>
              <Box sx={{ position: "relative" }}>
                <IconButton
                  onClick={removeFile}
                  disabled={isSending}
                  sx={{ position: "absolute", top: -20, right: -4 }}
                >
                  <CloseIcon />
                </IconButton>
                <img
                  src="/text_file.png"
                  alt=""
                  style={{ width: "auto", height: "80px" }}
                />
              </Box>
              <Tooltip title={uploadFile.fileName ?? ""}>
                <Typography
                  sx={{
                    maxWidth: 200,
                    maxHeight: 48,
                    overflow: "hidden",
                    wordBreak: "break-word",
                  }}
                >
                  {uploadFile.fileName}
                </Typography>
              </Tooltip>
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography>ලේඛනයක් ඇද දමන්න</Typography>
          </Box>
        )}

        {isSending && (
          <Box sx={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
            <LinearProgress variant="determinate" value={progress} />
          </Box>
        )}

        {uploadFile.file && !documentKey && (
          <Box sx={{ p: 1, position: "absolute", bottom: 0, right: 0 }}>
            <ColorBgIconButton
              tooltip="ගොනුව උඩුගත කරන්න"
              disabled={isSending}
              onClick={handleFileSend}
            >
              <ArrowUpwardIcon />
            </ColorBgIconButton>
          </Box>
        )}
      </LiteCard>

      <Box sx={{ width: "600px", maxWidth: "100%", pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        {documentKey && (
          <Alert severity="success">
            ගොනුව උඩුගත කර සාර්ථකව සකසන ලදී.
          </Alert>
        )}
      </Box>
    </Box>
  );
}
