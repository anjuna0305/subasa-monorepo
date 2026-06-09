import { Button, ButtonProps } from "@mui/material";

export default function ColorBgButton({ children, sx, ...props }: ButtonProps) {
  return (
    <Button
      variant="contained"
      sx={[{}, ...(Array.isArray(sx) ? sx : [sx])]}
      {...props}
    >
      {children}
    </Button>
  );
}