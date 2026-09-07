import { CredentialResponse } from "@react-oauth/google";

import axiosInstance from "./axios";
import { API_ENDPOINTS } from "@/utils/api";
import { LoginResponse } from "@/types/auth";

/**
 * Exchange a Google ID token for a Subasa session.
 *
 * The `<GoogleLogin>` widget hands us the ID token directly, so there is no
 * authorization-code round trip and no redirect URI involved.
 */
export const authGoogle = async (
  response: CredentialResponse,
): Promise<LoginResponse> => {
  if (!response.credential) {
    throw new Error("Google did not return a credential.");
  }
  const res = await axiosInstance.post<LoginResponse>(
    API_ENDPOINTS.GOOGLE_AUTH,
    { id_token: response.credential },
  );
  return res.data;
};
