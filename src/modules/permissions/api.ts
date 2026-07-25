import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppPermission = Database["public"]["Enums"]["app_permission"];

export type PermissionScope = "department" | "job_title" | "user";

/** All permissions the app knows about. */
export const ALL_PERMISSIONS: AppPermission[] = [
  "customers.view", "customers.create", "customers.edit", "customers.delete",
  "customers.manage", "customers.view_payment_info",
  "quotes.view_own", "quotes.view_team", "quotes.view_all", "quotes.view",
  "quotes.create", "quotes.edit", "quotes.delete", "quotes.assign",
  "quotes.manage", "quotes.approve",
  "workflows.view", "workflows.manage",
  "hr.view", "hr.manage",
  "warehouses.view", "warehouses.manage", "bins.manage",
  "inventory.view", "inventory.manage", "inventory.transfer",
  "inventory.transfer.create", "inventory.transfer.post", "inventory.transfer.cancel",
  "inventory.adjust.create", "inventory.adjust.approve",
  "approvals.view", "approvals.decide",
  "team.view", "team.manage",
  "users.manage_roles", "templates.manage",
  "notifications.view", "reports.view",
  "manage_customer_fields", "manage_form_fields",
];

/** Group by prefix for a nicer UI. */
export const PERMISSION_GROUPS: { key: string; ar: string; en: string; prefix: string[] }[] = [
  { key: "customers",  ar: "العملاء",       en: "Customers",  prefix: ["customers."] },
  { key: "quotes",     ar: "العروض",        en: "Quotes",     prefix: ["quotes."] },
  { key: "workflows",  ar: "التدفقات",      en: "Workflows",  prefix: ["workflows."] },
  { key: "hr",         ar: "الموارد البشرية", en: "HR",       prefix: ["hr.", "users.manage_roles", "team."] },
  { key: "warehouses", ar: "المخازن",       en: "Warehouses", prefix: ["warehouses.", "bins."] },
  { key: "inventory",  ar: "المخزون",       en: "Inventory",  prefix: ["inventory."] },
  { key: "approvals",  ar: "الاعتمادات",    en: "Approvals",  prefix: ["approvals."] },
  { key: "settings",   ar: "الإعدادات",     en: "Settings",   prefix: ["templates.", "manage_customer_fields", "manage_form_fields", "notifications.", "reports."] },
];

export function groupOf(perm: AppPermission): string {
  for (const g of PERMISSION_GROUPS) {
    if (g.prefix.some((p) => perm === p || perm.startsWith(p))) return g.key;
  }
  return "settings";
}

/* ─── Department permissions ─────────────────────────────────────── */

export async function fetchDeptPermissions(departmentId: string): Promise<AppPermission[]> {
  const { data, error } = await supabase
    .from("department_permissions")
    .select("permission")
    .eq("department_id", departmentId);
  if (error) throw error;
  return (data ?? []).map((r) => r.permission as AppPermission);
}

export async function grantDeptPermission(departmentId: string, permission: AppPermission): Promise<void> {
  const { error } = await supabase
    .from("department_permissions")
    .insert({ department_id: departmentId, permission });
  if (error) throw error;
}

export async function revokeDeptPermission(departmentId: string, permission: AppPermission): Promise<void> {
  const { error } = await supabase
    .from("department_permissions")
    .delete()
    .eq("department_id", departmentId)
    .eq("permission", permission);
  if (error) throw error;
}

/* ─── Job title permissions ──────────────────────────────────────── */

export async function fetchJobPermissions(jobTitleId: string): Promise<AppPermission[]> {
  const { data, error } = await supabase
    .from("job_title_permissions")
    .select("permission")
    .eq("job_title_id", jobTitleId);
  if (error) throw error;
  return (data ?? []).map((r) => r.permission as AppPermission);
}

export async function grantJobPermission(jobTitleId: string, permission: AppPermission): Promise<void> {
  const { error } = await supabase
    .from("job_title_permissions")
    .insert({ job_title_id: jobTitleId, permission });
  if (error) throw error;
}

export async function revokeJobPermission(jobTitleId: string, permission: AppPermission): Promise<void> {
  const { error } = await supabase
    .from("job_title_permissions")
    .delete()
    .eq("job_title_id", jobTitleId)
    .eq("permission", permission);
  if (error) throw error;
}

/* ─── Effective permissions for a user (with sources) ────────────── */

export type EffectivePerms = {
  own: Set<AppPermission>;
  fromDept: Set<AppPermission>;
  fromJob: Set<AppPermission>;
  deptName?: string | null;
  jobName?: string | null;
};

/**
 * Resolves the three permission sources for a user:
 *  - own = user_permissions
 *  - fromJob = job_title_permissions via profiles.job_title_id (or employees.position_id)
 *  - fromDept = department_permissions via profiles.department_id (or employees.department_id)
 */
