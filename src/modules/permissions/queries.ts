import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchDeptPermissions, fetchJobPermissions, fetchEffectivePermissions,
  grantDeptPermission, revokeDeptPermission,
  grantJobPermission, revokeJobPermission,
  fetchAllDeptPermissionsMap, fetchAllJobPermissionsMap, fetchAllUserPermissionsMap,
  fetchGlobalPermissionAudit,
  type AppPermission,
} from "./api";

export function useAllDeptPermissionsMap() {
  return useQuery({ queryKey: ["perms", "dept-map"] as const, queryFn: fetchAllDeptPermissionsMap, staleTime: 30_000 });
}
export function useAllJobPermissionsMap() {
  return useQuery({ queryKey: ["perms", "job-map"] as const, queryFn: fetchAllJobPermissionsMap, staleTime: 30_000 });
}
export function useAllUserPermissionsMap() {
  return useQuery({ queryKey: ["perms", "user-map"] as const, queryFn: fetchAllUserPermissionsMap, staleTime: 30_000 });
}
export function useGlobalPermissionAudit(limit = 100) {
  return useQuery({ queryKey: ["perm-audit", "global", limit] as const, queryFn: () => fetchGlobalPermissionAudit(limit), staleTime: 15_000 });
}

export function useDeptPermissions(id: string | null | undefined) {
  return useQuery({
    queryKey: ["perms", "dept", id ?? ""],
    queryFn: () => fetchDeptPermissions(id!),
    enabled: !!id,
  });
}

export function useJobPermissions(id: string | null | undefined) {
  return useQuery({
    queryKey: ["perms", "job", id ?? ""],
    queryFn: () => fetchJobPermissions(id!),
    enabled: !!id,
  });
}

export function useEffectivePermissions(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["perms", "effective", userId ?? ""],
    queryFn: () => fetchEffectivePermissions(userId!),
    enabled: !!userId,
  });
}

export function useToggleDeptPermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { departmentId: string; permission: AppPermission; grant: boolean }) => {
      if (v.grant) await grantDeptPermission(v.departmentId, v.permission);
      else await revokeDeptPermission(v.departmentId, v.permission);
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["perms", "dept", v.departmentId] });
      qc.invalidateQueries({ queryKey: ["perms", "effective"] });
    },
  });
}

export function useToggleJobPermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { jobTitleId: string; permission: AppPermission; grant: boolean }) => {
      if (v.grant) await grantJobPermission(v.jobTitleId, v.permission);
      else await revokeJobPermission(v.jobTitleId, v.permission);
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["perms", "job", v.jobTitleId] });
      qc.invalidateQueries({ queryKey: ["perms", "effective"] });
    },
  });
}
