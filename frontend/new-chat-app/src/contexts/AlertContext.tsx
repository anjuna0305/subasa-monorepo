import { AlertContext } from "@/hooks/useAlert";
import React, { useCallback, useMemo, useState } from "react";

export type AppAlert = {
  id: string;
  severity: "success" | "info" | "warning" | "error";
  message: string;
};

export type AlertContextType = {
  alerts: AppAlert[];
  addAlert: (
    severity: AppAlert["severity"],
    message: string,
    duration?: number,
  ) => void;
  dismissAlert: (id: string) => void;
};

let alertCounter = 0;

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<AppAlert[]>([]);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const addAlert = useCallback(
    (
      severity: AppAlert["severity"],
      message: string,
      duration: number = 5000,
    ) => {
      const id = `alert-${++alertCounter}`;
      const alert: AppAlert = { id, severity, message };
      setAlerts((prev) => [...prev, alert]);

      if (duration > 0) {
        setTimeout(() => {
          dismissAlert(id);
        }, duration);
      }
    },
    [dismissAlert],
  );

  const value = useMemo(
    () => ({ alerts, addAlert, dismissAlert }),
    [alerts, addAlert, dismissAlert],
  );

  return (
    <AlertContext.Provider value={value}>{children}</AlertContext.Provider>
  );
}
