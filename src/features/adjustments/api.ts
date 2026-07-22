import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/features/_shared/queryKeys";

export type AdjReason = "count" | "damage" | "loss" | "found" | "correction" | "other";
export type AdjStatus = "draft" | "pending_approval" | "approved" | "posted" | "rejected" | "cancelled";

export type StockAdjustment = {
  id: string;
  company_id: string;
  branch_id: string;
  warehouse_id: string;
  doc_no: string | null;
  reason: AdjReason;
  status: AdjStatus;
  notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdjustmentLine = {
  id: string;
  adjustment_id: string;
  product_id: string;
  bin_id: string | null;
  qty: number;
  uom: string | null;
  heat_no: string | null;
  lot_no: string | null;
  batch_no: string | null;
  serial_no: string | null;
  mtc_ref: string | null;
  coo_ref: string | null;
  notes: string | null;
};

export type AdjustmentUpsert = {
  company_id: string;
  branch_id: string;
  warehouse_id: string;
  reason: AdjReason;
  notes?: string | null;
  doc_no?: string | null;
};

export type LineUpsert = Omit<AdjustmentLine, "id" | "adjustment_id"> & { id?: string };

export async function fetchAdjustments(filters?: { status?: AdjStatus; branchId?: string }) {
  let q = supabase.from("stock_adjustments").select("*").order("created_at", { ascending: false });
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.branchId) q = q.eq("branch_id", filters.branchId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as StockAdjustment[];
}

export async function fetchAdjustmentLines(adjustmentId: string) {
  const { data, error } = await supabase
    .from("stock_adjustment_lines")
    .select("*")
    .eq("adjustment_id", adjustmentId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AdjustmentLine[];
}

export async function createAdjustment(payload: AdjustmentUpsert, lines: LineUpsert[]) {
  const { data, error } = await supabase.from("stock_adjustments").insert(payload).select("*").single();
  if (error) throw error;
  if (lines.length) {
    const withId = lines.map(({ id: _drop, ...l }) => ({ ...l, adjustment_id: data.id }));
    const { error: lErr } = await supabase.from("stock_adjustment_lines").insert(withId);
    if (lErr) throw lErr;
  }
  return data as StockAdjustment;
}

export async function updateAdjustmentStatus(id: string, status: AdjStatus) {
  const { data, error } = await supabase.from("stock_adjustments").update({ status }).eq("id", id).select("*").single();
  if (error) throw error;
  return data as StockAdjustment;
}

export async function requestAdjustmentApproval(id: string, branchId: string) {
  // Move to pending_approval and create an approval_request
  const { data: adj, error: aErr } = await supabase
    .from("stock_adjustments").update({ status: "pending_approval" as AdjStatus }).eq("id", id).select("*").single();
  if (aErr) throw aErr;
  const { data: user } = await supabase.auth.getUser();
  const { error: rErr } = await supabase.from("approval_requests").insert({
    entity_type: "stock_adjustment",
    entity_id: id,
    action: "post",
    branch_id: branchId,
    requested_by: user.user?.id ?? null,
  });
  if (rErr) throw rErr;
  return adj as StockAdjustment;
}

export async function postAdjustment(id: string) {
  const { data, error } = await supabase.rpc("post_stock_adjustment", { _adj_id: id });
  if (error) throw error;
  return data as unknown as StockAdjustment;
}

export function useAdjustments(filters?: { status?: AdjStatus; branchId?: string }) {
  return useQuery({
    queryKey: qk.adjustments.list(filters as Record<string, unknown> | undefined),
    queryFn: () => fetchAdjustments(filters),
    staleTime: 10_000,
  });
}

export function useAdjustmentLines(id: string) {
  return useQuery({
    queryKey: qk.adjustments.lines(id),
    queryFn: () => fetchAdjustmentLines(id),
    enabled: !!id,
  });
}

export function useCreateAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { payload: AdjustmentUpsert; lines: LineUpsert[] }) =>
      createAdjustment(args.payload, args.lines),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.adjustments.all });
    },
  });
}

export function usePostAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => postAdjustment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.adjustments.all });
      qc.invalidateQueries({ queryKey: qk.inventory.all });
    },
  });
}

export function useRequestAdjApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; branchId: string }) => requestAdjustmentApproval(args.id, args.branchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.adjustments.all });
      qc.invalidateQueries({ queryKey: qk.approvals.all });
    },
  });
}
