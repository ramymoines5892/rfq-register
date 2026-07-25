/**
 * Reference-data lookups used across many modules.
 * Any route that needs "list of departments / job titles / branches /
 * users" should import from here instead of hitting Supabase directly.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Id } from "@/shared/types/common";

export interface DeptLookup { id: Id; name: string; name_ar: string | null; name_en: string | null }
export interface JobLookup  { id: Id; name: string; name_ar: string | null; name_en: string | null }
export interface BranchLookup { id: Id; name: string; name_ar: string | null }
export interface UserLookup { id: Id; full_name: string | null; email: string | null }

export async function listDepartments(): Promise<DeptLookup[]> {
  const { data, error } = await supabase
    .from("departments")
    .select("id,name,name_ar,name_en")
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function listJobTitles(): Promise<JobLookup[]> {
  const { data, error } = await supabase
    .from("job_titles")
    .select("id,name,name_ar,name_en")
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function listBranches(): Promise<BranchLookup[]> {
  const { data, error } = await supabase
    .from("branches")
    .select("id,name,name_ar")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function listUsers(): Promise<UserLookup[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email")
    .order("full_name");
  if (error) throw error;
  return data ?? [];
}

export async function getDepartmentsByIds(ids: Id[]) {
  if (ids.length === 0) return [] as DeptLookup[];
  const { data } = await supabase
    .from("departments")
    .select("id,name,name_ar,name_en")
    .in("id", ids);
  return data ?? [];
}

export async function getJobTitlesByIds(ids: Id[]) {
  if (ids.length === 0) return [] as JobLookup[];
  const { data } = await supabase
    .from("job_titles")
    .select("id,name,name_ar,name_en")
    .in("id", ids);
  return data ?? [];
}

export async function getBranchesByIds(ids: Id[]) {
  if (ids.length === 0) return [] as BranchLookup[];
  const { data } = await supabase
    .from("branches")
    .select("id,name,name_ar")
    .in("id", ids);
  return data ?? [];
}

export async function getUsersByIds(ids: Id[]) {
  if (ids.length === 0) return [] as UserLookup[];
  const { data } = await supabase
    .from("profiles")
    .select("id,full_name,email")
    .in("id", ids);
  return data ?? [];
}
