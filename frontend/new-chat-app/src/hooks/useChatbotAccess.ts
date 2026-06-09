import { isAdmin } from "@/utils/auth";
import { CustomChatbot } from "@/types/custom-chatbot";

export type ChatbotAccess =
  | "allowed"
  | "not_published"
  | "org_required"
  | "org_mismatch"
  | "login_required";

export function useChatbotAccess(
  chatbot: CustomChatbot,
  {
    role,
    organization_uuid,
    isAuthenticated,
  }: {
    role: string | null;
    organization_uuid: string | null;
    isAuthenticated: boolean;
  },
): ChatbotAccess {
  if (isAdmin(role)) return "allowed";

  if (!chatbot.is_publish) return "not_published";

  if (chatbot.is_public) return "allowed";

  if (chatbot.organization_uuid) {
    if (!organization_uuid) return "org_required";
    if (chatbot.organization_uuid !== organization_uuid) return "org_mismatch";
    return "allowed";
  }

  if (!isAuthenticated) return "login_required";

  return "allowed";
}