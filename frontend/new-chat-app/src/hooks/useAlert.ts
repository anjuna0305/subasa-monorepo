import { AlertContextType } from "@/contexts/AlertContext";
import { createContext, useContext } from "react";

export const AlertContext = createContext<AlertContextType | null>(null);

export function useAlert(): AlertContextType {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
}
