import { getUserMe } from "@/api/user";
import { User } from "@/types/user";
import { useQuery } from "@tanstack/react-query";

export function useUser() {
  return useQuery<User>({
    queryKey: ["user"],
    queryFn: () => getUserMe(),
  });
}
