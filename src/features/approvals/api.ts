import { supabase as _supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/features/_shared/queryKeys";

const supabase = _supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";
export type ApprovalEntity = "stock_transfer" | "stock_adjustment";
export type ApprovalAction = "post" | "cancel" | "delete";

export type ApprovalRequest = {
  id: string;
  company_id: string | null;
  branch_id: string | null;
  entity_type: ApprovalEntity;
  entity_id: string;
  action: ApprovalAction;
  status: ApprovalStatus;
  requested_by: string | null;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export async function fetchApprovals(status?: ApprovalStatus) {
  let q = supabase.from("approval_requests").select("*").order("requested_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ApprovalRequest[];
}

export async function decideApproval(id: string, approve: boolean, note?: string) {
  const { data, error } = await supabase.rpc("decide_approval", { _req_id: id, _approve: approve, _note: note ?? null });
  if (error) throw error;
  return data as unknown as ApprovalRequest;
}

export function useApprovals(status?: ApprovalStatus) {
  return useQuery({
    queryKey: qk.approvals.list(status),
    queryFn: () => fetchApprovals(status),
    staleTime: 10_000,
  });
}

export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; approve: boolean; note?: string }) =>
      decideApproval(args.id, args.approve, args.note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.approvals.all });
      qc.invalidateQueries({ queryKey: qk.adjustments.all });
      qc.invalidateQueries({ queryKey: qk.transfers.all });
      qc.invalidateQueries({ queryKey: qk.inventory.all });
    },
  });
}
