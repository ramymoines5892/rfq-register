import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type EmploymentStatus = Database["public"]["Enums"]["employment_status"];
export type EmploymentType = Database["public"]["Enums"]["employment_type"];

export type Person = {
  id: string;
  national_id: string | null;
  passport_no: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  full_name: string | null;
  full_name_ar: string | null;
  full_name_en: string | null;
  birth_date: string | null;
  gender: string | null;
  nationality: string | null;
  personal_email: string | null;
  personal_phone: string | null;
  photo_url: string | null;
  notes: string | null;
};

export type Employee = {
  id: string;
  company_id: string | null;
  person_id: string | null;
  employee_number: string | null;
  employee_code: string | null;
  full_name: string;
  full_name_ar: string | null;
  full_name_en: string | null;
  national_id: string | null;
  passport_no: string | null;
  phone: string | null;
  email: string | null;
  branch_id: string | null;
  management_id: string | null;
  department_id: string | null;
  position_id: string | null;
  direct_manager_id: string | null;
  employment_status: EmploymentStatus;
  employment_type: EmploymentType | null;
  joining_date: string | null;
  termination_date: string | null;
  cost_center: string | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  person?: Person | null;
};

export type EmployeeUpsertPayload = {
  employee: {
    company_id?: string | null;
    employee_number?: string | null;
    employee_code?: string | null;
    branch_id?: string | null;
    department_id?: string | null;
    management_id?: string | null;
    position_id?: string | null;
    direct_manager_id?: string | null;
    employment_status: EmploymentStatus;
    employment_type: EmploymentType | null;
    joining_date?: string | null;
    termination_date?: string | null;
    cost_center?: string | null;
    notes?: string | null;
  };
  person: {
    national_id?: string | null;
    passport_no?: string | null;
    first_name?: string | null;
    middle_name?: string | null;
    last_name?: string | null;
    full_name_ar?: string | null;
    full_name_en?: string | null;
    birth_date?: string | null;
    gender?: string | null;
    nationality?: string | null;
    personal_email?: string | null;
    personal_phone?: string | null;
    photo_url?: string | null;
  };
};

export async function fetchEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("*, person:persons(*)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Employee[];
}

export async function upsertEmployee(
  id: string | null,
  payload: EmployeeUpsertPayload,
): Promise<Employee> {
  const derivedFullName =
    payload.person.full_name_en ||
    payload.person.full_name_ar ||
    [payload.person.first_name, payload.person.middle_name, payload.person.last_name]
      .filter(Boolean).join(" ").trim() ||
    "—";

  // 1) upsert person
  let personId: string | null = null;
  if (id) {
    const { data: existing } = await supabase.from("employees").select("person_id").eq("id", id).maybeSingle();
    personId = existing?.person_id ?? null;
  }

  const personRow = {
    ...payload.person,
    full_name: derivedFullName,
  };

  if (personId) {
    const { error } = await supabase.from("persons").update(personRow).eq("id", personId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("persons").insert(personRow).select("id").single();
    if (error) throw error;
    personId = data.id;
  }

  // 2) upsert employee (mirror identity fields for backward compatibility)
  const employeeRow = {
    ...payload.employee,
    person_id: personId,
    full_name: derivedFullName,
    full_name_ar: payload.person.full_name_ar ?? null,
    full_name_en: payload.person.full_name_en ?? null,
    national_id: payload.person.national_id ?? null,
    passport_no: payload.person.passport_no ?? null,
    phone: payload.person.personal_phone ?? null,
    email: payload.person.personal_email ?? null,
    photo_url: payload.person.photo_url ?? null,
  };

  if (id) {
    const { data, error } = await supabase
      .from("employees").update(employeeRow).eq("id", id)
      .select("*, person:persons(*)").single();
    if (error) throw error;
    return data as unknown as Employee;
  } else {
    const { data, error } = await supabase
      .from("employees").insert(employeeRow as any)
      .select("*, person:persons(*)").single();
    if (error) throw error;
    return data as unknown as Employee;
  }
}

export async function softDeleteEmployee(id: string): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("employees")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.user?.id ?? null })
    .eq("id", id);
  if (error) throw error;
}
