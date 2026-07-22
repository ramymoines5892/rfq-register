import { supabase } from "@/integrations/supabase/client";

export type Warehouse = {
  id: string;
  company_id: string;
  branch_id: string | null;
  name: string;
  name_ar: string | null;
  code: string | null;
  is_main: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WarehouseWithBranch = Warehouse & {
  branch_name: string | null;
  branch_name_ar: string | null;
  branch_code: string | null;
};

export type WarehouseUpsertPayload = Omit<
  Partial<Warehouse>,
  "id" | "created_at" | "updated_at"
> & { name: string };

export async function fetchWarehouses(branchId?: string | null): Promise<WarehouseWithBranch[]> {
  let q = supabase
    .from("warehouses")
    .select("*, branches!warehouses_branch_id_fkey(name, name_ar, code)")
    .order("is_main", { ascending: false })
    .order("created_at", { ascending: true });
  if (branchId) q = q.eq("branch_id", branchId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    company_id: r.company_id,
    branch_id: r.branch_id,
    name: r.name,
    name_ar: r.name_ar,
    code: r.code,
    is_main: r.is_main,
    is_active: r.is_active,
    created_at: r.created_at,
    updated_at: r.updated_at,
    branch_name: r.branches?.name ?? null,
    branch_name_ar: r.branches?.name_ar ?? null,
    branch_code: r.branches?.code ?? null,
  }));
}

export async function upsertWarehouse(id: string | null, payload: WarehouseUpsertPayload): Promise<Warehouse> {
  let companyId = payload.company_id;
  if (!id && !companyId) {
    const { data: c } = await supabase.from("companies").select("id").order("created_at").limit(1).maybeSingle();
    companyId = c?.id;
    if (!companyId) throw new Error("No company found");
  }

  // Enforce single main per branch: if setting is_main and branch_id present, clear siblings
  if (payload.is_main && payload.branch_id) {
    await supabase
      .from("warehouses")
      .update({ is_main: false })
      .eq("branch_id", payload.branch_id)
      .neq("id", id ?? "00000000-0000-0000-0000-000000000000");
  }

  if (id) {
    const { data, error } = await supabase
      .from("warehouses")
      .update({ ...payload, company_id: companyId })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Warehouse;
  }

  const { data, error } = await supabase
    .from("warehouses")
    .insert({ ...payload, company_id: companyId! })
    .select()
    .single();
  if (error) throw error;
  return data as Warehouse;
}

export async function deleteWarehouse(id: string): Promise<void> {
  const { error } = await supabase.from("warehouses").delete().eq("id", id);
  if (error) throw error;
}
