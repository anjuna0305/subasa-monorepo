import { getUserMe } from "@/api/user";
import { Organization } from "@/types/organizations";
import { useQuery } from "@tanstack/react-query";

export function useUser() {
  return useQuery<Organization>({
    queryKey: ["user"],
    queryFn: () => getUserMe(),
  });
}
