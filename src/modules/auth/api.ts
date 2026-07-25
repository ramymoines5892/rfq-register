/**
 * Auth service — thin wrappers around `supabase.auth.*` and the
 * `profiles` table so routes never touch the auth client directly.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Id } from "@/shared/types/common";

export interface CurrentUser {
  id: Id;
  email: string;
  fullName: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: prof } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", data.user.id)
    .maybeSingle();

  return {
    id: data.user.id,
    email: data.user.email ?? "",
    fullName: prof?.full_name ?? null,
  };
}

export async function getCurrentUserRoles(): Promise<string[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id);
  return (data ?? []).map((r) => r.role as string);
}

export async function getCurrentUserPermissions(): Promise<string[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data } = await supabase
    .from("user_permissions")
    .select("permission")
    .eq("user_id", u.user.id);
  return (data ?? []).map((r) => r.permission as string);
}

export async function sendPasswordReset(email: string, redirectTo: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw error;
}
