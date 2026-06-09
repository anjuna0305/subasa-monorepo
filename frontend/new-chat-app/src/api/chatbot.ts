import { CustomChatbot, ChatbotsResponse } from "@/types/custom-chatbot";
import { API_ENDPOINTS } from "@/utils/api";
import axiosInstance from "./axios";

export type FetchChatbotsParams = {
  page?: number;
  page_size?: number;
  search?: string;
  sort_by?: "chatbot_name" | "created_at";
  sort_order?: "asc" | "desc";
  is_publish?: boolean;
  is_public?: boolean;
  organization_uuid?: string;
};

export const fetchChatbotById = async (id: string): Promise<CustomChatbot> => {
  const res = await axiosInstance.get(API_ENDPOINTS.CUSTOM_CHATBOT_DETAIL(id));
  return res.data;
};

export const fetchChatbotByUrlPath = async (urlPath: string): Promise<CustomChatbot> => {
  const res = await axiosInstance.get(API_ENDPOINTS.CUSTOM_CHATBOT_BY_URL(urlPath));
  return res.data;
};

export const fetchChatbots = async (
  params: FetchChatbotsParams = {},
): Promise<ChatbotsResponse> => {
  const res = await axiosInstance.get(API_ENDPOINTS.CUSTOM_CHATBOT_LIST, {
    params,
  });
  return res.data;
};

export const createCustomChatbot = async (payload: {
  chatbot_name: string;
  description: string;
  url_path: string;
  organization_uuid: string | null;
  is_public: boolean;
}): Promise<CustomChatbot> => {
  const res = await axiosInstance.post(API_ENDPOINTS.CUSTOM_CHATBOT_LIST, {
    ...payload,
    is_public: payload.is_public ? "true" : "false",
  });
  return res.data;
};