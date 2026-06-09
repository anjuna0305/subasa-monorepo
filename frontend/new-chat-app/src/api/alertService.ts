import { AppAlert } from "@/contexts/AlertContext";

type AlertHandler = (severity: AppAlert["severity"], message: string) => void;

let alertHandler: AlertHandler | null = null;

export const registerAlertHandler = (handler: AlertHandler) => {
  alertHandler = handler;
};

export const showAlert: AlertHandler = (severity, message) => {
  alertHandler?.(severity, message);
};
