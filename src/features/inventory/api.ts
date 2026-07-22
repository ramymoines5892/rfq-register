import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/features/_shared/queryKeys";

export type InventoryBalance = {
  company_id: string;
  branch_id: string;
  warehouse_id: string;
  product_id: string;
  balance: number;
  last_movement_at: string | null;
  movement_count: number;
  product_code?: string | null;
  product_name_ar?: string | null;
  product_name_en?: string | null;
  product_uom?: string | null;
  warehouse_name?: string | null;
  warehouse_name_ar?: string | null;
  branch_name?: string | null;
  branch_name_ar?: string | null;
};

export type StockMovement = {
  id: string;
  branch_id: string;
  warehouse_id: string;
  bin_id: string | null;
  product_id: string;
  movement_type: string;
  qty: number;
  uom: string | null;
  heat_no: string | null;
  lot_no: string | null;
  batch_no: string | null;
  serial_no: string | null;
  mtc_ref: string | null;
  coo_ref: string | null;
  reference_type: string | null;
  reference_id: string | null;
  transfer_id: string | null;
  notes: string | null;
  created_at: string;
};

export async function fetchInventoryBalances(filters?: { warehouseId?: string; productId?: string; branchId?: string }): Promise<InventoryBalance[]> {
  let q = supabase.from("inventory_balances").select("*");
  if (filters?.warehouseId) q = q.eq("warehouse_id", filters.warehouseId);
  if (filters?.productId) q = q.eq("product_id", filters.productId);
  if (filters?.branchId) q = q.eq("branch_id", filters.branchId);
  const { data: bal, error } = await q;
  if (error) throw error;
  const rows = (bal ?? []) as InventoryBalance[];
  if (rows.length === 0) return rows;

  // Enrich with product/warehouse/branch names in a single pass each
  const prodIds = Array.from(new Set(rows.map((r) => r.product_id)));
  const whIds = Array.from(new Set(rows.map((r) => r.warehouse_id)));
  const brIds = Array.from(new Set(rows.map((r) => r.branch_id)));

  const [{ data: prods }, { data: whs }, { data: brs }] = await Promise.all([
    supabase.from("products").select("id, code, name_ar, name_en, uom").in("id", prodIds),
    supabase.from("warehouses").select("id, name, name_ar").in("id", whIds),
    supabase.from("branches").select("id, name, name_ar").in("id", brIds),
  ]);

  const pMap = new Map((prods ?? []).map((p: any) => [p.id, p]));
  const wMap = new Map((whs ?? []).map((w: any) => [w.id, w]));
  const bMap = new Map((brs ?? []).map((b: any) => [b.id, b]));

  return rows.map((r) => ({
    ...r,
    product_code: pMap.get(r.product_id)?.code ?? null,
    product_name_ar: pMap.get(r.product_id)?.name_ar ?? null,
    product_name_en: pMap.get(r.product_id)?.name_en ?? null,
    product_uom: pMap.get(r.product_id)?.uom ?? null,
    warehouse_name: wMap.get(r.warehouse_id)?.name ?? null,
    warehouse_name_ar: wMap.get(r.warehouse_id)?.name_ar ?? null,
    branch_name: bMap.get(r.branch_id)?.name ?? null,
    branch_name_ar: bMap.get(r.branch_id)?.name_ar ?? null,
  }));
}

export async function fetchMovements(productId?: string, warehouseId?: string, limit = 100): Promise<StockMovement[]> {
  let q = supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(limit);
  if (productId) q = q.eq("product_id", productId);
  if (warehouseId) q = q.eq("warehouse_id", warehouseId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as StockMovement[];
}

export function useInventoryBalances(filters?: { warehouseId?: string; productId?: string; branchId?: string }) {
  return useQuery({
    queryKey: qk.inventory.balances(filters),
    queryFn: () => fetchInventoryBalances(filters),
    staleTime: 10_000,
  });
}

export function useMovements(productId?: string, warehouseId?: string) {
  return useQuery({
    queryKey: qk.inventory.movements(productId, warehouseId),
    queryFn: () => fetchMovements(productId, warehouseId),
    staleTime: 10_000,
  });
}
