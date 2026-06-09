import { Link, useParams } from "react-router";
import { API_ENDPOINTS } from "@/utils/api";
import { CustomChatbot } from "@/types/custom-chatbot";
import CustomChatShell from "@/components/CustomChatShell";
import { useQuery } from "@tanstack/react-query";
import { fetchChatbotByUrlPath } from "@/api/chatbot";
import { useAuth } from "@/hooks/useAuth";
import { useChatbotAccess } from "@/hooks/useChatbotAccess";
import AccessDenied from "@/components/AccessDenied";
import { Button } from "@mui/material";

export default function CustomChatbotPage() {
  const { url_path } = useParams<{ url_path: string }>();
  const { organization_uuid, isAuthenticated, role } = useAuth();

  const {
    data: chatbotData,
    // isLoading,
    // isError,
  } = useQuery<CustomChatbot>({
    queryKey: ["chatbot", url_path],
    queryFn: () => fetchChatbotByUrlPath(url_path ?? ""),
    enabled: !!url_path,
  });

  // if (isLoading) return <div>Loading...</div>;
  // if (isError || !chatbotData)
  //   return <AccessDenied message="Chatbot not found" />;

  const heroImageUrl = API_ENDPOINTS.CUSTOM_CHATBOT_IMAGE(
    chatbotData?.hero_image || "",
  );

  const access = useChatbotAccess(chatbotData || ({} as CustomChatbot), {
    role,
    organization_uuid,
    isAuthenticated,
  });

  if (access === "allowed") {
    return (
      <CustomChatShell
        chatbotData={chatbotData || ({} as CustomChatbot)}
        heroImageUrl={heroImageUrl}
      />
    );
  }

  switch (access) {
    case "not_published":
      return <AccessDenied message="Chatbot is not published." />;
    case "org_required":
      return (
        <AccessDenied message="Only organization members can access this chatbot." />
      );
    case "org_mismatch":
      return (
        <AccessDenied message="Your organization does not have access to this chatbot." />
      );
    case "login_required":
      return (
        <AccessDenied message="You need to Log in or Sign up to access this chatbot.">
          <Link to={"/login"}>
            <Button variant="contained">Log in</Button>
          </Link>
          <Link to={"/register"}>
            <Button variant="outlined">Sign up</Button>
          </Link>
        </AccessDenied>
      );
  }
}
