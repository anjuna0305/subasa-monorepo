import { Box, Divider, TextField, Typography } from "@mui/material";
import ColorBgButton from "@/components/ColorBgButton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { useAlert } from "@/hooks/useAlert";
import { GoogleLogin } from "@react-oauth/google";
import { useGoogleAuthHandler } from "@/hooks/useGoogleAuthHandler";

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
  const { handleGoogleSuccess } = useGoogleAuthHandler();

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

              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => {
                  console.log("Login Failed");
                }}
              />
            </Box>
          </form>
        </Box>
      </Box>
    </Box>
  );
}
