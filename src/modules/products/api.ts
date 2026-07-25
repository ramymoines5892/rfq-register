import { supabase } from "@/integrations/supabase/client";

export type Product = {
  id: string;
  company_id: string;
  code: string;
  name_ar: string | null;
  name_en: string | null;
  category: string | null;
  uom: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductUpsert = {
  code: string;
  name_ar?: string | null;
  name_en?: string | null;
  category?: string | null;
  uom?: string;
  is_active?: boolean;
  notes?: string | null;
};

async function ensureCompanyId(): Promise<string> {
  const { data } = await supabase.from("companies").select("id").order("created_at").limit(1).maybeSingle();
  if (!data?.id) throw new Error("No company found");
  return data.id;
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .is("deleted_at", null)
    .order("code");
  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function upsertProduct(id: string | null, payload: ProductUpsert): Promise<Product> {
  if (!payload.code?.trim()) throw new Error("Code is required");
  if (id) {
    const { data, error } = await supabase.from("products").update(payload).eq("id", id).select().single();
    if (error) throw error;
    return data as Product;
  }
  const company_id = await ensureCompanyId();
  const { data, error } = await supabase.from("products").insert({ ...payload, company_id }).select().single();
  if (error) throw error;
  return data as Product;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from("products").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
