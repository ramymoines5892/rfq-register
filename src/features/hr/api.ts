import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type AppPermission = Database["public"]["Enums"]["app_permission"];
export type ProfileStatus = Database["public"]["Enums"]["profile_status"];

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  status?: ProfileStatus;
  department_id?: string | null;
  job_title_id?: string | null;
  manager_id?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
};

export type UserRole = { id: string; user_id: string; role: AppRole };

/** All profiles with id/email/full_name — used by team roster and pickers. */
export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, status")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Profile[];
}

/** All user_roles rows — global list; the caller filters/derives their own role. */
export async function fetchUserRoles(): Promise<UserRole[]> {
  const { data, error } = await supabase.from("user_roles").select("id, user_id, role");
  if (error) throw error;
  return (data ?? []) as UserRole[];
}

/** Replace a user's role with `newRole`, removing any others. */
export async function setUserRole(userId: string, newRole: AppRole): Promise<void> {
  const { data: existing, error: e1 } = await supabase
    .from("user_roles")
    .select("id, role")
    .eq("user_id", userId);
  if (e1) throw e1;
  const rows = (existing ?? []) as Array<{ id: string; role: AppRole }>;
  for (const r of rows) {
    if (r.role !== newRole) {
      const { error } = await supabase.from("user_roles").delete().eq("id", r.id);
      if (error) throw error;
    }
  }
  if (!rows.some((r) => r.role === newRole)) {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (error) throw error;
  }
}

/** Remove a user from the team entirely. */
export async function removeUserFromTeam(userId: string): Promise<void> {
  const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
  if (error) throw error;
}

/** Current auth uid (or empty string when signed out). */
export async function fetchCurrentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? "";
}

/** Aggregate load for the HR dashboard: profiles + roles + departments + job titles. */
export async function fetchHrDashboard() {
  const [p, r, d, j, me] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("user_roles").select("user_id, role"),
    supabase.from("departments").select("*").is("deleted_at", null).order("name"),
    supabase.from("job_titles").select("*").is("deleted_at", null).order("name"),
    fetchCurrentUserId(),
  ]);
  if (p.error) throw p.error;
  if (r.error) throw r.error;
  if (d.error) throw d.error;
  if (j.error) throw j.error;
  return {
    profiles: (p.data ?? []) as import("@/integrations/supabase/types").Database["public"]["Tables"]["profiles"]["Row"][],
    roles: (r.data ?? []) as Array<{ user_id: string; role: AppRole }>,
    departments: (d.data ?? []) as import("@/integrations/supabase/types").Database["public"]["Tables"]["departments"]["Row"][],
    jobTitles: (j.data ?? []) as import("@/integrations/supabase/types").Database["public"]["Tables"]["job_titles"]["Row"][],
    me,
  };
}
