import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/features/_shared/queryKeys";

export type WarehouseBin = {
  id: string;
  company_id: string;
  branch_id: string;
  warehouse_id: string;
  code: string;
  name_ar: string | null;
  name_en: string | null;
  aisle: string | null;
  rack: string | null;
  shelf: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BinUpsert = {
  warehouse_id: string;
  branch_id: string;
  code: string;
  name_ar?: string | null;
  name_en?: string | null;
  aisle?: string | null;
  rack?: string | null;
  shelf?: string | null;
  is_active?: boolean;
  notes?: string | null;
};

export async function fetchBins(warehouseId?: string | null): Promise<WarehouseBin[]> {
  let q = supabase.from("warehouse_bins").select("*").order("code");
  if (warehouseId) q = q.eq("warehouse_id", warehouseId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as WarehouseBin[];
}

async function ensureCompanyId(): Promise<string> {
  const { data } = await supabase.from("companies").select("id").order("created_at").limit(1).maybeSingle();
  if (!data?.id) throw new Error("No company found");
  return data.id;
}

export async function upsertBin(id: string | null, payload: BinUpsert): Promise<WarehouseBin> {
  if (!payload.code?.trim()) throw new Error("Code is required");
  if (!payload.warehouse_id || !payload.branch_id) throw new Error("Warehouse & branch required");
  if (id) {
    const { data, error } = await supabase.from("warehouse_bins").update(payload).eq("id", id).select().single();
    if (error) throw error;
    return data as WarehouseBin;
  }
  const company_id = await ensureCompanyId();
  const { data, error } = await supabase.from("warehouse_bins").insert({ ...payload, company_id }).select().single();
  if (error) throw error;
  return data as WarehouseBin;
}

export async function deleteBin(id: string): Promise<void> {
  const { error } = await supabase.from("warehouse_bins").delete().eq("id", id);
  if (error) throw error;
}

export function useBins(warehouseId?: string | null) {
  return useQuery<WarehouseBin[]>({
    queryKey: qk.bins.list(warehouseId),
    queryFn: () => fetchBins(warehouseId),
    enabled: !!warehouseId,
    staleTime: 15_000,
  });
}
export function useUpsertBin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string | null; payload: BinUpsert }) => upsertBin(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.bins.all }),
  });
}
export function useDeleteBin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBin(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.bins.all }),
  });
}