export async function fetchEffectivePermissions(userId: string): Promise<EffectivePerms> {
  const own = new Set<AppPermission>();
  const fromDept = new Set<AppPermission>();
  const fromJob = new Set<AppPermission>();
  let deptName: string | null = null;
  let jobName: string | null = null;

  const { data: ownRows } = await supabase
    .from("user_permissions")
    .select("permission")
    .eq("user_id", userId);
  (ownRows ?? []).forEach((r) => own.add(r.permission as AppPermission));

  // Prefer profile links (Users), fall back to employees table if present.
  const { data: profile } = await supabase
    .from("profiles")
    .select("department_id, job_title_id")
    .eq("id", userId)
    .maybeSingle();

  let deptId = profile?.department_id ?? null;
  let jobId = profile?.job_title_id ?? null;

  if (!deptId || !jobId) {
    const { data: emp } = await supabase
      .from("employees")
      .select("department_id, position_id")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    deptId = deptId ?? emp?.department_id ?? null;
    jobId = jobId ?? emp?.position_id ?? null;
  }

  if (deptId) {
    const [dp, dn] = await Promise.all([
      supabase.from("department_permissions").select("permission").eq("department_id", deptId),
      supabase.from("departments").select("name, name_ar, name_en").eq("id", deptId).maybeSingle(),
    ]);
    (dp.data ?? []).forEach((r) => fromDept.add(r.permission as AppPermission));
    deptName = dn.data?.name_ar || dn.data?.name || dn.data?.name_en || null;
  }
  if (jobId) {
    const [jp, jn] = await Promise.all([
      supabase.from("job_title_permissions").select("permission").eq("job_title_id", jobId),
      supabase.from("job_titles").select("name, name_ar, name_en").eq("id", jobId).maybeSingle(),
    ]);
    (jp.data ?? []).forEach((r) => fromJob.add(r.permission as AppPermission));
    jobName = jn.data?.name_ar || jn.data?.name || jn.data?.name_en || null;
  }

  return { own, fromDept, fromJob, deptName, jobName };
}

/* ─── Bulk fetchers for HR table (effective badges) ─────────────── */

/** Map department_id → Set<permission>. One query. */
export async function fetchAllDeptPermissionsMap(): Promise<Map<string, Set<AppPermission>>> {
  const { data, error } = await supabase.from("department_permissions").select("department_id, permission");
  if (error) throw error;
  const map = new Map<string, Set<AppPermission>>();
  (data ?? []).forEach((r) => {
    const k = r.department_id as string;
    if (!map.has(k)) map.set(k, new Set());
    map.get(k)!.add(r.permission as AppPermission);
  });
  return map;
}

/** Map job_title_id → Set<permission>. */
export async function fetchAllJobPermissionsMap(): Promise<Map<string, Set<AppPermission>>> {
  const { data, error } = await supabase.from("job_title_permissions").select("job_title_id, permission");
  if (error) throw error;
  const map = new Map<string, Set<AppPermission>>();
  (data ?? []).forEach((r) => {
    const k = r.job_title_id as string;
    if (!map.has(k)) map.set(k, new Set());
    map.get(k)!.add(r.permission as AppPermission);
  });
  return map;
}

/** Map user_id → Set<personal permission>. */
export async function fetchAllUserPermissionsMap(): Promise<Map<string, Set<AppPermission>>> {
  const { data, error } = await supabase.from("user_permissions").select("user_id, permission");
  if (error) throw error;
  const map = new Map<string, Set<AppPermission>>();
  (data ?? []).forEach((r) => {
    const k = r.user_id as string;
    if (!map.has(k)) map.set(k, new Set());
    map.get(k)!.add(r.permission as AppPermission);
  });
  return map;
}

/** Recent permission audit entries across all scopes (admin only via RLS). */
export type GlobalAuditEntry = {
  id: string;
  actor_id: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  scope: "department" | "job_title" | "user";
  target_id: string;
  target_name: string | null;
  permission: AppPermission;
  action: "grant" | "revoke";
  created_at: string;
};

export async function fetchGlobalPermissionAudit(limit = 100): Promise<GlobalAuditEntry[]> {
  const { data, error } = await supabase
    .from("permission_audit_log")
    .select("id, actor_id, scope, target_id, target_name, permission, action, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const entries = (data ?? []) as GlobalAuditEntry[];
  const actorIds = Array.from(new Set(entries.map((e) => e.actor_id).filter(Boolean))) as string[];
  if (!actorIds.length) return entries;
  const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", actorIds);
  const map = new Map<string, { full_name: string | null; email: string }>();
  (profiles ?? []).forEach((p) => map.set(p.id, { full_name: p.full_name, email: p.email }));
  return entries.map((e) => {
    const a = e.actor_id ? map.get(e.actor_id) : null;
    return { ...e, actor_name: a?.full_name ?? null, actor_email: a?.email ?? null };
  });
}
