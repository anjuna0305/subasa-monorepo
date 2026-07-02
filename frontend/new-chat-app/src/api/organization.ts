import { Organization } from "@/types/organizations";
import { API_ENDPOINTS } from "@/utils/api";
import axiosInstance from "./axios";

export const fetchOrganizations = async (): Promise<Organization[]> => {
  const res = await axiosInstance.get(API_ENDPOINTS.ORGANIZATION_LIST);
  return res.data;
};

export const fetchOrganizationById = async (
  id: string,
): Promise<Organization> => {
  const res = await axiosInstance.get(API_ENDPOINTS.ORGANIZATION_DETAIL(id));
  return res.data;
};

export const toggleOrganizationActive = async ({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}): Promise<Organization> => {
  const path = isActive
    ? API_ENDPOINTS.ORGANIZATION_DEACTIVATE(id)
    : API_ENDPOINTS.ORGANIZATION_ACTIVATE(id);
  const res = await axiosInstance.post(path);
  return res.data;
};

export const createOrganization = async (
  name: string,
): Promise<Organization> => {
  const res = await axiosInstance.post(API_ENDPOINTS.ORGANIZATION_LIST, {
    name,
    is_active: false,
  });
  return res.data;
};
