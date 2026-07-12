import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/features/_shared/queryKeys";
import {
  approveUser,
  bulkApproveUsers,
  bulkSetProfileStatus,
  fetchCurrentUserId,
  fetchHrDashboard,
  fetchProfiles,
  fetchUserPermissions,
  fetchUserRoles,
  grantUserPermission,
  removeUserFromTeam,
  revokeUserPermission,
  setProfileStatus,
  setUserRole,
  updateProfileFields,
  type AppPermission,
  type AppRole,
} from "./api";
import type { Database } from "@/integrations/supabase/types";

export function useHrDashboard() {
  return useQuery({
    queryKey: ["hr", "dashboard"] as const,
    queryFn: fetchHrDashboard,
    staleTime: 15_000,
  });
}

export const profilesQueryOptions = queryOptions({
  queryKey: qk.hr.profiles(),
  queryFn: fetchProfiles,
  staleTime: 30_000,
});

export const userRolesQueryOptions = queryOptions({
  queryKey: ["hr", "user_roles", "all"] as const,
  queryFn: fetchUserRoles,
  staleTime: 30_000,
});

export const currentUserIdQueryOptions = queryOptions({
  queryKey: ["hr", "me"] as const,
  queryFn: fetchCurrentUserId,
  staleTime: 5 * 60_000,
});

export function useProfiles() {
  return useQuery(profilesQueryOptions);
}

export function useUserRoles() {
  return useQuery(userRolesQueryOptions);
}

export function useCurrentUserId() {
  return useQuery(currentUserIdQueryOptions);
}

export function useSetUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { userId: string; role: AppRole }) => setUserRole(v.userId, v.role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr"] }),
  });
}

export function useRemoveFromTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeUserFromTeam(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr"] }),
  });
}
