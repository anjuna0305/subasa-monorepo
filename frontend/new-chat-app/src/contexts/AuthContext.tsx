import React, { useCallback, useMemo } from "react";
import {
  LoginRequest,
  GoogleLoginRequest,
  GoogleLoginResponse,
  LoginResponse,
} from "@/types/auth";
import { API_ENDPOINTS } from "@/utils/api";
import axiosInstance from "@/api/axios";
import { AuthContext, AuthState } from "./authContext";

const STORAGE_KEY_TOKEN = "subasa_access_token";
const STORAGE_KEY_ROLE = "subasa_role";
const STORAGE_ORGANIZATION_UUID = "subasa_organization";
const STORAGE_IS_NEW_USER = "subasa_is_new_user";

function getInitialAuthState(): AuthState {
  const token = localStorage.getItem(STORAGE_KEY_TOKEN);
  const role = localStorage.getItem(STORAGE_KEY_ROLE);
  const orgUuid = localStorage.getItem(STORAGE_ORGANIZATION_UUID);
  const isNewUser = localStorage.getItem(STORAGE_IS_NEW_USER) === "true";
  if (token) {
    return {
      accessToken: token,
      role,
      organization_uuid: orgUuid,
      isAuthenticated: true,
      isNewUser,
    };
  }
  return {
    accessToken: null,
    role: null,
    organization_uuid: null,
    isAuthenticated: false,
    isNewUser: false,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] =
    React.useState<AuthState>(getInitialAuthState);

  const updateAuthStates = useCallback(async (data: LoginResponse) => {
    localStorage.setItem(STORAGE_KEY_TOKEN, data.access_token);
    localStorage.setItem(STORAGE_KEY_ROLE, data.role);
    localStorage.setItem(
      STORAGE_ORGANIZATION_UUID,
      data.organization_uuid ?? "",
    );
    localStorage.setItem(STORAGE_IS_NEW_USER, String(data.is_new_user));

    setAuthState({
      accessToken: data.access_token,
      role: data.role,
      organization_uuid: data.organization_uuid,
      isAuthenticated: true,
      isNewUser: data.is_new_user,
    });
  }, []);

  const login = useCallback(
    async (credentials: LoginRequest) => {
      const response = await axiosInstance.post<LoginResponse>(
        API_ENDPOINTS.LOGIN,
        credentials,
      );

      const data = response.data;

      updateAuthStates(data);
    },
    [updateAuthStates],
  );

  const loginWithGoogle = useCallback(
    async (params: GoogleLoginRequest): Promise<boolean> => {
      const response = await axiosInstance.post<GoogleLoginResponse>(
        API_ENDPOINTS.GOOGLE_LOGIN,
        params,
      );

      const data = response.data;

      updateAuthStates(data);

      return data.is_new_user;
    },
    [updateAuthStates],
  );

  const logout = useCallback(() => {
    console.log("logout called");
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_ROLE);
    localStorage.removeItem(STORAGE_ORGANIZATION_UUID);
    localStorage.removeItem(STORAGE_IS_NEW_USER);
    setAuthState({
      accessToken: null,
      role: null,
      organization_uuid: null,
      isAuthenticated: false,
      isNewUser: false,
    });
  }, []);

  const value = useMemo(
    () => ({ ...authState, updateAuthStates, login, loginWithGoogle, logout }),
    [authState, updateAuthStates, login, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
