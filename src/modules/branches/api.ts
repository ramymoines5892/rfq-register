import { supabase } from "@/integrations/supabase/client";

export type Branch = {
  id: string;
  company_id: string;
  name: string;
  name_ar: string | null;
  code: string | null;
  is_head_office: boolean;
  is_active: boolean;
  country: string | null;
  state: string | null;
  city: string | null;
  postal_code: string | null;
  address_line: string | null;
  phone: string | null;
  mobile: string | null;
  fax: string | null;
  email: string | null;
  website: string | null;
  timezone: string | null;
  base_currency: string | null;
  manager_employee_id: string | null;
  position: number;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BranchWithCounts = Branch & {
  employees_count: number;
  warehouses_count: number;
  users_count: number;
};

export type BranchAssignment = {
  user_id: string;
  branch_id: string;
  is_default: boolean;
};

export type UserLite = {
  id: string;
  full_name: string | null;
  email: string | null;
};

// ─── Reads ───────────────────────────────────────────────────────────────

export async function fetchBranches(): Promise<BranchWithCounts[]> {
  const { data: rows, error } = await supabase
    .from("branches")
    .select("*")
    .is("deleted_at", null)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;

  const ids = (rows ?? []).map((r) => r.id);
  if (!ids.length) return [];

  const [empRes, whRes, ubRes] = await Promise.all([
    supabase.from("employees").select("branch_id").in("branch_id", ids).is("deleted_at", null),
    supabase.from("warehouses").select("branch_id").in("branch_id", ids),
    supabase.from("user_branches").select("branch_id").in("branch_id", ids),
  ]);

  const count = <T extends { branch_id: string | null }>(arr: T[] | null | undefined) => {
    const m = new Map<string, number>();
    (arr ?? []).forEach((r) => { if (r.branch_id) m.set(r.branch_id, (m.get(r.branch_id) ?? 0) + 1); });
    return m;
  };
  const emp = count(empRes.data as any);
  const wh  = count(whRes.data as any);
  const ub  = count(ubRes.data as any);

  return (rows ?? []).map((r) => ({
    ...(r as Branch),
    employees_count:  emp.get(r.id) ?? 0,
    warehouses_count: wh.get(r.id)  ?? 0,
    users_count:      ub.get(r.id)  ?? 0,
  }));
}

export async function fetchAllUsers(): Promise<UserLite[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as UserLite[];
}

export async function fetchBranchAssignments(branchId: string): Promise<BranchAssignment[]> {
  const { data, error } = await supabase
    .from("user_branches")
    .select("user_id, branch_id, is_default")
    .eq("branch_id", branchId);
  if (error) throw error;
  return (data ?? []) as BranchAssignment[];
}

// ─── Mutations ───────────────────────────────────────────────────────────

export type BranchUpsertPayload = Omit<
  Partial<Branch>,
  "id" | "created_at" | "updated_at" | "deleted_at"
> & { name: string };

export async function upsertBranch(id: string | null, payload: BranchUpsertPayload): Promise<Branch> {
  // Resolve company_id from the (single) existing company if we're creating.
  let companyId = payload.company_id;
  if (!id && !companyId) {
    const { data: c } = await supabase.from("companies").select("id").order("created_at").limit(1).maybeSingle();
    companyId = c?.id;
    if (!companyId) throw new Error("No company found");
  }

  // If setting head office, unset the flag on all other branches (single head office per company)
  if (payload.is_head_office) {
    await supabase.from("branches").update({ is_head_office: false }).eq("company_id", companyId!).neq("id", id ?? "00000000-0000-0000-0000-000000000000");
  }

  if (id) {
    const { data, error } = await supabase.from("branches").update({ ...payload, company_id: companyId }).eq("id", id).select().single();
    if (error) throw error;
    return data as Branch;
  }
  const { data, error } = await supabase.from("branches").insert({ ...payload, company_id: companyId! }).select().single();
  if (error) throw error;
  return data as Branch;
}

export async function setBranchAssignments(branchId: string, assignments: BranchAssignment[]): Promise<void> {
  // Replace all rows for this branch
  const { error: delErr } = await supabase.from("user_branches").delete().eq("branch_id", branchId);
  if (delErr) throw delErr;
  if (!assignments.length) return;

  // If any assignment is default, first clear defaults for those users on other branches
  const defaultUsers = assignments.filter((a) => a.is_default).map((a) => a.user_id);
  if (defaultUsers.length) {
    await supabase.from("user_branches").update({ is_default: false }).in("user_id", defaultUsers);
  }

  const rows = assignments.map((a) => ({
    user_id: a.user_id,
    branch_id: branchId,
    is_default: !!a.is_default,
  }));
  const { error: insErr } = await supabase.from("user_branches").insert(rows);
  if (insErr) throw insErr;
}

/**
 * Soft-delete a branch and transfer all its dependencies to the target branch.
 * Client-side sequence (admin-only, low concurrency): move employees, warehouses,
 * user assignments; drop per-branch numbering; then mark source as deleted.
 */
export async function deleteBranchWithTransfer(sourceId: string, targetId: string): Promise<void> {
  if (sourceId === targetId) throw new Error("Target branch must differ from source");

  // Employees → target
  const { error: e1 } = await supabase.from("employees").update({ branch_id: targetId }).eq("branch_id", sourceId);
  if (e1) throw e1;

  // Warehouses → target
  const { error: e2 } = await supabase.from("warehouses").update({ branch_id: targetId }).eq("branch_id", sourceId);
  if (e2) throw e2;

  // Users assigned to source: move to target, dedup vs existing target assignments
  const { data: sourceUsers, error: e3a } = await supabase.from("user_branches").select("user_id, is_default").eq("branch_id", sourceId);
  if (e3a) throw e3a;
  if (sourceUsers?.length) {
    const uids = sourceUsers.map((u) => u.user_id);
    const { data: existing } = await supabase.from("user_branches").select("user_id").eq("branch_id", targetId).in("user_id", uids);
    const existingSet = new Set((existing ?? []).map((r) => r.user_id));
    const toCreate = sourceUsers
      .filter((u) => !existingSet.has(u.user_id))
      .map((u) => ({ user_id: u.user_id, branch_id: targetId, is_default: !!u.is_default }));
    // Delete source rows first (releases the unique)
    const { error: eDel } = await supabase.from("user_branches").delete().eq("branch_id", sourceId);
    if (eDel) throw eDel;
    if (toCreate.length) {
      const { error: eIns } = await supabase.from("user_branches").insert(toCreate);
      if (eIns) throw eIns;
    }
  }

  // Numbering: drop per-branch numbering rows for source (they become the target's own)
  await supabase.from("company_numbering").delete().eq("branch_id", sourceId);

  // Finally: soft-delete source
  const { error: eFin } = await supabase.from("branches").update({ deleted_at: new Date().toISOString(), is_active: false }).eq("id", sourceId);
  if (eFin) throw eFin;
}
