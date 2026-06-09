export type Message = {
  id: number;
  text: string;
  role: "user" | "bot";
  audioUrl?: string;
  audioLoading?: boolean;
};