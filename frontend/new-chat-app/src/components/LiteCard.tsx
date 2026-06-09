import { Box, BoxProps } from "@mui/material";

export default function LiteCard({ children, sx, ...props }: BoxProps) {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        padding: "16px",
        borderRadius: "8px",
        backgroundColor: "background.paper",
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}