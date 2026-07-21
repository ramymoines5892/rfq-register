import { supabase } from "@/integrations/supabase/client";

export type ContactEntry = {
  value: string;
  label?: string | null;
  is_primary?: boolean;
};

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
  fax?: string | null;
  website?: string | null;
  logo_url?: string | null;
  emails?: ContactEntry[];
  phones?: ContactEntry[];
  mobiles?: ContactEntry[];
  faxes?: ContactEntry[];
  websites?: ContactEntry[];
};

export function pickPrimary(list?: ContactEntry[] | null): string | null {
  if (!list?.length) return null;
  const clean = list.filter((e) => (e?.value ?? "").trim());
  if (!clean.length) return null;
  return (clean.find((e) => e.is_primary) ?? clean[0]).value.trim();
}

function sanitizeContacts(list?: ContactEntry[] | null): ContactEntry[] {
  if (!list?.length) return [];
  const clean = list
    .map((e) => ({ value: (e.value ?? "").trim(), label: e.label?.trim() || null, is_primary: !!e.is_primary }))
    .filter((e) => e.value.length > 0);
  if (!clean.length) return [];
  if (!clean.some((e) => e.is_primary)) clean[0].is_primary = true;
  // only one primary
  let seen = false;
  for (const e of clean) {
    if (e.is_primary && !seen) seen = true;
    else e.is_primary = false;
  }
  return clean;
}

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

  // 1) Create company — denormalize primary contact into the flat columns
  const emails = sanitizeContacts(payload.general.emails);
  const phones = sanitizeContacts(payload.general.phones);
  const mobiles = sanitizeContacts(payload.general.mobiles);
  const faxes = sanitizeContacts(payload.general.faxes);
  const generalRow = {
    ...payload.general,
    emails,
    phones,
    mobiles,
    faxes,
    email: pickPrimary(emails) ?? payload.general.email ?? null,
    phone: pickPrimary(phones) ?? payload.general.phone ?? null,
    mobile: pickPrimary(mobiles) ?? payload.general.mobile ?? null,
    fax: pickPrimary(faxes) ?? payload.general.fax ?? null,
  };
  const { data: company, error: cErr } = await supabase
    .from("companies")
    .insert({ ...generalRow, ...payload.advanced, created_by: userId } as never)
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

  // 6) Company documents (optional). Types are created on the fly and files
  //    uploaded only now (setup deferred everything to this final save).
  if (payload.documents?.length) {
    for (const d of payload.documents) {
      // Ensure a document type row exists for this company
      const { data: existingType } = await supabase
        .from("company_document_types")
        .select("id")
        .eq("company_id", companyId)
        .eq("code", d.code)
        .maybeSingle();
      let typeId = existingType?.id as string | undefined;
      if (!typeId) {
        const { data: newType, error: tErr } = await supabase
          .from("company_document_types")
          .insert({
            company_id: companyId,
            code: d.code,
            name_ar: d.name_ar,
            name_en: d.name_en,
            notify_days_before: d.notify_days_before ?? 45,
            notify_repeat: d.notify_repeat ?? "weekly",
            default_department_ids: [],
            is_system: false,
            position: 0,
          })
          .select("id")
          .single();
        if (tErr) throw tErr;
        typeId = newType.id;
      }

      const { data: doc, error: dErr } = await supabase
        .from("company_documents")
        .insert({
          company_id: companyId,
          type_id: typeId!,
          doc_number: d.doc_number ?? null,
          issue_date: d.issue_date ?? null,
          expiry_date: d.expiry_date ?? null,
          notes: d.notes ?? null,
          created_by: userId,
        })
        .select("id")
        .single();
      if (dErr) throw dErr;

      if (d.file) {
        const ext = d.file.name.split(".").pop() || "bin";
        const path = `${doc.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("company-documents")
          .upload(path, d.file, { cacheControl: "3600", upsert: false, contentType: d.file.type });
        if (upErr) throw upErr;
        const { error: fErr2 } = await supabase.from("company_document_files").insert({
          document_id: doc.id,
          storage_path: path,
          file_name: d.file.name,
          mime_type: d.file.type || null,
          size_bytes: d.file.size,
          uploaded_by: userId,
        });
        if (fErr2) throw fErr2;
      }
    }
  }

  return company;
}
