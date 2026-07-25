import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/modules/_shared/queryKeys";

export type TransferStatus = "draft" | "in_transit" | "completed" | "cancelled";

export type StockTransfer = {
  id: string;
  company_id: string;
  transfer_no: string;
  from_branch_id: string;
  to_branch_id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  status: TransferStatus;
  shipped_at: string | null;
  received_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TransferLine = {
  id: string;
  transfer_id: string;
  product_id: string;
  qty: number;
  uom: string | null;
  from_bin_id: string | null;
  to_bin_id: string | null;
  heat_no: string | null;
  lot_no: string | null;
  batch_no: string | null;
  serial_no: string | null;
  mtc_ref: string | null;
  coo_ref: string | null;
  notes: string | null;
};

export type TransferUpsert = {
  transfer_no?: string;
  from_branch_id: string;
  to_branch_id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  notes?: string | null;
  status?: TransferStatus;
};

export type LineUpsert = Omit<TransferLine, "id" | "transfer_id"> & { id?: string };

async function ensureCompanyId(): Promise<string> {
  const { data } = await supabase.from("companies").select("id").order("created_at").limit(1).maybeSingle();
  if (!data?.id) throw new Error("No company found");
  return data.id;
}

async function nextTransferNo(companyId: string): Promise<string> {
  const { count } = await supabase.from("stock_transfers").select("id", { head: true, count: "exact" }).eq("company_id", companyId);
  const n = String((count ?? 0) + 1).padStart(5, "0");
  return `TRN-${n}`;
}

export async function fetchTransfers(): Promise<StockTransfer[]> {
  const { data, error } = await supabase.from("stock_transfers").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StockTransfer[];
}

export async function fetchTransferDetail(id: string): Promise<{ transfer: StockTransfer; lines: TransferLine[] }> {
  const [{ data: t, error: e1 }, { data: lines, error: e2 }] = await Promise.all([
    supabase.from("stock_transfers").select("*").eq("id", id).maybeSingle(),
    supabase.from("stock_transfer_lines").select("*").eq("transfer_id", id).order("created_at"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (!t) throw new Error("Transfer not found");
  return { transfer: t as StockTransfer, lines: (lines ?? []) as TransferLine[] };
}

export async function createTransfer(payload: TransferUpsert): Promise<StockTransfer> {
  if (payload.from_warehouse_id === payload.to_warehouse_id) throw new Error("Source and destination warehouses must differ");
  const company_id = await ensureCompanyId();
  const transfer_no = payload.transfer_no || (await nextTransferNo(company_id));
  const { data, error } = await supabase.from("stock_transfers").insert({ ...payload, company_id, transfer_no }).select().single();
  if (error) throw error;
  return data as StockTransfer;
}

export async function updateTransfer(id: string, patch: Partial<TransferUpsert>): Promise<StockTransfer> {
  const { data, error } = await supabase.from("stock_transfers").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as StockTransfer;
}

export async function addLine(transferId: string, line: LineUpsert): Promise<TransferLine> {
  const { id: _ignore, ...rest } = line as any;
  const { data, error } = await supabase.from("stock_transfer_lines").insert({ ...rest, transfer_id: transferId }).select().single();
  if (error) throw error;
  return data as TransferLine;
}

export async function deleteLine(lineId: string): Promise<void> {
  const { error } = await supabase.from("stock_transfer_lines").delete().eq("id", lineId);
  if (error) throw error;
}

export async function postTransfer(id: string): Promise<StockTransfer> {
  const { data, error } = await supabase.rpc("post_stock_transfer", { _transfer_id: id });
  if (error) throw error;
  return data as StockTransfer;
}

export async function cancelTransfer(id: string): Promise<StockTransfer> {
  const { data, error } = await supabase.from("stock_transfers").update({ status: "cancelled" }).eq("id", id).select().single();
  if (error) throw error;
  return data as StockTransfer;
}

// Hooks
export function useTransfers() {
  return useQuery({ queryKey: qk.transfers.list(), queryFn: fetchTransfers, staleTime: 10_000 });
}
export function useTransferDetail(id: string | null) {
  return useQuery({
    queryKey: qk.transfers.detail(id ?? "none"),
    queryFn: () => fetchTransferDetail(id!),
    enabled: !!id,
    staleTime: 5_000,
  });
}
export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: TransferUpsert) => createTransfer(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.transfers.all }),
  });
}
export function useAddLine(transferId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (line: LineUpsert) => addLine(transferId, line),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.transfers.detail(transferId) }),
  });
}
export function useDeleteLine(transferId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lineId: string) => deleteLine(lineId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.transfers.detail(transferId) }),
  });
}
export function usePostTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => postTransfer(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: qk.transfers.all });
      qc.invalidateQueries({ queryKey: qk.transfers.detail(id) });
      qc.invalidateQueries({ queryKey: qk.inventory.all });
    },
  });
}
export function useCancelTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelTransfer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.transfers.all }),
  });
}
