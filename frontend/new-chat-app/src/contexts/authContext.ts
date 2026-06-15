import { createContext } from "react";
import { LoginRequest, GoogleLoginRequest } from "@/types/auth";

export type AuthState = {
  accessToken: string | null;
  role: string | null;
  organization_uuid: string | null;
  isAuthenticated: boolean;
  isNewUser: boolean;
};

export type AuthContextType = AuthState & {
  login: (credentials: LoginRequest) => Promise<void>;
  loginWithGoogle: (params: GoogleLoginRequest) => Promise<boolean>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextType | null>(null);