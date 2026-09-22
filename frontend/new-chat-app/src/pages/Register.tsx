import { Box, Divider, TextField, Typography } from "@mui/material";
import ColorBgButton from "@/components/ColorBgButton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router";
import { RegisterRequest } from "@/types/auth";
import { API_ENDPOINTS } from "@/utils/api";
import { useAlert } from "@/hooks/useAlert";
import axiosInstance from "@/api/axios";
import { GoogleLogin } from "@react-oauth/google";
import { useGoogleAuthHandler } from "@/hooks/useGoogleAuthHandler";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { addAlert } = useAlert();
  const { handleGoogleSuccess } = useGoogleAuthHandler();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      const payload: RegisterRequest = { ...data, role: "general_user" };
      await axiosInstance.post(API_ENDPOINTS.REGISTER, payload);

      addAlert("success", "Registration successful! Please sign in.");
      navigate("/login");
    } catch {
      // Error alert handled by axios interceptor
    }
  };

  const handleError = () => {
    addAlert("error", "Login failed. Please try again.");
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
                placeholder="Name"
                error={!!errors.name}
                helperText={errors.name?.message}
                {...register("name")}
              />
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
              <ColorBgButton
                type="submit"
                disabled={isSubmitting}
                sx={{ width: "100%" }}
              >
                {isSubmitting ? "Creating account..." : "Sign up"}
              </ColorBgButton>
              <Divider sx={{ my: 1 }}>or</Divider>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleError}
              />
              ;
            </Box>
          </form>
        </Box>
      </Box>
    </Box>
  );
}
