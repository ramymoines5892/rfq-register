import { supabase } from "@/integrations/supabase/client";

export type PartnerRole =
  | "customer" | "supplier" | "manufacturer" | "freight_forwarder"
  | "inspection" | "shipping" | "bank" | "insurance" | "agent";

export const PARTNER_ROLES: { value: PartnerRole; ar: string; en: string }[] = [
  { value: "customer",          ar: "عميل",           en: "Customer" },
  { value: "supplier",          ar: "مورد",            en: "Supplier" },
  { value: "manufacturer",      ar: "مصنّع",           en: "Manufacturer" },
  { value: "freight_forwarder", ar: "شحن دولي",        en: "Freight Forwarder" },
  { value: "inspection",        ar: "شركة فحص",        en: "Inspection" },
  { value: "shipping",          ar: "شركة نقل",        en: "Shipping" },
  { value: "bank",              ar: "بنك",             en: "Bank" },
  { value: "insurance",         ar: "شركة تأمين",      en: "Insurance" },
  { value: "agent",             ar: "وكيل",            en: "Agent" },
];

export type BusinessPartner = {
  id: string;
  company_id: string | null;
  code: string | null;
  name_ar: string | null;
  name_en: string | null;
  legal_name: string | null;
  roles: PartnerRole[];
  tax_id: string | null;
  commercial_reg: string | null;
  industry: string | null;
  category: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  fax: string | null;
  currency: string;
  payment_terms: string | null;
  credit_limit: number | null;
  price_list: string | null;
  incoterm: string | null;
  rating: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type PartnerContact = {
  id: string; partner_id: string; name: string; title: string | null;
  email: string | null; phone: string | null; mobile: string | null;
  is_default: boolean; notes: string | null;
};

export type PartnerAddress = {
  id: string; partner_id: string; label: string | null; address_type: string;
  address: string | null; city: string | null; state: string | null;
  country: string | null; postal_code: string | null; is_default: boolean;
};

export type PartnerBank = {
  id: string; partner_id: string; bank_name: string; branch: string | null;
  account_name: string | null; account_no: string | null; iban: string | null;
  swift: string | null; currency: string; is_default: boolean; notes: string | null;
};

const bp = () => (supabase as any).from("business_partners");
const pc = () => (supabase as any).from("partner_contacts");
const pa = () => (supabase as any).from("partner_addresses");
const pb = () => (supabase as any).from("partner_banks");

export async function listPartners(role?: PartnerRole, search?: string): Promise<BusinessPartner[]> {
  let q = bp().select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(500);
  if (role) q = q.contains("roles", [role]);
  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    q = q.or(`name_ar.ilike.${s},name_en.ilike.${s},code.ilike.${s},tax_id.ilike.${s},email.ilike.${s},phone.ilike.${s}`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as BusinessPartner[];
}

export async function getPartner(id: string): Promise<BusinessPartner | null> {
  const { data, error } = await bp().select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as BusinessPartner | null;
}

export async function upsertPartner(p: Partial<BusinessPartner>): Promise<BusinessPartner> {
  if (p.id) {
    const { data, error } = await bp().update(p).eq("id", p.id).select("*").single();
    if (error) throw error; return data as BusinessPartner;
  }
  const { data: company } = await supabase.from("companies").select("id").order("created_at").limit(1).maybeSingle();
  const payload = { ...p, company_id: p.company_id ?? company?.id ?? null, roles: p.roles ?? [] };
  const { data, error } = await bp().insert(payload).select("*").single();
  if (error) throw error; return data as BusinessPartner;
}

export async function softDeletePartner(id: string): Promise<void> {
  const { error } = await bp().update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

// Contacts
export async function listContacts(partnerId: string): Promise<PartnerContact[]> {
  const { data, error } = await pc().select("*").eq("partner_id", partnerId).order("is_default", { ascending: false });
  if (error) throw error; return (data ?? []) as PartnerContact[];
}
export async function upsertContact(row: Partial<PartnerContact>): Promise<PartnerContact> {
  if (row.id) { const { data, error } = await pc().update(row).eq("id", row.id).select("*").single(); if (error) throw error; return data; }
  const { data, error } = await pc().insert(row).select("*").single(); if (error) throw error; return data;
}
export async function deleteContact(id: string): Promise<void> {
  const { error } = await pc().delete().eq("id", id); if (error) throw error;
}

// Addresses
export async function listAddresses(partnerId: string): Promise<PartnerAddress[]> {
  const { data, error } = await pa().select("*").eq("partner_id", partnerId).order("is_default", { ascending: false });
  if (error) throw error; return (data ?? []) as PartnerAddress[];
}
export async function upsertAddress(row: Partial<PartnerAddress>): Promise<PartnerAddress> {
  if (row.id) { const { data, error } = await pa().update(row).eq("id", row.id).select("*").single(); if (error) throw error; return data; }
  const { data, error } = await pa().insert(row).select("*").single(); if (error) throw error; return data;
}
export async function deleteAddress(id: string): Promise<void> {
  const { error } = await pa().delete().eq("id", id); if (error) throw error;
}

// Banks
export async function listBanks(partnerId: string): Promise<PartnerBank[]> {
  const { data, error } = await pb().select("*").eq("partner_id", partnerId).order("is_default", { ascending: false });
  if (error) throw error; return (data ?? []) as PartnerBank[];
}
export async function upsertBank(row: Partial<PartnerBank>): Promise<PartnerBank> {
  if (row.id) { const { data, error } = await pb().update(row).eq("id", row.id).select("*").single(); if (error) throw error; return data; }
  const { data, error } = await pb().insert(row).select("*").single(); if (error) throw error; return data;
}
export async function deleteBank(id: string): Promise<void> {
  const { error } = await pb().delete().eq("id", id); if (error) throw error;
}
