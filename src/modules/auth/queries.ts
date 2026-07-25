import { useQuery } from "@tanstack/react-query";
import { STALE_TIME } from "@/shared/constants/app";
import {
  getCurrentUser,
  getCurrentUserPermissions,
  getCurrentUserRoles,
} from "./api";

export const authKeys = {
  currentUser: ["auth", "currentUser"] as const,
  roles: ["auth", "roles"] as const,
  permissions: ["auth", "permissions"] as const,
};

export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.currentUser,
    queryFn: getCurrentUser,
    staleTime: STALE_TIME.medium,
  });
}

export function useCurrentUserRoles() {
  return useQuery({
    queryKey: authKeys.roles,
    queryFn: getCurrentUserRoles,
    staleTime: STALE_TIME.medium,
  });
}

export function useCurrentUserPermissions() {
  return useQuery({
    queryKey: authKeys.permissions,
    queryFn: getCurrentUserPermissions,
    staleTime: STALE_TIME.medium,
  });
}
