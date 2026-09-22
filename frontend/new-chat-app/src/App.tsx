import { Routes, Route } from "react-router";
import RootLayout from "./RootLayout";
import AppLayout from "./AppLayout";
import AdminGuard from "./components/AdminGuard";
import AuthGuard from "./components/AuthGuard";
import { isAdmin, isOrgAdmin } from "./utils/auth";
import HomePage from "./pages/Home";
import AboutPage from "./pages/About";
// import ChatPage from "./pages/Chat";
import AsrPage from "./pages/Asr";
import TtsPage from "./pages/Tts";
import GovChatbotPage from "./pages/GovChatbot";
import MakeChatbotPage from "./pages/MakeChatbot";
import VoiceStreamPage from "./pages/VoiceStream";
import CustomChatbotPage from "./pages/CustomChatbot";
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import GoogleCallbackPage from "./pages/GoogleCallback";
import OnboardingPage from "./pages/Onboarding";
import AdminDashboardPage from "./pages/AdminDashboard";
import CustomChatbotListPage from "./pages/CustomChatbotList";
import CustomChatbotDetailPage from "./pages/CustomChatbotDetail";
import OrganizationListPage from "./pages/OrganizationList";
import OrganizationDetailPage from "./pages/OrganizationDetail";
import UserListPage from "./pages/UserList";
import UserDetailPage from "./pages/UserDetail";
import { AlertProvider } from "./contexts/AlertContext";
import GlobalAlert from "./components/GlobalAlert";

function App() {
  return (
    <AlertProvider>
      <GlobalAlert />
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/callback" element={<GoogleCallbackPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="p">
              {/*<Route path="chatbot" element={<ChatPage />} />*/}
              <Route path="asr" element={<AsrPage />} />
              <Route path="tts" element={<TtsPage />} />
              <Route path="gov-chatbot" element={<GovChatbotPage />} />
              <Route path="make-chatbot" element={<MakeChatbotPage />} />
              <Route path="voice-stream" element={<VoiceStreamPage />} />
              <Route path=":url_path" element={<CustomChatbotPage />} />
            </Route>
            <Route
              path="admin"
              element={
                <AdminGuard>
                  <AdminDashboardPage />
                </AdminGuard>
              }
            />
            <Route
              path="admin/custom-chatbot"
              element={
                <AdminGuard>
                  <CustomChatbotListPage />
                </AdminGuard>
              }
            />
            <Route
              path="admin/custom-chatbot/:id"
              element={
                <AdminGuard>
                  <CustomChatbotDetailPage />
                </AdminGuard>
              }
            />
            <Route
              path="admin/organizations"
              element={
                <AdminGuard>
                  <OrganizationListPage />
                </AdminGuard>
              }
            />
            <Route
              path="admin/organizations/:id"
              element={
                <AdminGuard>
                  <OrganizationDetailPage />
                </AdminGuard>
              }
            />
            <Route
              path="admin/users"
              element={
                <AuthGuard roleValidators={[isAdmin, isOrgAdmin]}>
                  <UserListPage />
                </AuthGuard>
              }
            />
            <Route
              path="admin/users/:id"
              element={
                <AuthGuard roleValidators={[isAdmin, isOrgAdmin]}>
                  <UserDetailPage />
                </AuthGuard>
              }
            />
          </Route>
        </Route>
      </Routes>
    </AlertProvider>
  );
}

export default App;
