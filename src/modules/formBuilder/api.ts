import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type FieldDef = Database["public"]["Tables"]["customer_field_definitions"]["Row"];
export type FieldOption = Database["public"]["Tables"]["customer_field_options"]["Row"];
export type FieldDefUpdate = Database["public"]["Tables"]["customer_field_definitions"]["Update"];
export type FieldDefInsert = Database["public"]["Tables"]["customer_field_definitions"]["Insert"];
export type FieldOptionInsert = Database["public"]["Tables"]["customer_field_options"]["Insert"];

export async function fetchCanManageFormFields(): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;
  const [{ data: legacy }, { data: unified }] = await Promise.all([
    supabase.rpc("has_permission", { _user_id: userData.user.id, _perm: "manage_customer_fields" }),
    supabase.rpc("has_permission", { _user_id: userData.user.id, _perm: "manage_form_fields" }),
  ]);
  return Boolean(legacy) || Boolean(unified);
}

export async function fetchFormBuilder(entity: string): Promise<{
  fields: FieldDef[];
  optionsByField: Record<string, FieldOption[]>;
}> {
  const [{ data: defs, error: e1 }, { data: opts, error: e2 }] = await Promise.all([
    supabase
      .from("customer_field_definitions")
      .select("*")
      .eq("entity_key", entity)
      .is("deleted_at", null)
      .order("position", { ascending: true }),
    supabase
      .from("customer_field_options")
      .select("*")
      .is("deleted_at", null)
      .order("position", { ascending: true }),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const grouped: Record<string, FieldOption[]> = {};
  for (const o of opts ?? []) (grouped[o.field_id] ??= []).push(o);
  return { fields: defs ?? [], optionsByField: grouped };
}

export async function softDeleteField(id: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("customer_field_definitions")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: u.user?.id ?? null,
      is_active: false,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function softDeleteFieldsBulk(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { data: u } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  const uid = u.user?.id ?? null;
  const results = await Promise.all(
    ids.map((id) =>
      supabase
        .from("customer_field_definitions")
        .update({ deleted_at: now, deleted_by: uid, is_active: false })
        .eq("id", id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export async function persistFieldChanges(
  changed: FieldDef[],
  original: Map<string, FieldDef>,
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id ?? null;
  const results = await Promise.all(
    changed.map((f) => {
      const o = original.get(f.id)!;
      const hidChanged = o.is_active !== f.is_active;
      return supabase
        .from("customer_field_definitions")
        .update({
          position: f.position,
          col_span: f.col_span,
          is_active: f.is_active,
          section_ar: f.section_ar,
          section_en: f.section_en,
          ...(hidChanged
            ? { hidden_at: !f.is_active ? new Date().toISOString() : null, hidden_by: !f.is_active ? uid : null }
            : {}),
        })
        .eq("id", f.id);
    }),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export async function upsertFieldDefinition(args: {
  editingId: string | null;
  payload: Omit<FieldDefInsert, "position">;
  maxPosition: number;
}): Promise<string> {
  const { editingId, payload, maxPosition } = args;
  if (editingId) {
    const { error } = await supabase
      .from("customer_field_definitions")
      .update(payload as FieldDefUpdate)
      .eq("id", editingId);
    if (error) throw error;
    return editingId;
  }
  const { data, error } = await supabase
    .from("customer_field_definitions")
    .insert({ ...payload, position: maxPosition + 10 } as FieldDefInsert)
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Insert failed");
  return data.id;
}

export async function replaceFieldOptions(
  fieldId: string,
  rows: FieldOptionInsert[],
): Promise<void> {
  const { error: delErr } = await supabase
    .from("customer_field_options")
    .delete()
    .eq("field_id", fieldId);
  if (delErr) throw delErr;
  if (rows.length) {
    const { error } = await supabase.from("customer_field_options").insert(rows);
    if (error) throw error;
  }
}

export async function clearFieldOptions(fieldId: string): Promise<void> {
  const { error } = await supabase
    .from("customer_field_options")
    .delete()
    .eq("field_id", fieldId);
  if (error) throw error;
}
