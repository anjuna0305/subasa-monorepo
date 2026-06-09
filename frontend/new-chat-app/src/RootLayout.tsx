import ThemeRegistry from "./components/ThemeRegistry";
import { AuthProvider } from "./contexts/AuthContext";
import GlobalAlert from "./components/GlobalAlert";
import { Outlet } from "react-router";
import { useEffect } from "react";
import { registerAlertHandler } from "./api/alertService";
import { useAlert } from "./hooks/useAlert";

export default function RootLayout() {
  const { addAlert } = useAlert();

  useEffect(() => {
    registerAlertHandler(addAlert);
  }, [addAlert]);

  return (
    <ThemeRegistry>
      <AuthProvider>
        <Outlet />
        <GlobalAlert />
      </AuthProvider>
    </ThemeRegistry>
  );
}
