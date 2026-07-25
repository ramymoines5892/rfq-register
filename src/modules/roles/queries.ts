import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchRoles, createRole, updateRole, deleteRole,
  fetchRolePermissions, setRolePermissions,
  fetchRoleAssignments, addAssignment, removeAssignment,
  fetchRolesForUser,
  type CustomRole, type AppPermission, type RoleScope,
} from "./api";

export function useRoles() {
  return useQuery({ queryKey: ["custom-roles"] as const, queryFn: fetchRoles, staleTime: 30_000 });
}

export function useRolePermissions(roleId: string | null | undefined) {
  return useQuery({
    queryKey: ["custom-role-perms", roleId ?? ""] as const,
    queryFn: () => fetchRolePermissions(roleId!),
    enabled: !!roleId,
  });
}

export function useRoleAssignments(roleId: string | null | undefined) {
  return useQuery({
    queryKey: ["custom-role-assigns", roleId ?? ""] as const,
    queryFn: () => fetchRoleAssignments(roleId!),
    enabled: !!roleId,
  });
}

export function useUserRoles(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["custom-roles-for-user", userId ?? ""] as const,
    queryFn: () => fetchRolesForUser(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Parameters<typeof createRole>[0]) => createRole(v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-roles"] }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; patch: Partial<CustomRole> }) => updateRole(v.id, v.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-roles"] }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-roles"] }),
  });
}

export function useSetRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { roleId: string; perms: AppPermission[] }) => setRolePermissions(v.roleId, v.perms),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["custom-role-perms", v.roleId] });
      qc.invalidateQueries({ queryKey: ["custom-roles-for-user"] });
    },
  });
}

export function useAddAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { roleId: string; scope: RoleScope; targetId: string }) =>
      addAssignment(v.roleId, v.scope, v.targetId),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["custom-role-assigns", v.roleId] });
      qc.invalidateQueries({ queryKey: ["custom-roles-for-user"] });
    },
  });
}

export function useRemoveAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; roleId: string }) => removeAssignment(v.id),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["custom-role-assigns", v.roleId] });
      qc.invalidateQueries({ queryKey: ["custom-roles-for-user"] });
    },
  });
}
