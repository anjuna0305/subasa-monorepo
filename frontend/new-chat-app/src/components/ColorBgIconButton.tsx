import { IconButton, IconButtonProps, Tooltip } from "@mui/material";
import { forwardRef } from "react";

const ColorBgIconButton = forwardRef<
  HTMLButtonElement,
  IconButtonProps & { tooltip?: string }
>(({ children, tooltip, ...props }, ref) => {
  return tooltip ? (
    <Tooltip title={tooltip}>
      <IconButton ref={ref} {...props}>
        {children}
      </IconButton>
    </Tooltip>
  ) : (
    <IconButton ref={ref} {...props} color="success">
      {children}
    </IconButton>
  );
});

ColorBgIconButton.displayName = "ColorBgIconButton"; // 👈

export default ColorBgIconButton;
