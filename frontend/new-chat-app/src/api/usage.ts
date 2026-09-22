import axiosInstance from "@/api/axios";
import { API_ENDPOINTS } from "@/utils/api";
import { UsageSummary } from "@/types/usage";

export async function fetchUsageSummary(): Promise<UsageSummary> {
  const response = await axiosInstance.get<UsageSummary>(
    API_ENDPOINTS.USAGE_SUMMARY,
  );
  return response.data;
}
