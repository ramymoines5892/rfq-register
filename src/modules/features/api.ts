import { supabase } from "@/integrations/supabase/client";
import { defaultFeatures, FEATURE_REGISTRY } from "@/lib/features/registry";

export type CompanyFeaturesRow = Record<string, boolean> & {
  id?: string;
  company_id?: string;
};

/**
 * Fetch the current company's feature flags. Returns a full record with
 * every registered feature key (falling back to registry defaults for keys
 * missing from the DB row so the app never breaks when new features are added).
 */
export async function fetchCurrentFeatures(): Promise<Record<string, boolean>> {
  const defaults = defaultFeatures();
  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!company) return defaults;

  const { data, error } = await supabase
    .from("company_features")
    .select("*")
    .eq("company_id", company.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return defaults;

  const out: Record<string, boolean> = { ...defaults };
  for (const f of FEATURE_REGISTRY) {
    const v = (data as Record<string, unknown>)[f.key];
    if (typeof v === "boolean") out[f.key] = v;
  }
  return out;
}

export async function updateCurrentFeatures(patch: Record<string, boolean>): Promise<void> {
  const { data: company, error: cErr } = await supabase
    .from("companies")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!company) throw new Error("No company found");

  // Only send known feature columns to avoid schema issues.
  const clean: Record<string, boolean> = {};
  for (const f of FEATURE_REGISTRY) {
    if (typeof patch[f.key] === "boolean") clean[f.key] = patch[f.key];
  }

  const { error } = await supabase
    .from("company_features")
    .update(clean as never)
    .eq("company_id", company.id);
  if (error) throw error;
}
