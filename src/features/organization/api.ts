import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Department = Database["public"]["Tables"]["departments"]["Row"];
export type JobTitle = Database["public"]["Tables"]["job_titles"]["Row"];
export type FieldDef = Database["public"]["Tables"]["customer_field_definitions"]["Row"];
export type ProfileLite = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "full_name" | "email" | "department_id"
>;

export interface OrganizationData {
  depts: Department[];
  jobs: JobTitle[];
  customFields: FieldDef[];
  profiles: ProfileLite[];
}

export async function fetchOrganizationData(): Promise<OrganizationData> {
  const [d, j, f, p] = await Promise.all([
    supabase.from("departments").select("*").is("deleted_at", null).order("position"),
    supabase.from("job_titles").select("*").is("deleted_at", null).order("position"),
    supabase
      .from("customer_field_definitions")
      .select("*")
      .in("entity_key", ["department", "job_title"])
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("position"),
    supabase.from("profiles").select("id, full_name, email, department_id"),
  ]);
  if (d.error) throw d.error;
  if (j.error) throw j.error;
  if (f.error) throw f.error;
  if (p.error) throw p.error;
  return {
    depts: (d.data ?? []) as Department[],
    jobs: (j.data ?? []) as JobTitle[],
    customFields: (f.data ?? []) as FieldDef[],
    profiles: (p.data ?? []) as ProfileLite[],
  };
}

export interface DepartmentPositionUpdate {
  id: string;
  parent_id: string | null;
  position: number;
}

export async function reorderDepartments(updates: DepartmentPositionUpdate[]): Promise<void> {
  const results = await Promise.all(
    updates.map((u) =>
      supabase
        .from("departments")
        .update({ parent_id: u.parent_id, position: u.position })
        .eq("id", u.id),
    ),
  );
  const err = results.find((r) => r.error)?.error;
  if (err) throw err;
}

export async function softDeleteOrgRow(params: {
  id: string;
  kind: "department" | "job_title";
}): Promise<void> {
  const table = params.kind === "department" ? "departments" : "job_titles";
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id);
  if (error) throw error;
}

export async function upsertDepartment(params: {
  id?: string;
  payload: Partial<Department>;
  isNew: boolean;
}): Promise<void> {
  const { error } = params.isNew
    ? await supabase.from("departments").insert(params.payload as never)
    : await supabase.from("departments").update(params.payload as never).eq("id", params.id!);
  if (error) throw error;
}

export async function upsertJobTitle(params: {
  id?: string;
  payload: Partial<JobTitle>;
  isNew: boolean;
}): Promise<void> {
  const { error } = params.isNew
    ? await supabase.from("job_titles").insert(params.payload as never)
    : await supabase.from("job_titles").update(params.payload as never).eq("id", params.id!);
  if (error) throw error;
}
