import { fetchOrganizationById } from "@/api/organization";
import { Organization } from "@/types/organizations";
import { useQuery } from "@tanstack/react-query";

export function useOrganiztion(orgId: string){
return useQuery<Organization>({
    queryKey: ["organization", orgId],
    queryFn: () => fetchOrganizationById(orgId),
    enabled: !!orgId,
  });
}