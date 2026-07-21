import { supabase } from "@/integrations/supabase/client";

export type NotifyRepeat = "none" | "daily" | "weekly" | "monthly";

export type DocumentType = {
  id: string;
  company_id: string;
  code: string;
  name_ar: string;
  name_en: string;
  description: string | null;
  default_department_ids: string[];
  notify_days_before: number;
  notify_repeat: NotifyRepeat;
  is_system: boolean;
  position: number;
};

export type CompanyDocument = {
  id: string;
  company_id: string;
  type_id: string;
  doc_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  notes: string | null;
  extra: Record<string, unknown>;
  department_ids: string[] | null;
  notify_days_before: number | null;
  notify_repeat: NotifyRepeat | null;
  superseded_by: string | null;
  superseded_at: string | null;
  created_at: string;
  created_by: string | null;
};

export type DocumentFile = {
  id: string;
  document_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
};

async function currentCompanyId(): Promise<string> {
  const { data, error } = await supabase.from("companies").select("id").order("created_at").limit(1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No company found");
  return data.id;
}

export async function fetchDocumentTypes(): Promise<DocumentType[]> {
  const { data, error } = await supabase
    .from("company_document_types")
    .select("*")
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DocumentType[];
}

export async function upsertDocumentType(
  t: Partial<DocumentType> & Pick<DocumentType, "code" | "name_ar" | "name_en">,
): Promise<DocumentType> {
  const companyId = t.company_id ?? (await currentCompanyId());
  const payload = {
    ...t,
    company_id: companyId,
    default_department_ids: t.default_department_ids ?? [],
    notify_days_before: t.notify_days_before ?? 30,
    notify_repeat: (t.notify_repeat ?? "weekly") as NotifyRepeat,
    position: t.position ?? 0,
  };
  const q = t.id
    ? supabase.from("company_document_types").update(payload).eq("id", t.id).select().single()
    : supabase.from("company_document_types").insert(payload).select().single();
  const { data, error } = await q;
  if (error) throw error;
  return data as DocumentType;
}

export async function deleteDocumentType(id: string) {
  const { error } = await supabase.from("company_document_types").delete().eq("id", id);
  if (error) throw error;
}

/** Latest non-superseded document per type + its files count. */
export async function fetchCurrentDocuments(): Promise<CompanyDocument[]> {
  const { data, error } = await supabase
    .from("company_documents")
    .select("*")
    .is("superseded_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CompanyDocument[];
}

export async function fetchDocumentHistory(typeId: string): Promise<CompanyDocument[]> {
  const { data, error } = await supabase
    .from("company_documents")
    .select("*")
    .eq("type_id", typeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CompanyDocument[];
}

export async function fetchDocumentFiles(documentId: string): Promise<DocumentFile[]> {
  const { data, error } = await supabase
    .from("company_document_files")
    .select("*")
    .eq("document_id", documentId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DocumentFile[];
}

export type NewDocumentPayload = {
  type_id: string;
  doc_number?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  notes?: string | null;
  department_ids?: string[] | null;
  notify_days_before?: number | null;
  notify_repeat?: NotifyRepeat | null;
  files?: File[];
};

/** Insert a new document; supersedes any current one of the same type. */
export async function createDocument(payload: NewDocumentPayload): Promise<CompanyDocument> {
  const companyId = await currentCompanyId();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  // Supersede any current one
  const { data: prev } = await supabase
    .from("company_documents")
    .select("id")
    .eq("type_id", payload.type_id)
    .is("superseded_at", null);

  const { data: inserted, error: iErr } = await supabase
    .from("company_documents")
    .insert({
      company_id: companyId,
      type_id: payload.type_id,
      doc_number: payload.doc_number ?? null,
      issue_date: payload.issue_date ?? null,
      expiry_date: payload.expiry_date ?? null,
      notes: payload.notes ?? null,
      department_ids: payload.department_ids ?? null,
      notify_days_before: payload.notify_days_before ?? null,
      notify_repeat: payload.notify_repeat ?? null,
      created_by: userId,
    })
    .select()
    .single();
  if (iErr) throw iErr;
  const newDoc = inserted as CompanyDocument;

  if (prev && prev.length) {
    const ids = prev.map((r) => r.id);
    await supabase
      .from("company_documents")
      .update({ superseded_by: newDoc.id, superseded_at: new Date().toISOString() })
      .in("id", ids);
  }

  if (payload.files?.length) {
    for (const file of payload.files) {
      await uploadDocumentFile(newDoc.id, file);
    }
  }
  return newDoc;
}

export async function uploadDocumentFile(documentId: string, file: File): Promise<DocumentFile> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  const ext = file.name.split(".").pop() || "bin";
  const path = `${documentId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("company-documents")
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (upErr) throw upErr;
  const { data, error } = await supabase
    .from("company_document_files")
    .insert({
      document_id: documentId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DocumentFile;
}

export async function getSignedFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("company-documents").createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
