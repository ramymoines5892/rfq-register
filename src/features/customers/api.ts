import { supabase } from "@/integrations/supabase/client";

export type Customer = {
  id: string;
  user_id: string;
  name: string;
  name_ar: string | null;
  name_en: string | null;
  tax_id: string | null;
  currency: string;
  terms: string | null;
  notes: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  address_ar: string | null;
  address_en: string | null;
  city: string | null;
  country: string | null;
  industry: string | null;
  industry_ar: string | null;
  industry_en: string | null;
  payment_terms: string | null;
  payment_terms_ar: string | null;
  payment_terms_en: string | null;
  created_at: string;
};

const ATTACHMENT_BUCKET = "customer-attachments";

/** Return the current authenticated user id or throw. */
export async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user?.id) throw new Error("Not authenticated");
  return data.user.id;
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Fetch the current user's visible (non-deleted) customers ordered by newest first. */
export async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Customer[];
}

/** Soft-delete a customer (sets deleted_at and deleted_by). */
export async function softDeleteCustomer(id: string): Promise<void> {
  const uid = await currentUserId();
  const { error } = await supabase
    .from("customers")
    .update({ deleted_at: new Date().toISOString(), deleted_by: uid })
    .eq("id", id);
  if (error) throw error;
}

/** Fetch related entities for a customer detail view in parallel. */
export async function fetchCustomerRelations(customerId: string) {
  const [contacts, banks, attachments] = await Promise.all([
    supabase.from("customer_contacts").select("*").eq("customer_id", customerId).is("deleted_at", null).order("created_at"),
    supabase.from("customer_banks").select("*").eq("customer_id", customerId).is("deleted_at", null).order("created_at"),
    supabase.from("customer_attachments").select("*").eq("customer_id", customerId).is("deleted_at", null).order("created_at"),
  ]);
  if (contacts.error) throw contacts.error;
  if (banks.error) throw banks.error;
  if (attachments.error) throw attachments.error;
  return {
    contacts: contacts.data ?? [],
    banks: banks.data ?? [],
    attachments: attachments.data ?? [],
  };
}

/** RPC: find a customer by tax_id (returns first match or null). */
export async function findCustomerByTaxId(taxId: string): Promise<{ id: string; name: string; owner_id: string } | null> {
  const { data, error } = await supabase.rpc("find_customer_by_tax_id", { _tax_id: taxId });
  if (error) return null;
  const row = (data ?? [])[0] as { id: string; name: string; owner_id: string } | undefined;
  return row ?? null;
}

/** Update an existing customer row. */
export async function updateCustomer(id: string, payload: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("customers").update(payload as never).eq("id", id);
  if (error) throw error;
}

/** Insert a new customer row and return the inserted record. */
export async function insertCustomer(payload: Record<string, unknown>): Promise<Customer> {
  const { data, error } = await supabase.from("customers").insert(payload as never).select().single();
  if (error) throw error;
  return data as Customer;
}

/* ---------------- customer_contacts ---------------- */

export async function insertContacts(rows: Record<string, unknown>[]): Promise<void> {
  const { error } = await supabase.from("customer_contacts").insert(rows as never);
  if (error) throw error;
}

export async function insertContact<T = unknown>(row: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.from("customer_contacts").insert(row as never).select().single();
  if (error) throw error;
  return data as T;
}

export async function updateContactRow(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("customer_contacts").update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function softDeleteContact(id: string): Promise<void> {
  const uid = await currentUserId();
  const { error } = await supabase
    .from("customer_contacts")
    .update({ deleted_at: new Date().toISOString(), deleted_by: uid })
    .eq("id", id);
  if (error) throw error;
}

/* ---------------- customer_banks ---------------- */

export async function insertBanks(rows: Record<string, unknown>[]): Promise<void> {
  const { error } = await supabase.from("customer_banks").insert(rows as never);
  if (error) throw error;
}

export async function insertBank<T = unknown>(row: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.from("customer_banks").insert(row as never).select().single();
  if (error) throw error;
  return data as T;
}

export async function updateBankRow(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("customer_banks").update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function softDeleteBank(id: string): Promise<void> {
  const uid = await currentUserId();
  const { error } = await supabase
    .from("customer_banks")
    .update({ deleted_at: new Date().toISOString(), deleted_by: uid })
    .eq("id", id);
  if (error) throw error;
}

/* ---------------- customer_attachments ---------------- */

export async function insertAttachment<T = unknown>(row: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.from("customer_attachments").insert(row as never).select().single();
  if (error) throw error;
  return data as T;
}

export async function insertAttachmentSilent(row: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("customer_attachments").insert(row as never);
  if (error) throw error;
}

export async function softDeleteAttachment(id: string): Promise<void> {
  const uid = await currentUserId();
  const { error } = await supabase
    .from("customer_attachments")
    .update({ deleted_at: new Date().toISOString(), deleted_by: uid })
    .eq("id", id);
  if (error) throw error;
}

/* ---------------- storage ---------------- */

export async function uploadAttachmentFile(path: string, file: File): Promise<void> {
  const { error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
}

export async function createAttachmentSignedUrl(path: string, ttlSeconds = 60): Promise<string> {
  const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(path, ttlSeconds);
  if (error || !data?.signedUrl) throw error ?? new Error("Failed to create signed URL");
  return data.signedUrl;
}
