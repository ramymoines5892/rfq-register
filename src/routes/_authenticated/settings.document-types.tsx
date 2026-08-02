import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import {
  useDocumentTypes,
  useUpsertDocumentType,
  useDeleteDocumentType,
} from "@/modules/companyDocs/queries";
import type { DocumentType, NotifyRepeat } from "@/modules/companyDocs/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FolderArchive } from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";
import { useCurrentCompany, useUpdateCompany } from "@/modules/company/queries";

const EXPIRY_PRESETS = [7, 14, 30, 60, 90];

function ExpiryWindowCard({ ar }: { ar: boolean }) {
  const { data: company } = useCurrentCompany();
  const update = useUpdateCompany();
  const saved = (company as { doc_expiry_warning_days?: number } | null | undefined)?.doc_expiry_warning_days ?? 7;
  const [days, setDays] = useState<number>(saved);
  useEffect(() => { setDays(saved); }, [saved]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{ar ? "مدة التنبيه “قريب الانتهاء”" : "\"Expiring soon\" window"}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {ar
            ? "تُستخدم في لوحة التحكم وفي فلتر المستندات القريبة من الانتهاء."
            : "Used by the dashboard KPI and the documents “expiring” filter."}
        </p>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="w-32">
          <Label className="text-xs">{ar ? "عدد الأيام" : "Days"}</Label>
          <Input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {EXPIRY_PRESETS.map((p) => (
            <Button key={p} type="button" size="sm" variant={days === p ? "default" : "outline"} onClick={() => setDays(p)}>
              {p} {ar ? "يوم" : "d"}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          disabled={!company?.id || update.isPending || days === saved || days < 1 || days > 365}
          onClick={async () => {
            if (!company?.id) return;
            try {
              await update.mutateAsync({ id: company.id, patch: { doc_expiry_warning_days: days } });
              toast.success(ar ? "تم الحفظ" : "Saved");
            } catch (e) { toast.error((e as Error).message); }
          }}
        >
          {ar ? "حفظ" : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}

export const Route = createFileRoute("/_authenticated/settings/document-types")({
  component: DocumentTypesPage,
  head: () => ({ meta: [{ title: "أنواع مستندات الشركة | Company Document Types" }] }),
});

type Dept = { id: string; name: string; name_ar: string | null; name_en: string | null };

function DocumentTypesPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data: types = [], isLoading } = useDocumentTypes();
  const upsert = useUpsertDocumentType();
  const del = useDeleteDocumentType();
  const confirm = useConfirm();
  const [depts, setDepts] = useState<Dept[]>([]);
  const [editing, setEditing] = useState<Partial<DocumentType> | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("departments")
        .select("id,name,name_ar,name_en")
        .is("deleted_at", null)
        .order("name");
      setDepts((data ?? []) as Dept[]);
    })();
  }, []);

  const deptName = (id: string) => {
    const d = depts.find((x) => x.id === id);
    if (!d) return id.slice(0, 6);
    return ar ? (d.name_ar || d.name) : (d.name_en || d.name);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FolderArchive className="h-5 w-5 text-primary" />
            {ar ? "أنواع مستندات الشركة" : "Company Document Types"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {ar
              ? "أنواع المستندات الرسمية والأقسام المسؤولة عنها وإعدادات التنبيه."
              : "Official document types, responsible departments, and reminder settings."}
          </p>
        </div>
        <Button onClick={() => setEditing({ default_department_ids: [], notify_days_before: 30, notify_repeat: "weekly" })}>
          <Plus className="h-4 w-4 me-1" />
          {ar ? "نوع جديد" : "New Type"}
        </Button>
      </div>

      <ExpiryWindowCard ar={ar} />

      {isLoading ? (
        <div className="text-muted-foreground text-sm">{ar ? "جاري التحميل..." : "Loading..."}</div>
      ) : (
        <div className="grid gap-3">
          {types.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2 flex-row items-start justify-between gap-2 space-y-0">
                <div className="min-w-0">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    {ar ? t.name_ar : t.name_en}
                    <Badge variant="secondary" className="text-[10px]">{t.code}</Badge>
                    {t.is_system && <Badge variant="outline" className="text-[10px]">{ar ? "افتراضي" : "System"}</Badge>}
                  </CardTitle>
                  {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(t)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {!t.is_system && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        const ok = await confirm({
                          title: ar ? "حذف النوع؟" : "Delete type?",
                          description: ar ? "سيتم حذف النوع نهائياً." : "This will delete the type permanently.",
                        });
                        if (!ok) return;
                        try { await del.mutateAsync(t.id); toast.success(ar ? "تم الحذف" : "Deleted"); }
                        catch (e) { toast.error((e as Error).message); }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-xs space-y-2">
                <div className="flex flex-wrap gap-1">
                  <span className="text-muted-foreground me-1">{ar ? "الأقسام المسؤولة:" : "Responsible depts:"}</span>
                  {t.default_department_ids.length ? (
                    t.default_department_ids.map((id) => (
                      <Badge key={id} variant="secondary">{deptName(id)}</Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">{ar ? "غير محدد" : "None"}</span>
                  )}
                </div>
                <div className="text-muted-foreground">
                  {ar ? "تنبيه قبل" : "Notify"} <strong>{t.notify_days_before}</strong> {ar ? "يوم" : "days"} · {ar ? "تكرار" : "repeat"}: <strong>{t.notify_repeat}</strong>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TypeEditor
        open={!!editing}
        value={editing}
        depts={depts}
        onClose={() => setEditing(null)}
        onSave={async (v) => {
          try {
            await upsert.mutateAsync(v as any);
            toast.success(ar ? "تم الحفظ" : "Saved");
            setEditing(null);
          } catch (e) { toast.error((e as Error).message); }
        }}
      />
    </div>

  );
}

function TypeEditor({
  open, value, depts, onClose, onSave,
}: {
  open: boolean;
  value: Partial<DocumentType> | null;
  depts: Dept[];
  onClose: () => void;
  onSave: (v: Partial<DocumentType>) => void;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [v, setV] = useState<Partial<DocumentType>>({});
  useEffect(() => { setV(value ?? {}); }, [value]);

  const toggleDept = (id: string) => {
    const cur = new Set(v.default_department_ids ?? []);
    if (cur.has(id)) cur.delete(id); else cur.add(id);
    setV({ ...v, default_department_ids: Array.from(cur) });
  };

  const canSave = useMemo(() => !!(v.code?.trim() && v.name_ar?.trim() && v.name_en?.trim()), [v]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{v.id ? (ar ? "تعديل نوع مستند" : "Edit Document Type") : (ar ? "نوع مستند جديد" : "New Document Type")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>{ar ? "الاسم بالعربية" : "Name (AR)"}</Label>
              <Input autoFocus value={v.name_ar ?? ""} onChange={(e) => setV({ ...v, name_ar: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>{ar ? "الاسم بالإنجليزية" : "Name (EN)"}</Label>
              <Input value={v.name_en ?? ""} onChange={(e) => setV({ ...v, name_en: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{ar ? "الكود" : "Code"}</Label>
            <Input
              value={v.code ?? ""}
              disabled={v.is_system}
              onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") })}
              placeholder="e.g. CR_2025"
            />
          </div>
          <div className="space-y-1">
            <Label>{ar ? "وصف (اختياري)" : "Description (optional)"}</Label>
            <Textarea rows={2} value={v.description ?? ""} onChange={(e) => setV({ ...v, description: e.target.value })} />
          </div>

          <div className="space-y-1">
            <Label>{ar ? "الأقسام المسؤولة افتراضياً" : "Default responsible departments"}</Label>
            <div className="rounded-md border p-2 max-h-48 overflow-y-auto grid grid-cols-2 gap-1">
              {depts.map((d) => {
                const checked = (v.default_department_ids ?? []).includes(d.id);
                return (
                  <label key={d.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-muted cursor-pointer">
                    <Checkbox checked={checked} onCheckedChange={() => toggleDept(d.id)} />
                    <span className="truncate">{ar ? (d.name_ar || d.name) : (d.name_en || d.name)}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>{ar ? "تنبيه قبل (أيام)" : "Notify before (days)"}</Label>
              <Input
                type="number" min={0}
                value={v.notify_days_before ?? 30}
                onChange={(e) => setV({ ...v, notify_days_before: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
            <div className="space-y-1">
              <Label>{ar ? "تكرار التنبيه" : "Repeat"}</Label>
              <Select
                value={(v.notify_repeat as NotifyRepeat) ?? "weekly"}
                onValueChange={(val) => setV({ ...v, notify_repeat: val as NotifyRepeat })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{ar ? "يومي" : "Daily"}</SelectItem>
                  <SelectItem value="weekly">{ar ? "أسبوعي" : "Weekly"}</SelectItem>
                  <SelectItem value="monthly">{ar ? "شهري" : "Monthly"}</SelectItem>
                  <SelectItem value="none">{ar ? "بدون" : "None"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{ar ? "إلغاء" : "Cancel"}</Button>
          <Button disabled={!canSave} onClick={() => onSave(v)}>{ar ? "حفظ" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
