import { CredentialResponse } from "@react-oauth/google";
import { useNavigate, useSearchParams } from "react-router";

import { authGoogle } from "@/api/googleAuth";
import { useAlert } from "./useAlert";
import { useAuth } from "./useAuth";
import { POST_LOGIN_REDIRECT } from "@/utils/routes";

export function useGoogleAuthHandler() {
  const { updateAuthStates } = useAuth();
  const { addAlert } = useAlert();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleGoogleSuccess = async (
    credentialResponse: CredentialResponse,
  ) => {
    try {
      const data = await authGoogle(credentialResponse);
      updateAuthStates(data);

      // A sign-in that created the account goes through onboarding; the
      // gateway is the only thing that can tell us which happened.
      if (data.is_new_user) {
        navigate("/onboarding", { replace: true });
        return;
      }

      const redirectTo = searchParams.get("redirect") || POST_LOGIN_REDIRECT;
      navigate(decodeURIComponent(redirectTo), { replace: true });
    } catch (err) {
      // axios errors already surface through the interceptor; this covers the
      // rest (a missing credential, a network failure).
      if (!(err && typeof err === "object" && "response" in err)) {
        addAlert(
          "error",
          err instanceof Error ? err.message : "Google sign-in failed.",
        );
      }
    }
  };

  const handleGoogleError = () => {
    addAlert("error", "Google sign-in was cancelled or failed.");
  };

  return { handleGoogleSuccess, handleGoogleError };
}
