import AsrShell from "@/components/AsrShell";
import { Typography } from "@mui/material";

export default function AsrPage() {
  return (
    <AsrShell
      heading={
        <>
          <Typography
            variant="h4"
            sx={{ pt: 1, mb: 0.5, textAlign: "center", fontFamily: "'Maname', sans-serif" }}
          >
            ලියාගැනීමට අවශ්‍ය දේ පවසන්න
          </Typography>
        </>
      }
    />
  );
}