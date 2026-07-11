import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, ChevronUp, ChevronDown, Pencil, ArrowLeft, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/workflows")({
  component: WorkflowsPage,
  head: () => ({ meta: [{ title: "قوالب الموافقات" }] }),
});

type Profile = { id: string; email: string; full_name: string | null };
type Template = { id: string; name: string; owner_id: string };
type Stage = { id: string; template_id: string; position: number; name: string };
type StageApprover = { id: string; stage_id: string; approver_id: string; position: number };

function WorkflowsPage() {
  const { t, lang } = useI18n();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("workflow_templates").select("*").order("created_at", { ascending: false });
    setTemplates((data ?? []) as Template[]);
    setLoading(false);
  }

  async function createTemplate() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data, error } = await supabase.from("workflow_templates")
      .insert({ owner_id: userData.user.id, name: lang === "ar" ? "قالب جديد" : "New workflow" })
      .select("*").single();
    if (error) { toast.error(error.message); return; }
    setEditing(data as Template);
    setDialogOpen(true);
    load();
  }

  async function deleteTemplate(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    const { error } = await supabase.from("workflow_templates").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("saved"));
    load();
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 me-1" />{t("backToQuotes")}</Button></Link>
          </div>
          <h1 className="text-lg font-bold">{t("workflows")}</h1>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <div className="flex justify-end">
          <Button onClick={createTemplate}><Plus className="h-4 w-4 me-1" />{t("newWorkflow")}</Button>
        </div>
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">{t("loading")}</div>
        ) : templates.length === 0 ? (
          <Card><CardContent className="text-center py-16 text-muted-foreground">{t("empty")}</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {templates.map(tpl => (
              <TemplateRow key={tpl.id} template={tpl} onEdit={() => { setEditing(tpl); setDialogOpen(true); }} onDelete={() => deleteTemplate(tpl.id)} />
            ))}
          </div>
        )}
      </main>
      {editing && <TemplateEditor open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditing(null); load(); } }} template={editing} />}
    </div>
  );
}

function TemplateRow({ template, onEdit, onDelete }: { template: Template; onEdit: () => void; onDelete: () => void }) {
  const [stageCount, setStageCount] = useState(0);
  useEffect(() => {
    supabase.from("workflow_stages").select("id", { count: "exact", head: true }).eq("template_id", template.id)
      .then(({ count }) => setStageCount(count ?? 0));
  }, [template.id]);
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{template.name}</h3>
          <p className="text-xs text-muted-foreground">{stageCount} stages</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateEditor({ open, onOpenChange, template }: { open: boolean; onOpenChange: (v: boolean) => void; template: Template }) {
  const { t } = useI18n();
  const [name, setName] = useState(template.name);
  const [stages, setStages] = useState<Stage[]>([]);
  const [approvers, setApprovers] = useState<Record<string, StageApprover[]>>({});
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [addingStage, setAddingStage] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(template.name);
    // Only list users who are part of the team (have a role assigned)
    supabase.from("user_roles").select("user_id, profiles!inner(id, email, full_name)").then(({ data }) => {
      const seen = new Set<string>();
      const list: Profile[] = [];
      (data ?? []).forEach((row: any) => {
        const p = row.profiles;
        if (p && !seen.has(p.id)) { seen.add(p.id); list.push(p as Profile); }
      });
      setProfiles(list);
    });
    reloadStages();
  }, [open, template.id]);

  async function reloadStages() {
    const { data: st } = await supabase.from("workflow_stages").select("*").eq("template_id", template.id).order("position");
    const stagesList = (st ?? []) as Stage[];
    setStages(stagesList);
    if (stagesList.length) {
      const { data: ap } = await supabase.from("workflow_stage_approvers").select("*").in("stage_id", stagesList.map(s => s.id));
      const grouped: Record<string, StageApprover[]> = {};
      (ap ?? []).forEach(a => { (grouped[(a as StageApprover).stage_id] ??= []).push(a as StageApprover); });
      setApprovers(grouped);
    } else {
      setApprovers({});
    }
  }

  async function saveName() {
    if (name.trim() && name !== template.name) {
      await supabase.from("workflow_templates").update({ name: name.trim() }).eq("id", template.id);
    }
  }

  async function addStage() {
    if (addingStage) return;
    setAddingStage(true);
    const { error } = await supabase.rpc("add_workflow_stage", { _template_id: template.id });
    setAddingStage(false);
    if (error) { toast.error(error.message); return; }
    reloadStages();
  }

  async function updateStageName(id: string, newName: string) {
    await supabase.from("workflow_stages").update({ name: newName }).eq("id", id);
    setStages(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
  }

  async function deleteStage(id: string) {
    await supabase.from("workflow_stages").delete().eq("id", id);
    reloadStages();
  }

  async function moveStage(idx: number, dir: -1 | 1) {
    const other = stages[idx + dir];
    if (!other) return;
    const cur = stages[idx];
    // Use temp position to avoid unique conflict
    await supabase.from("workflow_stages").update({ position: -1 }).eq("id", cur.id);
    await supabase.from("workflow_stages").update({ position: cur.position }).eq("id", other.id);
    await supabase.from("workflow_stages").update({ position: other.position }).eq("id", cur.id);
    reloadStages();
  }

  async function addApprover(stageId: string, approverId: string) {
    if (!approverId) return;
    const current = approvers[stageId] ?? [];
    const nextPos = (current.reduce((m, a) => Math.max(m, (a as any).position ?? 0), 0)) + 1;
    const { error } = await supabase.from("workflow_stage_approvers").insert({ stage_id: stageId, approver_id: approverId, position: nextPos });
    if (error && !error.message.includes("duplicate")) { toast.error(error.message); return; }
    reloadStages();
  }

  async function removeApprover(id: string) {
    await supabase.from("workflow_stage_approvers").delete().eq("id", id);
    reloadStages();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t("workflow")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("workflowName")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("stages")}</Label>
              <Button size="sm" variant="outline" onClick={addStage} disabled={addingStage}><Plus className="h-4 w-4 me-1" />{t("addStage")}</Button>
            </div>
            {stages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t("addStagesFirst")}</p>
            ) : (
              <div className="space-y-3">
                {stages.map((s, idx) => (
                  <Card key={s.id}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-muted-foreground w-6 text-center">{idx + 1}</span>
                        <Input value={s.name} onChange={(e) => setStages(prev => prev.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))} onBlur={(e) => updateStageName(s.id, e.target.value)} />
                        <Button size="icon" variant="ghost" onClick={() => moveStage(idx, -1)} disabled={idx === 0}><ChevronUp className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => moveStage(idx, 1)} disabled={idx === stages.length - 1}><ChevronDown className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteStage(s.id)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                      </div>
                      <div className="ps-8 space-y-1.5">
                        <div className="text-xs text-muted-foreground">{t("approvers")}:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {(approvers[s.id] ?? []).map(a => {
                            const p = profiles.find(x => x.id === a.approver_id);
                            return (
                              <div key={a.id} className="inline-flex items-center gap-1 bg-muted rounded px-2 py-0.5 text-xs">
                                {p?.full_name || p?.email || a.approver_id}
                                <button onClick={() => removeApprover(a.id)}><X className="h-3 w-3" /></button>
                              </div>
                            );
                          })}
                        </div>
                        <Select value="" onValueChange={(v) => addApprover(s.id, v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t("addApprover")} /></SelectTrigger>
                          <SelectContent>
                            {profiles.filter(p => !(approvers[s.id] ?? []).some(a => a.approver_id === p.id)).map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
