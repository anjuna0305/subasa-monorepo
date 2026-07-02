import { CredentialResponse } from "@react-oauth/google";
import axiosInstance from "./axios";
import { API_ENDPOINTS } from "@/utils/api";

export const authGoogle = async (response: CredentialResponse) => {
  const res = await axiosInstance.post(API_ENDPOINTS.GOOGLE_AUTH, {
    id_token: response.credential,
  });
  return res.data;
};
