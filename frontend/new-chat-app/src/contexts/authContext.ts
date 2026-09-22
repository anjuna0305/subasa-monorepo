import { createContext } from "react";
import { LoginRequest, GoogleLoginRequest, LoginResponse } from "@/types/auth";

export type AuthState = {
  accessToken: string | null;
  role: string | null;
  organization_uuid: string | null;
  isAuthenticated: boolean;
  isNewUser: boolean;
};

export type AuthContextType = AuthState & {
  updateAuthStates: (data: LoginResponse) => void;
  login: (credentials: LoginRequest) => Promise<void>;
  loginWithGoogle: (params: GoogleLoginRequest) => Promise<boolean>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextType | null>(null);
