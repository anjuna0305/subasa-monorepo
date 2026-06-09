import { TextField, TextFieldProps } from "@mui/material";

// i could not think of any other name for this component, rename it if you have a better name
export default function InvisibleInput({ sx, ...props }: TextFieldProps) {
  return (
    <TextField
      sx={{
        "& .MuiOutlinedInput-root": {
          "& fieldset": { border: "none" },
        },
        ...sx,
      }}
      {...props}
    />
  );
}
