import ChatShell from "@/components/ChatShell";
import { Typography } from "@mui/material";

export default function GovChatbotPage() {
  return (
    <ChatShell
      heading={
        <>
          <img
            src="/mace_color.png"
            alt="Mace of Sri Lanka"
            style={{ width: "300px", height: "auto" }}
          />
          <Typography
            variant="h4"
            sx={{ pt: 1, mb: 0.5, textAlign: "center", fontFamily: "'Maname', sans-serif" }}
          >
            ශ්‍රී ලංකා ප්‍රජාතාන්ත්‍රික සමාජවාදී ජනරජයේ ආණ්ඩුක්‍රම ව්‍යවස්ථාව
          </Typography>
        </>
      }
    />
  );
}