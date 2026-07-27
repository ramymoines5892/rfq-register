import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, ChevronUp, ChevronDown, Pencil, ArrowLeft, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useConfirm } from "@/hooks/useConfirm";
import {
  useTemplates,
  useStageCount,
  useTemplateDetail,
  useTeamProfiles,
  useCreateTemplate,
  useDeleteTemplate,
  useRenameTemplate,
  useTemplateMutations,
} from "@/modules/workflows/queries";
import type { Template } from "@/modules/workflows/api";
import { PermissionGate } from "@/components/permissions/PermissionGate";

export const Route = createFileRoute("/_authenticated/workflows")({
  component: () => (
    <PermissionGate permission="workflows.view">
      <WorkflowsPage />
    </PermissionGate>
  ),
  head: () => ({ meta: [{ title: "قوالب الموافقات" }] }),
});

function WorkflowsPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const confirm = useConfirm();
  const { data: templates = [], isLoading: loading } = useTemplates();
  const createMut = useCreateTemplate();
  const deleteMut = useDeleteTemplate();
  const [editing, setEditing] = useState<Template | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");

  async function confirmCreate() {
    const name = newName.trim();
    if (!name) { toast.error(ar ? "أدخل اسم القالب" : "Enter a name"); return; }
    try {
      const tpl = await createMut.mutateAsync(name);
      setNewOpen(false);
      setNewName("");
      setEditing(tpl);
      setDialogOpen(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function deleteTemplate(id: string) {
    const ok = await confirm({ description: t("confirmDelete"), confirmText: t("delete") ?? undefined, variant: "destructive" });
    if (!ok) return;
    try {
      await deleteMut.mutateAsync(id);
      toast.success(t("saved"));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 me-1" />{t("backToQuotes")}</Button></Link>
          </div>
          <h1 className="text-lg font-bold">{ar ? "قوالب الاعتمادات" : "Approval Workflows"}</h1>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground leading-relaxed">
            {ar
              ? "قوالب الاعتمادات تحدد مسار الموافقة على المستندات (مثل عروض الأسعار وأوامر الشراء): كل قالب يحتوي على مراحل مرتبة، ولكل مرحلة معتمدون أساسيون واحتياطيون. عند إنشاء مستند مرتبط بقالب، يمر تلقائيًا على هذه المراحل بالترتيب."
              : "Approval workflows define how documents (quotes, purchase orders, etc.) get approved: each template contains ordered stages, and each stage has primary/backup approvers. Documents linked to a template are routed through these stages in order."}
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <Button onClick={() => { setNewName(ar ? "قالب اعتماد" : "New workflow"); setNewOpen(true); }}>
            <Plus className="h-4 w-4 me-1" />{t("newWorkflow")}
          </Button>
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

      <Dialog open={newOpen} onOpenChange={(v) => { if (!createMut.isPending) setNewOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{ar ? "قالب اعتماد جديد" : "New approval workflow"}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>{t("workflowName")}</Label>
            <Input
              value={newName}
              autoFocus
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmCreate(); }}
              placeholder={ar ? "مثال: اعتماد عروض الأسعار" : "e.g. Quote approval"}
            />
            <p className="text-xs text-muted-foreground">
              {ar ? "لن يُنشأ القالب إلا بعد الحفظ." : "The template will only be created after saving."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)} disabled={createMut.isPending}>{t("cancel") ?? "Cancel"}</Button>
            <Button onClick={confirmCreate} disabled={createMut.isPending || !newName.trim()}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editing && (
        <TemplateEditor
          open={dialogOpen}
          onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }}
          template={editing}
        />
      )}
    </div>
  );
}


function TemplateRow({ template, onEdit, onDelete }: { template: Template; onEdit: () => void; onDelete: () => void }) {
  const { data: stageCount = 0 } = useStageCount(template.id);
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
  const { data: detail } = useTemplateDetail(template.id, open);
  const { data: profiles = [] } = useTeamProfiles(open);
  const stages = detail?.stages ?? [];
  const approvers = detail?.approversByStage ?? {};
  const mut = useTemplateMutations(template.id);
  const renameMut = useRenameTemplate();
  // Local overlay for the currently-editing stage name so typing feels responsive.
  const [stageNameDraft, setStageNameDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(template.name);
      setStageNameDraft({});
    }
  }, [open, template.id, template.name]);

  async function saveName() {
    if (name.trim() && name !== template.name) {
      try {
        await renameMut.mutateAsync({ id: template.id, name: name.trim() });
      } catch (e) {
        toast.error((e as Error).message);
      }
    }
  }

  async function onAddStage() {
    if (mut.addStage.isPending) return;
    try {
      await mut.addStage.mutateAsync();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function onUpdateStageName(id: string, newName: string) {
    try {
      await mut.renameStage.mutateAsync({ id, name: newName });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function onDeleteStage(id: string) {
    try {
      await mut.deleteStage.mutateAsync(id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function onMoveStage(idx: number, dir: -1 | 1) {
    const other = stages[idx + dir];
    const cur = stages[idx];
    if (!other || !cur) return;
    try {
      await mut.swapStages.mutateAsync({ a: cur, b: other });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function onAddApprover(stageId: string, approverId: string) {
    if (!approverId) return;
    const current = approvers[stageId] ?? [];
    const nextPos = current.reduce((m, a) => Math.max(m, a.position ?? 0), 0) + 1;
    try {
      await mut.addApprover.mutateAsync({ stageId, approverId, position: nextPos });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function onRemoveApprover(id: string) {
    try {
      await mut.removeApprover.mutateAsync(id);
    } catch (e) {
      toast.error((e as Error).message);
    }
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
              <Button size="sm" variant="outline" onClick={onAddStage} disabled={mut.addStage.isPending}>
                <Plus className="h-4 w-4 me-1" />{t("addStage")}
              </Button>
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
                        <Input
                          value={stageNameDraft[s.id] ?? s.name}
                          onChange={(e) => setStageNameDraft((prev) => ({ ...prev, [s.id]: e.target.value }))}
                          onBlur={(e) => onUpdateStageName(s.id, e.target.value)}
                        />
                        <Button size="icon" variant="ghost" onClick={() => onMoveStage(idx, -1)} disabled={idx === 0}><ChevronUp className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => onMoveStage(idx, 1)} disabled={idx === stages.length - 1}><ChevronDown className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => onDeleteStage(s.id)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                      </div>
                      <div className="ps-8 space-y-1.5">
                        <div className="text-xs text-muted-foreground">{t("approvers")} <span className="opacity-70">({t("primaryApprover")} → {t("backupApprover")})</span>:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {(approvers[s.id] ?? []).map((a, i) => {
                            const p = profiles.find(x => x.id === a.approver_id);
                            return (
                              <div key={a.id} className="inline-flex items-center gap-1 bg-muted rounded px-2 py-0.5 text-xs">
                                <span className="text-[10px] font-mono opacity-60">{i + 1}.</span>
                                {p?.full_name || p?.email || a.approver_id}
                                <button onClick={() => onRemoveApprover(a.id)}><X className="h-3 w-3" /></button>
                              </div>
                            );
                          })}
                        </div>
                        <Select value="" onValueChange={(v) => onAddApprover(s.id, v)}>
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
