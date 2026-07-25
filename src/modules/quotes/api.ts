import { supabase } from "@/integrations/supabase/client";

export type ApprovalState = "none" | "in_progress" | "approved" | "rejected";
export type Decision = "pending" | "approved" | "rejected";

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? "";
}

export async function getCurrentUserId(): Promise<string> {
  return currentUserId();
}

export async function fetchDashboardBase() {
  const [{ data: qs }, { data: tpls }, { data: profs }, { data: cus }] = await Promise.all([
    supabase.from("quotes").select("*").is("deleted_at", null).order("received_date", { ascending: false }),
    supabase.from("workflow_templates").select("id, name").is("deleted_at", null),
    supabase.from("profiles").select("id, email, full_name"),
    supabase.from("customers").select("id, name, name_ar, name_en, tax_id, currency, terms").is("deleted_at", null).order("name"),
  ]);
  const uid = await currentUserId();
  return { quotes: qs ?? [], templates: tpls ?? [], profiles: profs ?? [], customers: cus ?? [], userId: uid };
}

export async function fetchAttachmentsAndApprovals(quoteIds: string[]) {
  const [{ data: atts }, { data: apps }] = await Promise.all([
    supabase.from("quote_attachments").select("*").in("quote_id", quoteIds).is("deleted_at", null),
    supabase.from("quote_approvals").select("*").in("quote_id", quoteIds),
  ]);
  return { attachments: atts ?? [], approvals: apps ?? [] };
}

export async function fetchStagesForTemplates(templateIds: string[]) {
  const { data } = await supabase.from("workflow_stages").select("*").in("template_id", templateIds).is("deleted_at", null).order("position");
  return data ?? [];
}

export async function softDeleteQuote(quoteId: string) {
  const uid = await currentUserId();
  return supabase.from("quotes").update({
    deleted_at: new Date().toISOString(),
    deleted_by: uid || null,
  }).eq("id", quoteId);
}

export async function createSignedAttachmentUrl(storagePath: string, expiresIn = 60) {
  return supabase.storage.from("quote-attachments").createSignedUrl(storagePath, expiresIn);
}

export async function fetchStageApprovers(stageId: string) {
  const { data } = await supabase.from("workflow_stage_approvers").select("*").eq("stage_id", stageId);
  return data ?? [];
}

export async function upsertQuoteApprovals(rows: Array<{ quote_id: string; stage_id: string; approver_id: string; decision: Decision }>) {
  return supabase.from("quote_approvals").upsert(rows, { onConflict: "quote_id,stage_id,approver_id" });
}

export async function updateQuoteApprovalState(quoteId: string, patch: { approval_state?: ApprovalState; current_stage_id?: string | null }) {
  return supabase.from("quotes").update(patch).eq("id", quoteId);
}

export async function updateApprovalDecision(approvalId: string, decision: Decision, comment: string | null) {
  return supabase.from("quote_approvals").update({
    decision,
    comment,
    decided_at: new Date().toISOString(),
  }).eq("id", approvalId);
}

export async function fetchApprovalsForQuote(quoteId: string) {
  const { data } = await supabase.from("quote_approvals").select("*").eq("quote_id", quoteId);
  return data ?? [];
}

export async function fetchQuoteAttachments(quoteId: string) {
  const { data } = await supabase.from("quote_attachments").select("*").eq("quote_id", quoteId);
  return data ?? [];
}

type QuotePayload = {
  supplier_name: string;
  reference_no: string | null;
  description: string | null;
  amount: number | null;
  currency: string;
  status: "new" | "reviewing" | "accepted" | "rejected" | "expired";
  received_date: string;
  expiry_date: string | null;
  notes: string | null;
  workflow_template_id: string | null;
  customer_id: string | null;
  terms_override: string | null;
};

export async function updateQuote(quoteId: string, payload: QuotePayload) {
  return supabase.from("quotes").update(payload).eq("id", quoteId);
}

export async function insertQuote(payload: QuotePayload, userId: string): Promise<string> {
  const { data, error } = await supabase.from("quotes").insert({ ...payload, user_id: userId }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function uploadQuoteAttachment(userId: string, quoteId: string, file: File) {
  const path = `${userId}/${quoteId}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from("quote-attachments").upload(path, file);
  if (upErr) throw upErr;
  const { error: aErr } = await supabase.from("quote_attachments").insert({
    quote_id: quoteId, user_id: userId, file_name: file.name, storage_path: path, mime_type: file.type, size_bytes: file.size,
  });
  if (aErr) throw aErr;
}

export async function softDeleteAttachment(attachmentId: string) {
  const uid = await currentUserId();
  return supabase.from("quote_attachments").update({
    deleted_at: new Date().toISOString(),
    deleted_by: uid || null,
  }).eq("id", attachmentId);
}
