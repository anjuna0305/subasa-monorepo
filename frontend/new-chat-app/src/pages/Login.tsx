import { Box, Button, Divider, TextField, Typography } from "@mui/material";
import ColorBgButton from "@/components/ColorBgButton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/hooks/useAlert";
import { getGoogleAuthUrl } from "@/utils/api";

const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const { addAlert } = useAlert();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const location = useLocation();

  console.log("pathname: ", location.pathname);
  console.log("search: ", location.search);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setErrorMessage(null);
    try {
      await login(data);
      const redirectTo = searchParams.get("redirect") || "/p/chatbot";
      navigate(decodeURIComponent(redirectTo), { replace: true });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Login failed. Please try again.";
      setErrorMessage(msg);
      addAlert("error", msg);
    }
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
          maxWidth: "420px",
        }}
      >
        <Typography variant="h4" sx={{ textAlign: "center", mb: 3 }}>
          The Subasa
        </Typography>

        <Box>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <TextField
                fullWidth
                type="email"
                placeholder="Email"
                error={!!errors.email}
                helperText={errors.email?.message}
                {...register("email")}
              />

              <TextField
                fullWidth
                type="password"
                placeholder="Password"
                error={!!errors.password}
                helperText={errors.password?.message}
                {...register("password")}
              />

              {errorMessage && (
                <Typography color="error" variant="body2" sx={{ px: 1 }}>
                  {errorMessage}
                </Typography>
              )}

              <ColorBgButton
                type="submit"
                disabled={isSubmitting}
                sx={{
                  width: "100%",
                }}
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
              </ColorBgButton>

              <Divider sx={{ my: 1 }}>or</Divider>

              <Button
                fullWidth
                variant="outlined"
                onClick={() => {
                  window.location.href = getGoogleAuthUrl();
                }}
                startIcon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                }
                sx={{
                  textTransform: "none",
                  borderColor: "#dadce0",
                  color: "#3c4043",
                  "&:hover": {
                    borderColor: "#dadce0",
                    backgroundColor: "#f8f9fa",
                  },
                }}
              >
                Sign in with Google
              </Button>
            </Box>
          </form>
        </Box>
      </Box>
    </Box>
  );
}
