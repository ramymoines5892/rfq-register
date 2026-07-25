import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/modules/_shared/queryKeys";
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

const invalidateHr = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["hr"] });
};

export function useApproveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => approveUser(userId),
    onSuccess: () => invalidateHr(qc),
  });
}

export function useBulkApproveUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) => bulkApproveUsers(userIds),
    onSuccess: () => invalidateHr(qc),
  });
}

export function useSetProfileStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { userId: string; status: "active" | "suspended" }) =>
      setProfileStatus(v.userId, v.status),
    onSuccess: () => invalidateHr(qc),
  });
}

export function useBulkSetProfileStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { userIds: string[]; status: "active" | "suspended" }) =>
      bulkSetProfileStatus(v.userIds, v.status),
    onSuccess: () => invalidateHr(qc),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      userId: string;
      patch: Partial<Database["public"]["Tables"]["profiles"]["Update"]>;
    }) => updateProfileFields(v.userId, v.patch),
    onSuccess: () => invalidateHr(qc),
  });
}

export function useUserPermissions(userId: string | null | undefined) {
  return useQuery({
    queryKey: qk.hr.userPermissions(userId ?? ""),
    queryFn: () => fetchUserPermissions(userId!),
    enabled: !!userId,
  });
}

function invalidateUserPerms(qc: ReturnType<typeof useQueryClient>, userId: string) {
  qc.invalidateQueries({ queryKey: qk.hr.userPermissions(userId) });
  qc.invalidateQueries({ queryKey: ["perms", "effective", userId] });
  qc.invalidateQueries({ queryKey: ["perms", "audit"] });
  qc.invalidateQueries({ queryKey: ["hr"] });
}

export function useGrantPermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { userId: string; permission: AppPermission }) =>
      grantUserPermission(v.userId, v.permission),
    onSuccess: (_d, v) => invalidateUserPerms(qc, v.userId),
  });
}

export function useRevokePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { userId: string; permission: AppPermission }) =>
      revokeUserPermission(v.userId, v.permission),
    onSuccess: (_d, v) => invalidateUserPerms(qc, v.userId),
  });
}
