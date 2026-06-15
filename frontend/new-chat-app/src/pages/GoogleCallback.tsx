import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/hooks/useAlert";
import { getGoogleRedirectUri } from "@/utils/api";

export default function GoogleCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithGoogle } = useAuth();
  const { addAlert } = useAlert();

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      addAlert("error", "Google sign-in was cancelled or failed.");
      navigate("/login", { replace: true });
      return;
    }

    if (!code) {
      addAlert("error", "No authorization code received from Google.");
      navigate("/login", { replace: true });
      return;
    }

    const redirectUri = getGoogleRedirectUri();

    loginWithGoogle({ code, redirect_uri: redirectUri })
      .then((isNewUser) => {
        if (isNewUser) {
          navigate("/onboarding", { replace: true });
        } else {
          const redirectTo =
            searchParams.get("redirect") || "/p/chatbot";
          navigate(decodeURIComponent(redirectTo), { replace: true });
        }
      })
      .catch((err) => {
        const msg =
          err instanceof Error
            ? err.message
            : "Google sign-in failed. Please try again.";
        addAlert("error", msg);
        navigate("/login", { replace: true });
      });
  }, [searchParams, loginWithGoogle, addAlert, navigate]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography variant="body1" color="text.secondary">
        Signing in with Google...
      </Typography>
    </Box>
  );
}