import ThemeRegistry from "./components/ThemeRegistry";
import { AuthProvider } from "./contexts/AuthContext";
import GlobalAlert from "./components/GlobalAlert";
import { Outlet } from "react-router";
import { useEffect } from "react";
import { registerAlertHandler } from "./api/alertService";
import { useAlert } from "./hooks/useAlert";
import { GoogleOAuthProvider } from "@react-oauth/google";

export default function RootLayout() {
  const { addAlert } = useAlert();

  useEffect(() => {
    registerAlertHandler(addAlert);
  }, [addAlert]);

  return (
    <ThemeRegistry>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
        <AuthProvider>
          <Outlet />
          <GlobalAlert />
        </AuthProvider>
      </GoogleOAuthProvider>
    </ThemeRegistry>
  );
}
