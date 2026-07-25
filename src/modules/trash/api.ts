import { supabase } from "@/integrations/supabase/client";

export type DeletedRow = {
  id: string;
  deleted_at: string;
  deleted_by: string | null;
  [k: string]: unknown;
};

export type ProfileLite = { id: string; full_name: string | null; email: string };

export type OwnerCheck = { isOwner: boolean; email: string };

export async function fetchOwnerCheck(): Promise<OwnerCheck> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { isOwner: false, email: "" };
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id);
  return {
    isOwner: !!roles?.some((r) => r.role === "owner"),
    email: u.user.email ?? "",
  };
}

export async function fetchDeletedRows(
  tableKey: string,
): Promise<{ rows: DeletedRow[]; profiles: Record<string, ProfileLite> }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from as any)(tableKey)
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as DeletedRow[];
  const actorIds = Array.from(
    new Set(rows.map((r) => r.deleted_by).filter(Boolean)),
  ) as string[];
  let profiles: Record<string, ProfileLite> = {};
  if (actorIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", actorIds);
    for (const p of profs ?? []) profiles[p.id] = p as ProfileLite;
  }
  return { rows, profiles };
}

export async function restoreRow(tableKey: string, id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)(tableKey)
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", id);
  if (error) throw error;
}

export async function purgeRow(
  tableKey: string,
  id: string,
  email: string,
  password: string,
) {
  const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password });
  if (verifyErr) throw new Error("BAD_PASSWORD");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)(tableKey).delete().eq("id", id);
  if (error) throw error;
}
