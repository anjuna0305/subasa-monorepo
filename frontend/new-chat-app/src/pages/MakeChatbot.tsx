import UploadChatBotFile from "@/components/UploadChatBotFile";
import { Typography } from "@mui/material";

export default function MakeChatbotPage() {
  return (
    <UploadChatBotFile
      heading={
        <>
          <Typography
            variant="h4"
            sx={{ pt: 1, mb: 0.5, pb: 2, textAlign: "center", fontFamily: "'Maname', sans-serif" }}
          >
            ඔබේම චැට්බොට් කෙනෙක් නිර්මාණය කරගන්න
          </Typography>
        </>
      }
    />
  );
}