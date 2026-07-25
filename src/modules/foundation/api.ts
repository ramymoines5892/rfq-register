import { supabase } from "@/integrations/supabase/client";

// Types generation may lag behind these new tables; use `any` casts locally.
const sb = supabase as any;

// ============ FISCAL YEARS ============
export type FiscalYear = {
  id: string;
  company_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
  is_current: boolean;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

async function currentCompanyId(): Promise<string> {
  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No company found");
  return data.id;
}

export async function fetchFiscalYears(): Promise<FiscalYear[]> {
  const companyId = await currentCompanyId();
  const { data, error } = await sb
    .from("fiscal_years")
    .select("*")
    .eq("company_id", companyId)
    .order("start_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FiscalYear[];
}

export async function createFiscalYear(input: Omit<FiscalYear, "id" | "company_id" | "closed_at" | "created_at" | "updated_at">) {
  const companyId = await currentCompanyId();
  const { data, error } = await sb
    .from("fiscal_years")
    .insert({ ...input, company_id: companyId })
    .select()
    .single();
  if (error) throw error;
  return data as FiscalYear;
}

export async function updateFiscalYear(id: string, patch: Partial<FiscalYear>) {
  const { data, error } = await sb.from("fiscal_years").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as FiscalYear;
}

export async function deleteFiscalYear(id: string) {
  const { error } = await sb.from("fiscal_years").delete().eq("id", id);
  if (error) throw error;
}

export async function setCurrentFiscalYear(id: string) {
  const companyId = await currentCompanyId();
  // Clear then set
  await sb.from("fiscal_years").update({ is_current: false }).eq("company_id", companyId);
  const { error } = await sb.from("fiscal_years").update({ is_current: true }).eq("id", id);
  if (error) throw error;
}

// ============ NUMBERING ============
export type NumberingSeries = {
  id: string;
  company_id: string;
  branch_id: string | null;
  doc_type: string;
  prefix: string;
  year_segment: boolean;
  padding: number;
  next_seq: number;
  reset_policy: "never" | "yearly" | "monthly" | "daily";
  format_template: string;
  last_reset_period: string | null;
  label_ar: string | null;
  label_en: string | null;
};

export async function fetchNumberingSeries(): Promise<NumberingSeries[]> {
  const companyId = await currentCompanyId();
  const { data, error } = await sb
    .from("company_numbering")
    .select("*")
    .eq("company_id", companyId)
    .order("doc_type");
  if (error) throw error;
  return (data ?? []) as NumberingSeries[];
}

export async function upsertNumberingSeries(input: Partial<NumberingSeries> & { doc_type: string; prefix: string }) {
  const companyId = await currentCompanyId();
  const payload = { ...input, company_id: companyId };
  const { data, error } = await sb
    .from("company_numbering")
    .upsert(payload, { onConflict: input.branch_id ? "company_id,branch_id,doc_type" : "company_id,doc_type" })
    .select()
    .single();
  if (error) throw error;
  return data as NumberingSeries;
}

export async function updateNumberingSeries(id: string, patch: Partial<NumberingSeries>) {
  const { data, error } = await sb.from("company_numbering").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as NumberingSeries;
}

export async function deleteNumberingSeries(id: string) {
  const { error } = await sb.from("company_numbering").delete().eq("id", id);
  if (error) throw error;
}

export function previewNumbering(series: Pick<NumberingSeries, "prefix" | "padding" | "format_template" | "reset_policy" | "next_seq">) {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = (now.getMonth() + 1).toString().padStart(2, "0");
  const dd = now.getDate().toString().padStart(2, "0");
  let out = series.format_template || "{prefix}-{year}-{seq}";
  out = out.replaceAll("{prefix}", series.prefix);
  out = out.replaceAll("{year}", yyyy);
  out = out.replaceAll("{month}", mm);
  out = out.replaceAll("{day}", dd);
  out = out.replaceAll("{seq}", (series.next_seq || 1).toString().padStart(series.padding || 6, "0"));
  return out;
}

// ============ APPROVAL MATRIX ============
export type ApprovalMatrixRow = {
  id: string;
  company_id: string;
  entity_type: string;
  action: string;
  currency: string | null;
  min_amount: number | null;
  max_amount: number | null;
  stage_no: number;
  required_role_id: string | null;
  required_app_role: string | null;
  requires_all_approvers: boolean;
  is_active: boolean;
  notes: string | null;
};

export async function fetchApprovalMatrix(): Promise<ApprovalMatrixRow[]> {
  const companyId = await currentCompanyId();
  const { data, error } = await sb
    .from("approval_matrix")
    .select("*")
    .eq("company_id", companyId)
    .order("entity_type")
    .order("stage_no");
  if (error) throw error;
  return (data ?? []) as ApprovalMatrixRow[];
}

export async function createApprovalRule(input: Partial<ApprovalMatrixRow>) {
  const companyId = await currentCompanyId();
  const { data, error } = await sb
    .from("approval_matrix")
    .insert({ ...input, company_id: companyId })
    .select()
    .single();
  if (error) throw error;
  return data as ApprovalMatrixRow;
}

export async function updateApprovalRule(id: string, patch: Partial<ApprovalMatrixRow>) {
  const { data, error } = await sb.from("approval_matrix").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as ApprovalMatrixRow;
}

export async function deleteApprovalRule(id: string) {
  const { error } = await sb.from("approval_matrix").delete().eq("id", id);
  if (error) throw error;
}

// ============ PASSWORD POLICY ============
export type PasswordPolicy = {
  id: string;
  company_id: string;
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_number: boolean;
  require_symbol: boolean;
  expiry_days: number;
  prevent_reuse_last_n: number;
  lockout_attempts: number;
  lockout_minutes: number;
  session_timeout_minutes: number;
  require_2fa: boolean;
};

export async function fetchPasswordPolicy(): Promise<PasswordPolicy | null> {
  const companyId = await currentCompanyId();
  const { data, error } = await sb
    .from("password_policies")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  return data as PasswordPolicy | null;
}

export async function upsertPasswordPolicy(patch: Partial<PasswordPolicy>) {
  const companyId = await currentCompanyId();
  const { data, error } = await sb
    .from("password_policies")
    .upsert({ ...patch, company_id: companyId }, { onConflict: "company_id" })
    .select()
    .single();
  if (error) throw error;
  return data as PasswordPolicy;
}

// ============ BACKUP SETTINGS ============
export type BackupSettings = {
  id: string;
  company_id: string;
  enabled: boolean;
  retention_days: number;
  notify_email: string | null;
  last_backup_at: string | null;
};

export async function fetchBackupSettings(): Promise<BackupSettings | null> {
  const companyId = await currentCompanyId();
  const { data, error } = await sb
    .from("backup_settings")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  return data as BackupSettings | null;
}

export async function upsertBackupSettings(patch: Partial<BackupSettings>) {
  const companyId = await currentCompanyId();
  const { data, error } = await sb
    .from("backup_settings")
    .upsert({ ...patch, company_id: companyId }, { onConflict: "company_id" })
    .select()
    .single();
  if (error) throw error;
  return data as BackupSettings;
}

// ============ LOGIN HISTORY ============
export type LoginHistoryRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  failure_reason: string | null;
  created_at: string;
};

export async function fetchLoginHistory(limit = 100): Promise<LoginHistoryRow[]> {
  const { data, error } = await sb
    .from("login_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as LoginHistoryRow[];
}
