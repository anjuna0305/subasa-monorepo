import { Box, IconButton, Input, Tooltip, Typography } from "@mui/material";
import LiteCard from "./LiteCard";

import {
  ChangeEvent,
  DragEvent,
  ReactNode,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import CloseIcon from "@mui/icons-material/Close";
import ColorBgButton from "./ColorBgButton";

import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ColorBgIconButton from "./ColorBgIconButton";
import { PercentSharp, UploadFile, UploadRounded } from "@mui/icons-material";
import Waveform2 from "./WaveForm2";
import { API_ENDPOINTS } from "@/utils/api";

type UploadedFile = {
  fileName: string | null;
  file: File | null;
  preview: string | null;
};

interface Props {
  heading?: ReactNode;
}

const uploadSelectedFile = (file: File) => {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        console.log("percentage: ", percent);
        // set progress here
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

    xhr.open("POST", API_ENDPOINTS.FRAMEWORK_UPLOAD);
    xhr.send(formData);
  });
};

const sendFile = () => {};

export default function UploadChatBotFile({ heading }: Props) {
  const [uploadFile, setUploadFile] = useState<UploadedFile>({
    file: null,
    preview: null,
  } as UploadedFile);
  const [isFileSending, setIsFileSending] = useState<boolean>(false);
  const dropZone = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (uploadFile.preview) {
        URL.revokeObjectURL(uploadFile.preview);
      }
    };
  }, [uploadFile]);

  useEffect(() => {
    const handleWindowDrop = (e: globalThis.DragEvent) => {
      if (
        e.dataTransfer?.items &&
        [...e.dataTransfer.items].some((item) => item.kind === "file")
      ) {
        e.preventDefault();
      }
    };

    const handleWindowDragOver = (e: globalThis.DragEvent) => {
      if (e.dataTransfer) {
        const fileItems = [...e.dataTransfer.items].filter(
          (item) => item.kind === "file",
        );
        if (fileItems.length > 0) {
          e.preventDefault();
          if (!dropZone.current?.contains(e.target as Node)) {
            e.dataTransfer.dropEffect = "none";
          }
        }
      }
    };

    window.addEventListener("drop", handleWindowDrop);
    window.addEventListener("dragover", handleWindowDragOver);

    return () => {
      // when the component unmount, this will call and remove the event listeners.
      window.removeEventListener("drop", handleWindowDrop);
      window.removeEventListener("dragover", handleWindowDragOver);
    };
  }, []);

  const handleUploadFile = async () => {};

  const handleFileSend = () => {
    console.log("handle file send called");
    if (uploadFile.file) uploadSelectedFile(uploadFile.file);
    else console.error("no file is selected");
    // send the file,
    // handle the errors
    // block the send button until file is handled.
    //
  };

  const hanldeCancelFileSend = async () => {};
  const generatePreviewForFile = (file: File): string | null => {
    const url = URL.createObjectURL(file);
    return url ? url : null;
  };

  const handleDragOnDropZone = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer) {
      const fileItems = [...e.dataTransfer.items].filter(
        (item) => item.kind === "file",
      );
      if (fileItems.length > 0) {
        e.preventDefault();
        if (fileItems.some((item) => item.type.startsWith("image/"))) {
          e.dataTransfer.dropEffect = "copy";
        } else {
          e.dataTransfer.dropEffect = "none";
        }
      }
    }
  };

  const testHandleDrop = (event: DragEvent<HTMLDivElement>) => {
    console.log("drop event detected");
    if (event.dataTransfer) {
      const fileItems = [...event.dataTransfer.items].filter(
        (item) => item.kind === "file",
      );
      if (fileItems.length > 0) {
        event.preventDefault();
        if (fileItems.some((item) => item.type.startsWith("image/"))) {
          const dataFile = fileItems[0].getAsFile();
          if (dataFile) {
            setUploadFile({
              fileName: dataFile.name,
              file: dataFile,
              preview: generatePreviewForFile(dataFile),
            });
          }
        }
      }
    }
  };

  const removeImage = () => {
    if (inputRef.current) inputRef.current.value = "";
    setUploadFile({ file: null, preview: null, fileName: null });
  };

  const handleInputClick = () => {
    inputRef.current?.click();
  };

  const handleChangeInputFile = (event: ChangeEvent<HTMLInputElement>) => {
    console.log("handle change input file called");
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.type.startsWith("image/")) {
      setUploadFile({
        fileName: file.name,
        file: file,
        preview: URL.createObjectURL(file),
      });
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
      {/* headed area */}
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
        onChange={handleChangeInputFile}
      />

      <LiteCard
        sx={{
          width: "600px",
          height: "200px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
        onDrop={testHandleDrop}
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
                  onClick={removeImage}
                  sx={{ position: "absolute", top: -20, right: -4 }}
                >
                  <CloseIcon />
                </IconButton>
                <img
                  src="/text_file.png"
                  alt="text_file.png"
                  style={{ width: "auto", height: "80px" }}
                />
              </Box>
              <Tooltip title={uploadFile.fileName}>
                <Typography
                  sx={{
                    maxWidth: 200,
                    maxHeight: 48,
                    overflow: "hidden",
                    wordBreak: "break-word",
                  }}
                >
                  {uploadFile.fileName ? uploadFile.fileName : "random text"}
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

        {uploadFile.file && (
          <Box sx={{ p: 1, position: "absolute", bottom: 0, right: 0 }}>
            <ColorBgIconButton
              disabled={isFileSending}
              onClick={handleFileSend}
            >
              <ArrowUpwardIcon />
            </ColorBgIconButton>
          </Box>
          // TODO send function should be implemented.
        )}
      </LiteCard>
    </Box>
  );
}
