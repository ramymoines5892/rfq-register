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
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("customers")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: u.user?.id ?? null,
    })
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
