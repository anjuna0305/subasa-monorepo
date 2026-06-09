import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Stack,
  Input,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import ColorBgButton from "@/components/ColorBgButton";
import ColorBgIconButton from "@/components/ColorBgIconButton";
import { API_ENDPOINTS } from "@/utils/api";
import { CustomChatbot } from "@/types/custom-chatbot";
import AdminGuard from "@/components/AdminGuard";
import { Organization } from "@/types/organizations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchChatbotById } from "@/api/chatbot";
import { useAlert } from "@/hooks/useAlert";
import axiosInstance from "@/api/axios";

export default function CustomChatbotDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const chatbotId = id!;
  const { addAlert } = useAlert();
  const queryClient = useQueryClient();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const { data: chatbot, isLoading } = useQuery<CustomChatbot>({
    queryKey: ["chatbot", id],
    queryFn: () => fetchChatbotById(chatbotId),
    enabled: !!id,
  });

  const { data: org } = useQuery<Organization>({
    queryKey: ["organization", chatbot?.organization_uuid],
    queryFn: async () => {
      const response = await axiosInstance.get<Organization>(
        API_ENDPOINTS.ORGANIZATION_DETAIL(chatbot!.organization_uuid!),
      );
      return response.data;
    },
    enabled: !!chatbot?.organization_uuid,
  });

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await axiosInstance.post(
        API_ENDPOINTS.CUSTOM_CHATBOT_UPLOAD_IMAGE(chatbotId),
        formData,
        {
          headers: {
            "Content-Type": undefined,
          },
        },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatbot", id] });
      setSelectedFile(null);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      addAlert("success", "Hero image uploaded successfully");
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: async (shouldBePublished: boolean) => {
      const path = shouldBePublished
        ? API_ENDPOINTS.CUSTOM_CHATBOT_PUBLISH(chatbotId)
        : API_ENDPOINTS.CUSTOM_CHATBOT_UNPUBLISH(chatbotId);
      const response = await axiosInstance.post<CustomChatbot>(path);
      return response.data;
    },
    onSuccess: (_data: CustomChatbot, shouldBePublished: boolean) => {
      queryClient.invalidateQueries({ queryKey: ["chatbot", id] });
      addAlert(
        "success",
        shouldBePublished ? "Chatbot published" : "Chatbot unpublished",
      );
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async (shouldBePublic: boolean) => {
      const path = shouldBePublic
        ? API_ENDPOINTS.CUSTOM_CHATBOT_PUBLIC(chatbotId)
        : API_ENDPOINTS.CUSTOM_CHATBOT_PRIVATE(chatbotId);
      const response = await axiosInstance.post<CustomChatbot>(path);
      return response.data;
    },
    onSuccess: (_data: CustomChatbot, shouldBePublic: boolean) => {
      queryClient.invalidateQueries({ queryKey: ["chatbot", id] });
      addAlert(
        "success",
        shouldBePublic ? "Chatbot is public now" : "Chatbot is private now",
      );
    },
  });

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      addAlert("error", "Please select an image file");
      return;
    }
    setSelectedFile(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    uploadImageMutation.mutate(selectedFile);
  };

  const heroImageSrc = chatbot?.hero_image
    ? API_ENDPOINTS.CUSTOM_CHATBOT_IMAGE(chatbot.hero_image)
    : null;

  const handleDocSelect = () => {
    docInputRef.current?.click();
  };

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["text/plain", "application/pdf"];
    if (!allowed.includes(file.type)) {
      addAlert("error", "Only .txt and .pdf files are allowed");
      return;
    }
    setSelectedDoc(file);
  };

  const uploadDocMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await axiosInstance.post(
        API_ENDPOINTS.CUSTOM_CHATBOT_UPLOAD_FILE(chatbotId),
        formData,
        {
          headers: {
            "Content-Type": undefined,
          },
        },
      );
      return response.data;
    },
    onSuccess: () => {
      setSelectedDoc(null);
      if (docInputRef.current) docInputRef.current.value = "";
      addAlert("success", "File uploaded successfully");
    },
  });

  const handleDocUpload = () => {
    if (!selectedDoc) return;
    uploadDocMutation.mutate(selectedDoc);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!chatbot) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Chatbot not found.</Typography>
      </Box>
    );
  }

  return (
    <AdminGuard>
      <Box sx={{ p: 3, maxWidth: "800px", mx: "auto" }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
          <ColorBgIconButton
            tooltip="Back to list"
            onClick={() => navigate("/admin/custom-chatbot")}
          >
            <ArrowBackIcon />
          </ColorBgIconButton>
          <Typography variant="h5" sx={{ fontWeight: 600, ml: 1 }}>
            Chatbot Details
          </Typography>
        </Box>

        <Stack spacing={3}>
          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Name
                </Typography>
                <Typography variant="h6">{chatbot.chatbot_name}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Description
                </Typography>
                <Typography>{chatbot.description}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  URL Path
                </Typography>
                <Typography>
                  <a
                    href={`/p/${chatbot.url_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "inherit",
                      textDecoration: "none",
                    }}
                  >
                    /p/{chatbot.url_path}
                  </a>
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Retrieval Key
                </Typography>
                <Typography
                  sx={{ fontFamily: "monospace", fontSize: "0.85rem" }}
                >
                  {chatbot.retrieval_key}
                </Typography>
              </Box>
              {org && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Organization
                  </Typography>
                  <Typography>{org.name}</Typography>
                </Box>
              )}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
                <Chip
                  label={chatbot.is_publish ? "Published" : "Unpublished"}
                  color={chatbot.is_publish ? "success" : "default"}
                  size="small"
                />
                <ColorBgButton
                  size="small"
                  onClick={() =>
                    togglePublishMutation.mutate(!chatbot.is_publish)
                  }
                  disabled={togglePublishMutation.isPending}
                  variant="outlined"
                  sx={{ ml: 1 }}
                >
                  {togglePublishMutation.isPending
                    ? "Updating..."
                    : chatbot.is_publish
                      ? "Unpublish"
                      : "Publish"}
                </ColorBgButton>
              </Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Visibility
                </Typography>
                <Chip
                  label={chatbot.is_public ? "Public" : "Private"}
                  size="small"
                />
                <ColorBgButton
                  size="small"
                  onClick={() =>
                    toggleVisibilityMutation.mutate(!chatbot.is_public)
                  }
                  disabled={toggleVisibilityMutation.isPending}
                  variant="outlined"
                  sx={{ ml: 1 }}
                >
                  {toggleVisibilityMutation.isPending
                    ? "Updating..."
                    : !chatbot.is_public
                      ? "Make Public"
                      : "Make Private"}
                </ColorBgButton>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Created
                </Typography>
                <Typography>
                  {new Date(chatbot.created_at).toLocaleString()}
                </Typography>
              </Box>
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
              Hero Image
            </Typography>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                flexWrap: "wrap",
              }}
            >
              <Box
                component="img"
                src={preview || heroImageSrc || ""}
                alt={chatbot.chatbot_name}
                sx={{
                  width: 160,
                  height: 160,
                  objectFit: "cover",
                  borderRadius: 2,
                  bgcolor: "grey.100",
                  display: preview || heroImageSrc ? "block" : "none",
                }}
              />

              {!(preview || heroImageSrc) && (
                <Box
                  sx={{
                    width: 160,
                    height: 160,
                    borderRadius: 2,
                    bgcolor: "grey.100",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    No image
                  </Typography>
                </Box>
              )}

              <Stack spacing={1}>
                <Input
                  inputRef={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  sx={{ display: "none" }}
                  inputProps={{ accept: "image/*" }}
                />
                <ColorBgButton
                  startIcon={<CloudUploadIcon />}
                  onClick={handleFileSelect}
                  disabled={uploadImageMutation.isPending}
                  variant="outlined"
                >
                  Select Image
                </ColorBgButton>
                {selectedFile && (
                  <ColorBgButton
                    onClick={handleUpload}
                    disabled={uploadImageMutation.isPending}
                    variant="contained"
                    color="primary"
                  >
                    {uploadImageMutation.isPending ? "Uploading..." : "Upload"}
                  </ColorBgButton>
                )}
              </Stack>
            </Box>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
              Knowledge Base File
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Upload a .txt or .pdf file for the chatbot knowledge base.
            </Typography>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                flexWrap: "wrap",
              }}
            >
              {selectedDoc && (
                <Paper
                  variant="outlined"
                  sx={{
                    px: 2,
                    py: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <Typography variant="body2">{selectedDoc.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    ({(selectedDoc.size / 1024).toFixed(1)} KB)
                  </Typography>
                </Paper>
              )}

              <Stack spacing={1}>
                <Input
                  inputRef={docInputRef}
                  type="file"
                  onChange={handleDocChange}
                  sx={{ display: "none" }}
                  inputProps={{ accept: ".txt,.pdf" }}
                />
                <ColorBgButton
                  startIcon={<CloudUploadIcon />}
                  onClick={handleDocSelect}
                  disabled={uploadDocMutation.isPending}
                  variant="outlined"
                >
                  Select File
                </ColorBgButton>
                {selectedDoc && (
                  <ColorBgButton
                    onClick={handleDocUpload}
                    disabled={uploadDocMutation.isPending}
                    variant="contained"
                    color="primary"
                  >
                    {uploadDocMutation.isPending ? "Uploading..." : "Upload"}
                  </ColorBgButton>
                )}
              </Stack>
            </Box>
          </Paper>
        </Stack>
      </Box>
    </AdminGuard>
  );
}
