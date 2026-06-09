import axiosInstance from "./axios";
import { API_ENDPOINTS } from "@/utils/api";
import { User, UsersResponse } from "@/types/user";

export type FetchUsersParams = {
  page?: number;
  page_size?: number;
  search?: string;
  sort_by?: "name" | "created_at";
  sort_order?: "asc" | "desc";
  organization_uuid?: string;
  is_active?: boolean;
};

export async function fetchUsers(
  params: FetchUsersParams = {},
): Promise<UsersResponse> {
  const res = await axiosInstance.get(API_ENDPOINTS.USER_LIST, { params });
  return res.data;
}

export async function fetchUserById(id: string): Promise<User> {
  const res = await axiosInstance.get(API_ENDPOINTS.USER_DETAIL(id));
  return res.data;
}

export async function changeUserOrganization({
  userId,
  organizationUuid,
}: {
  userId: string;
  organizationUuid: string;
}): Promise<User> {
  const res = await axiosInstance.put(
    API_ENDPOINTS.USER_CHANGE_ORG(userId),
    { organization_uuid: organizationUuid },
  );
  return res.data;
}

export async function blockUser(userId: string): Promise<User> {
  const res = await axiosInstance.put(API_ENDPOINTS.USER_BLOCK(userId));
  return res.data;
}

export async function unblockUser(userId: string): Promise<User> {
  const res = await axiosInstance.put(API_ENDPOINTS.USER_UNBLOCK(userId));
  return res.data;
}