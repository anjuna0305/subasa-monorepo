import { Box, Paper, Typography } from "@mui/material";
import { ReactNode } from "react";

type AccessDeniedProps = {
  message: string;
  children?: ReactNode;
};

export default function AccessDenied({ message, children }: AccessDeniedProps) {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
          {message}
        </Typography>
        <Box
          sx={{
            pt: 2,
            width: "100%",
            display: "flex",
            justifyContent: "center",
            gap: 2,
          }}
        >
          {children}
        </Box>
      </Paper>
    </Box>
  );
}
