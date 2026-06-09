import { createContext } from "react";
import { LoginRequest } from "@/types/auth";

export type AuthState = {
  accessToken: string | null;
  role: string | null;
  organization_uuid: string | null;
  isAuthenticated: boolean;
};

export type AuthContextType = AuthState & {
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextType | null>(null);