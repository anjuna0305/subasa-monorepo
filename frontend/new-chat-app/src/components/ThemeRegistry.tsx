import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { lightTheme } from "@/themes";
import { Box } from "@mui/material";

export default function ThemeRegistry({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <Box
        sx={{
          "& ::-webkit-scrollbar": {
            width: "6px",
            height: "6px",
          },
          "& ::-webkit-scrollbar-track": {
            background: "transparent",
          },
          "& ::-webkit-scrollbar-thumb": {
            background: "#cbd5e1",
            borderRadius: "3px",
          },
          "& ::-webkit-scrollbar-thumb:hover": {
            background: "#94a3b8",
          },
        }}
      >
        {children}
      </Box>
    </ThemeProvider>
  );
}