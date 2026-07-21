import { supabase } from "@/integrations/supabase/client";

export type CompanyGeneral = {
  name: string;
  name_ar?: string | null;
  short_name?: string | null;
  code: string;
  tax_no?: string | null;
  cr_no?: string | null;
  vat_no?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  website?: string | null;
  logo_url?: string | null;
};

export type CompanyAdvanced = {
  country?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  address?: string | null;
  default_language?: string | null;
  timezone?: string | null;
  date_format?: string | null;
  number_format?: string | null;
  base_currency?: string | null;
  fiscal_year_start?: string | null;
  fiscal_year_end?: string | null;
  gm_name?: string | null;
  purchasing_manager?: string | null;
  sales_manager?: string | null;
  finance_manager?: string | null;
  notes?: string | null;
};

export type CompanyFeatures = {
  multi_branch: boolean;
  multi_warehouse: boolean;
  multi_currency: boolean;
  approval_workflow: boolean;
  audit_log: boolean;
  inventory: boolean;
  procurement: boolean;
  sales: boolean;
  finance: boolean;
  quality: boolean;
  traceability: boolean;
  heat_number: boolean;
  lot_number: boolean;
  batch_control: boolean;
  attachments: boolean;
  e_signatures: boolean;
};

export type NumberingRow = {
  doc_type: string;
  prefix: string;
  year_segment: boolean;
  padding: number;
  next_seq: number;
};

export type SetupDocument = {
  code: string;                 // preset code or slugified custom code
  name_ar: string;
  name_en: string;
  notify_days_before?: number;
  notify_repeat?: "none" | "daily" | "weekly" | "monthly";
  doc_number?: string | null;
  issue_date?: string | null;   // YYYY-MM-DD
  expiry_date?: string | null;
  notes?: string | null;
  file?: File | null;           // in-memory; uploaded only on final save
};

export type CreateCompanyPayload = {
  general: CompanyGeneral;
  advanced: CompanyAdvanced;
  features: CompanyFeatures;
  numbering: NumberingRow[];
  documents?: SetupDocument[];
};

export async function hasAnyCompany(): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_any_company");
  if (error) throw error;
  return !!data;
}

export async function fetchCurrentCompany() {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function uploadCompanyLogo(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("company-logos").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("company-logos").createSignedUrl
    ? await supabase.storage.from("company-logos").createSignedUrl(path, 60 * 60 * 24 * 365 * 10)
    : ({ data: null } as any);
  return data?.signedUrl ?? path;
}

export async function createCompanyBundle(payload: CreateCompanyPayload) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  // 1) Create company
  const { data: company, error: cErr } = await supabase
    .from("companies")
    .insert({ ...payload.general, ...payload.advanced, created_by: userId })
    .select()
    .single();
  if (cErr) throw cErr;
  const companyId = company.id;

  // 2) Features
  const { error: fErr } = await supabase
    .from("company_features")
    .insert({ company_id: companyId, ...payload.features });
  if (fErr) throw fErr;

  // 3) Numbering
  if (payload.numbering.length) {
    const { error: nErr } = await supabase
      .from("company_numbering")
      .insert(payload.numbering.map((n) => ({ ...n, company_id: companyId })));
    if (nErr) throw nErr;
  }

  // 4) Default Head Office branch
  const { data: branch, error: bErr } = await supabase
    .from("branches")
    .insert({ company_id: companyId, name: "Head Office", name_ar: "المقر الرئيسي", is_head_office: true })
    .select()
    .single();
  if (bErr) throw bErr;

  // 5) Default Main Warehouse
  const { error: wErr } = await supabase
    .from("warehouses")
    .insert({
      company_id: companyId,
      branch_id: branch.id,
      name: "Main Warehouse",
      name_ar: "المخزن الرئيسي",
      is_main: true,
    });
  if (wErr) throw wErr;

  return company;
}
