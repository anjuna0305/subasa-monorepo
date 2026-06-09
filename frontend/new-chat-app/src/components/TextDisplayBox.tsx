import { BoxProps } from "@mui/material";
import LiteCard from "./LiteCard";

export default function TextDisplayBox({ children, ...props }: BoxProps) {
  return <LiteCard {...props}>{children}</LiteCard>;
}
