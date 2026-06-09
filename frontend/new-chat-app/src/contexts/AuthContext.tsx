import React, { useCallback, useMemo } from "react";
import { LoginRequest, LoginResponse } from "@/types/auth";
import { API_ENDPOINTS } from "@/utils/api";
import axiosInstance from "@/api/axios";
import { AuthContext, AuthState } from "./authContext";

const STORAGE_KEY_TOKEN = "subasa_access_token";
const STORAGE_KEY_ROLE = "subasa_role";
const STORAGE_ORGANIZATION_UUID = "subasa_organization";

function getInitialAuthState(): AuthState {
  const token = localStorage.getItem(STORAGE_KEY_TOKEN);
  const role = localStorage.getItem(STORAGE_KEY_ROLE);
  const orgUuid = localStorage.getItem(STORAGE_ORGANIZATION_UUID);
  if (token) {
    return {
      accessToken: token,
      role,
      organization_uuid: orgUuid,
      isAuthenticated: true,
    };
  }
  return {
    accessToken: null,
    role: null,
    organization_uuid: null,
    isAuthenticated: false,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] =
    React.useState<AuthState>(getInitialAuthState);

  const login = useCallback(async (credentials: LoginRequest) => {
    const response = await axiosInstance.post<LoginResponse>(
      API_ENDPOINTS.LOGIN,
      credentials,
    );

    const data = response.data;

    localStorage.setItem(STORAGE_KEY_TOKEN, data.access_token);
    localStorage.setItem(STORAGE_KEY_ROLE, data.role);
    localStorage.setItem(STORAGE_ORGANIZATION_UUID, data.organization_uuid);

    setAuthState({
      accessToken: data.access_token,
      role: data.role,
      organization_uuid: data.organization_uuid,
      isAuthenticated: true,
    });
  }, []);

  const logout = useCallback(() => {
    console.log("logout called");
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_ROLE);
    localStorage.removeItem(STORAGE_ORGANIZATION_UUID);
    setAuthState({
      accessToken: null,
      role: null,
      organization_uuid: null,
      isAuthenticated: false,
    });
  }, []);

  const value = useMemo(
    () => ({ ...authState, login, logout }),
    [authState, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
