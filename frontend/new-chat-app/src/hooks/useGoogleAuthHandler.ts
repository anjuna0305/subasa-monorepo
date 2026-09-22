import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "./useAuth";
import { CredentialResponse } from "@react-oauth/google";
import { authGoogle } from "@/api/loginWithGoogle";

export function useGoogleAuthHandler() {
  const { updateAuthStates } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleGoogleSuccess = async (
    credentialResponse: CredentialResponse,
  ) => {
    const data = await authGoogle(credentialResponse);
    updateAuthStates(data);

    const redirectTo = searchParams.get("redirect") || "/p/chatbot";
    navigate(decodeURIComponent(redirectTo), { replace: true });
  };

  return { handleGoogleSuccess };
}
