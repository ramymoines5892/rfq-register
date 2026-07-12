import { supabase } from "@/integrations/supabase/client";

export type Template = { id: string; name: string; owner_id: string };
export type Stage = { id: string; template_id: string; position: number; name: string };
export type StageApprover = { id: string; stage_id: string; approver_id: string; position: number };
export type Profile = { id: string; email: string; full_name: string | null };

export async function fetchTemplates(): Promise<Template[]> {
  const { data, error } = await supabase
    .from("workflow_templates")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Template[];
}

export async function fetchStageCount(templateId: string): Promise<number> {
  const { count, error } = await supabase
    .from("workflow_stages")
    .select("id", { count: "exact", head: true })
    .eq("template_id", templateId)
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function fetchTemplateDetail(templateId: string) {
  const { data: st, error: stErr } = await supabase
    .from("workflow_stages")
    .select("*")
    .eq("template_id", templateId)
    .is("deleted_at", null)
    .order("position");
  if (stErr) throw stErr;
  const stages = (st ?? []) as Stage[];
  const approversByStage: Record<string, StageApprover[]> = {};
  if (stages.length > 0) {
    const { data: ap, error: apErr } = await supabase
      .from("workflow_stage_approvers")
      .select("*")
      .in("stage_id", stages.map((s) => s.id))
      .order("position");
    if (apErr) throw apErr;
    (ap ?? []).forEach((a) => {
      const row = a as StageApprover;
      (approversByStage[row.stage_id] ??= []).push(row);
    });
  }
  return { stages, approversByStage };
}

export async function fetchTeamProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id, profiles!inner(id, email, full_name)");
  if (error) throw error;
  const seen = new Set<string>();
  const list: Profile[] = [];
  (data ?? []).forEach((row: { profiles: Profile | null }) => {
    const p = row.profiles;
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      list.push(p);
    }
  });
  return list;
}

export async function createTemplate(name: string): Promise<Template> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("workflow_templates")
    .insert({ owner_id: uid, name })
    .select("*")
    .single();
  if (error) throw error;
  return data as Template;
}

export async function softDeleteTemplate(id: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("workflow_templates")
    .update({ deleted_at: new Date().toISOString(), deleted_by: u.user?.id ?? null })
    .eq("id", id);
  if (error) throw error;
}

export async function renameTemplate(id: string, name: string): Promise<void> {
  const { error } = await supabase.from("workflow_templates").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function addStage(templateId: string): Promise<void> {
  const { error } = await supabase.rpc("add_workflow_stage", { _template_id: templateId });
  if (error) throw error;
}

export async function renameStage(id: string, name: string): Promise<void> {
  const { error } = await supabase.from("workflow_stages").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function softDeleteStage(id: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("workflow_stages")
    .update({ deleted_at: new Date().toISOString(), deleted_by: u.user?.id ?? null })
    .eq("id", id);
  if (error) throw error;
}

export async function swapStagePositions(a: Stage, b: Stage): Promise<void> {
  // Temp position to avoid unique conflict.
  const t1 = await supabase.from("workflow_stages").update({ position: -1 }).eq("id", a.id);
  if (t1.error) throw t1.error;
  const t2 = await supabase.from("workflow_stages").update({ position: a.position }).eq("id", b.id);
  if (t2.error) throw t2.error;
  const t3 = await supabase.from("workflow_stages").update({ position: b.position }).eq("id", a.id);
  if (t3.error) throw t3.error;
}

export async function addStageApprover(stageId: string, approverId: string, position: number): Promise<void> {
  const { error } = await supabase
    .from("workflow_stage_approvers")
    .insert({ stage_id: stageId, approver_id: approverId, position });
  if (error && !error.message.includes("duplicate")) throw error;
}

export async function removeStageApprover(id: string): Promise<void> {
  const { error } = await supabase.from("workflow_stage_approvers").delete().eq("id", id);
  if (error) throw error;
}
