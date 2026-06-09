import TtsShell from "@/components/TtsShell";
import { Typography } from "@mui/material";

export default function TtsPage() {
  return (
    <TtsShell
      heading={
        <>
          <Typography
            variant="h4"
            sx={{ pt: 1, mb: 0.5, textAlign: "center", fontFamily: "'Maname', sans-serif" }}
          >
            කියවාගැනීමට අවශ්‍ය දේ ලියන්න
          </Typography>
        </>
      }
    />
  );
}