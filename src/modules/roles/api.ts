import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppPermission = Database["public"]["Enums"]["app_permission"];
export type RoleScope = "department" | "job_title" | "branch" | "user";

export type CustomRole = {
  id: string;
  company_id: string | null;
  code: string | null;
  name_ar: string;
  name_en: string | null;
  description: string | null;
  color: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomRoleAssignment = {
  id: string;
  role_id: string;
  scope: RoleScope;
  target_id: string;
  created_at: string;
};

/* ─── Roles CRUD ─────────────────────────────── */

export async function fetchRoles(): Promise<CustomRole[]> {
  const { data, error } = await supabase
    .from("custom_roles" as never)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CustomRole[];
}

export async function createRole(input: {
  name_ar: string;
  name_en?: string | null;
  code?: string | null;
  description?: string | null;
  color?: string | null;
}): Promise<CustomRole> {
  const { data, error } = await supabase
    .from("custom_roles" as never)
    .insert(input as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as CustomRole;
}

export async function updateRole(id: string, patch: Partial<CustomRole>): Promise<void> {
  const { error } = await supabase.from("custom_roles" as never).update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function deleteRole(id: string): Promise<void> {
  const { error } = await supabase.from("custom_roles" as never).delete().eq("id", id);
  if (error) throw error;
}

/* ─── Role permissions ───────────────────────── */

export async function fetchRolePermissions(roleId: string): Promise<AppPermission[]> {
  const { data, error } = await supabase
    .from("custom_role_permissions" as never)
    .select("permission")
    .eq("role_id", roleId);
  if (error) throw error;
  return ((data ?? []) as Array<{ permission: AppPermission }>).map((r) => r.permission);
}

export async function setRolePermissions(roleId: string, perms: AppPermission[]): Promise<void> {
  const { error: eDel } = await supabase.from("custom_role_permissions" as never).delete().eq("role_id", roleId);
  if (eDel) throw eDel;
  if (!perms.length) return;
  const rows = perms.map((p) => ({ role_id: roleId, permission: p }));
  const { error } = await supabase.from("custom_role_permissions" as never).insert(rows as never);
  if (error) throw error;
}

/* ─── Assignments ────────────────────────────── */

export async function fetchRoleAssignments(roleId: string): Promise<CustomRoleAssignment[]> {
  const { data, error } = await supabase
    .from("custom_role_assignments" as never)
    .select("*")
    .eq("role_id", roleId);
  if (error) throw error;
  return (data ?? []) as unknown as CustomRoleAssignment[];
}

export async function addAssignment(roleId: string, scope: RoleScope, targetId: string): Promise<void> {
  const { error } = await supabase
    .from("custom_role_assignments" as never)
    .insert({ role_id: roleId, scope, target_id: targetId } as never);
  if (error) throw error;
}

export async function removeAssignment(id: string): Promise<void> {
  const { error } = await supabase.from("custom_role_assignments" as never).delete().eq("id", id);
  if (error) throw error;
}

/** Fetch every role assigned to a user directly or via their dept/job/branches. */
export async function fetchRolesForUser(userId: string): Promise<
  Array<{ role: CustomRole; via: RoleScope; source_name?: string | null }>
> {
  // Pull profile + employee + user_branches to resolve dept/job/branch ids.
  const [{ data: profile }, { data: emp }, { data: ubs }] = await Promise.all([
    supabase.from("profiles").select("department_id, job_title_id").eq("id", userId).maybeSingle(),
    supabase.from("employees").select("department_id, position_id").eq("user_id", userId).is("deleted_at", null).maybeSingle(),
    supabase.from("user_branches").select("branch_id").eq("user_id", userId),
  ]);

  const deptIds = [profile?.department_id, emp?.department_id].filter(Boolean) as string[];
  const jobIds = [profile?.job_title_id, emp?.position_id].filter(Boolean) as string[];
  const branchIds = (ubs ?? []).map((r) => r.branch_id).filter(Boolean) as string[];

  const orFilters: string[] = [`and(scope.eq.user,target_id.eq.${userId})`];
  if (deptIds.length) orFilters.push(`and(scope.eq.department,target_id.in.(${deptIds.join(",")}))`);
  if (jobIds.length) orFilters.push(`and(scope.eq.job_title,target_id.in.(${jobIds.join(",")}))`);
  if (branchIds.length) orFilters.push(`and(scope.eq.branch,target_id.in.(${branchIds.join(",")}))`);

  const { data: assigns, error } = await supabase
    .from("custom_role_assignments" as never)
    .select("*")
    .or(orFilters.join(","));
  if (error) throw error;
  const list = (assigns ?? []) as unknown as CustomRoleAssignment[];
  if (!list.length) return [];

  const roleIds = Array.from(new Set(list.map((a) => a.role_id)));
  const { data: roles } = await supabase.from("custom_roles" as never).select("*").in("id", roleIds);
  const roleMap = new Map<string, CustomRole>();
  ((roles ?? []) as unknown as CustomRole[]).forEach((r) => roleMap.set(r.id, r));

  return list
    .map((a) => {
      const role = roleMap.get(a.role_id);
      if (!role) return null;
      return { role, via: a.scope };
    })
    .filter(Boolean) as Array<{ role: CustomRole; via: RoleScope }>;
}
