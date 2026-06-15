export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
export const WS_BASE_URL =
  import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:8765";

export const API_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/users/login`,
  REGISTER: `${API_BASE_URL}/users/register`,
  GOOGLE_LOGIN: `${API_BASE_URL}/users/login-with-google`,
  CHATBOT_CHAT: `${API_BASE_URL}/voc-si/api/chatbot/chat`,
  FRAMEWORK_UPLOAD: `${API_BASE_URL}/voc-si/api/framework/upload`,
  ASR_WS: WS_BASE_URL,
  CUSTOM_CHATBOT_LIST: `${API_BASE_URL}/custom-chatbots`,
  CUSTOM_CHATBOT_DETAIL: (id: string) =>
    `${API_BASE_URL}/custom-chatbots/${id}`,
  CUSTOM_CHATBOT_UPLOAD_IMAGE: (id: string) =>
    `${API_BASE_URL}/custom-chatbots/${id}/upload-image`,
  CUSTOM_CHATBOT_UPLOAD_FILE: (id: string) =>
    `${API_BASE_URL}/custom-chatbots/${id}/upload-file`,
  CUSTOM_CHATBOT_PUBLISH: (id: string) =>
    `${API_BASE_URL}/custom-chatbots/publish/${id}`,
  CUSTOM_CHATBOT_UNPUBLISH: (id: string) =>
    `${API_BASE_URL}/custom-chatbots/unpublish/${id}`,
  CUSTOM_CHATBOT_PUBLIC: (id: string) =>
    `${API_BASE_URL}/custom-chatbots/make-public/${id}`,
  CUSTOM_CHATBOT_PRIVATE: (id: string) =>
    `${API_BASE_URL}/custom-chatbots/make-private/${id}`,
  CUSTOM_CHATBOT_BY_URL: (urlPath: string) =>
    `${API_BASE_URL}/custom-chatbots/by-url-path/${urlPath}`,
  CUSTOM_CHATBOT_API: (urlPath: string) =>
    `${API_BASE_URL}/custom-chatbots/api/${urlPath}`,
  CUSTOM_CHATBOT_IMAGE: (imageName: string) =>
    `${API_BASE_URL}/custom-chatbots/images/${imageName}`,

  ORGANIZATION_LIST: `${API_BASE_URL}/orgs`,
  ORGANIZATION_DETAIL: (id: string) => `${API_BASE_URL}/orgs/${id}`,
  ORGANIZATION_ACTIVATE: (id: string) => `${API_BASE_URL}/orgs/activate/${id}`,
  ORGANIZATION_DEACTIVATE: (id: string) =>
    `${API_BASE_URL}/orgs/deactivate/${id}`,

  USER_LIST: `${API_BASE_URL}/users`,
  USER_DETAIL: (id: string) => `${API_BASE_URL}/users/${id}`,
  USER_CHANGE_ORG: (id: string) => `${API_BASE_URL}/users/${id}/organization`,
  USER_BLOCK: (id: string) => `${API_BASE_URL}/users/${id}/block`,
  USER_UNBLOCK: (id: string) => `${API_BASE_URL}/users/${id}/unblock`,
  GET_ME: `${API_BASE_URL}/users/me`,

  ASR_TRANSCRIBE: `${API_BASE_URL}/voc-si/api/asr/transcribe`,
  TTS_GENERATE: `${API_BASE_URL}/voc-si/api/tts/voicebot-generate-audio`,
};

export function parseErrorMessage(
  errorData: unknown,
  fallbackMessage: string,
): string {
  if (errorData && typeof errorData === "object" && "detail" in errorData) {
    const detail = (errorData as Record<string, unknown>).detail;
    if (Array.isArray(detail)) {
      return (detail as Array<{ message: string }>)
        .map((e) => e.message)
        .join(", ");
    }
    if (typeof detail === "string") {
      return detail;
    }
  }
  return fallbackMessage;
}

export function getGoogleRedirectUri(): string {
  const override = import.meta.env.VITE_GOOGLE_REDIRECT_URI;
  if (override) return override;
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${window.location.origin}${basePath}/auth/callback`;
}

export function getGoogleAuthUrl(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const redirectUri = getGoogleRedirectUri();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
