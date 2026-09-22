import { Box, Typography, Button } from "@mui/material";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleContinue = () => {
    navigate("/p/chatbot", { replace: true });
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        width: "100%",
        px: 2,
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: "460px",
          textAlign: "center",
        }}
      >
        <Typography variant="h4" sx={{ mb: 2 }}>
          Welcome to The Subasa
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          Your account has been created successfully.
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          An organization administrator will assign you to an organization
          soon. You may continue with limited access or sign out and come back
          later.
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Button variant="contained" onClick={handleContinue}>
            Continue
          </Button>

          <Button variant="outlined" onClick={handleLogout}>
            Sign out
          </Button>
        </Box>
      </Box>
    </Box>
  );
}