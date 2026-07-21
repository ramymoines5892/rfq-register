import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import {
  useCurrentDocuments,
  useDocumentTypes,
  useDocumentHistory,
  useDocumentFiles,
  useCreateDocument,
} from "@/features/companyDocs/queries";
import type { CompanyDocument, DocumentType, NotifyRepeat } from "@/features/companyDocs/api";
import { getSignedFileUrl } from "@/features/companyDocs/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { FolderArchive, Plus, Upload, History, Paperclip, AlertTriangle, CheckCircle2, Clock, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/documents")({
  component: DocumentsPage,
  head: () => ({ meta: [{ title: "مستندات الشركة | Company Documents" }] }),
});

type Dept = { id: string; name: string; name_ar: string | null; name_en: string | null };

function daysBetween(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - today.getTime()) / 86400000);
}

function statusMeta(doc: CompanyDocument | undefined, type: DocumentType, ar: boolean) {
  if (!doc) return { label: ar ? "غير مُضاف" : "Missing", color: "bg-muted text-foreground/70", icon: FileText };
  const days = daysBetween(doc.expiry_date);
  if (days === null) return { label: ar ? "بدون تاريخ انتهاء" : "No expiry", color: "bg-secondary text-secondary-foreground", icon: CheckCircle2 };
  if (days < 0) return { label: ar ? `منتهي منذ ${Math.abs(days)} يوم` : `Expired ${Math.abs(days)}d ago`, color: "bg-destructive/10 text-destructive", icon: AlertTriangle };
  const threshold = doc.notify_days_before ?? type.notify_days_before;
  if (days <= threshold) return { label: ar ? `ينتهي خلال ${days} يوم` : `Expires in ${days}d`, color: "bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: Clock };
  return { label: ar ? `صالح (${days} يوم)` : `Valid (${days}d)`, color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", icon: CheckCircle2 };
}

function DocumentsPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const { data: types = [] } = useDocumentTypes();
  const { data: currents = [] } = useCurrentDocuments();
  const [depts, setDepts] = useState<Dept[]>([]);
  const [addingType, setAddingType] = useState<DocumentType | null>(null);
  const [historyType, setHistoryType] = useState<DocumentType | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("departments").select("id,name,name_ar,name_en").is("deleted_at", null).order("name");
      setDepts((data ?? []) as Dept[]);
    })();
  }, []);

  const currentByType = useMemo(() => {
    const m = new Map<string, CompanyDocument>();
    for (const d of currents) if (!m.has(d.type_id)) m.set(d.type_id, d);
    return m;
  }, [currents]);

  const deptName = (id: string) => {
    const d = depts.find((x) => x.id === id);
    if (!d) return id.slice(0, 6);
    return ar ? (d.name_ar || d.name) : (d.name_en || d.name);
  };

  return (
    <div className="min-h-screen bg-muted/20" dir={dir}>
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <FolderArchive className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">{ar ? "مستندات الشركة" : "Company Documents"}</h1>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-3">
        {!types.length ? (
          <div className="text-sm text-muted-foreground text-center py-12">
            {ar ? "لا توجد أنواع مستندات مُعدّة بعد. أضِفها من الإعدادات." : "No document types configured yet. Add them from Settings."}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {types.map((t) => {
              const cur = currentByType.get(t.id);
              const s = statusMeta(cur, t, ar);
              const Icon = s.icon;
              const depts = cur?.department_ids?.length ? cur.department_ids : t.default_department_ids;
              return (
                <Card key={t.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                          {ar ? t.name_ar : t.name_en}
                          <Badge variant="outline" className="text-[10px]">{t.code}</Badge>
                        </CardTitle>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${s.color}`}>
                        <Icon className="h-3 w-3" /> {s.label}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {cur ? (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-muted-foreground">{ar ? "الرقم:" : "Number:"}</span> {cur.doc_number || "—"}</div>
                        <div><span className="text-muted-foreground">{ar ? "الإصدار:" : "Issued:"}</span> {cur.issue_date || "—"}</div>
                        <div><span className="text-muted-foreground">{ar ? "الانتهاء:" : "Expires:"}</span> {cur.expiry_date || "—"}</div>
                        <div><FilesCount docId={cur.id} ar={ar} /></div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">{ar ? "لم يتم رفع مستند بعد." : "No document uploaded yet."}</div>
                    )}
                    <div className="flex flex-wrap gap-1 text-[10px]">
                      <span className="text-muted-foreground">{ar ? "المسؤولون:" : "Owners:"}</span>
                      {depts.length ? depts.map((id) => <Badge key={id} variant="secondary" className="text-[10px]">{deptName(id)}</Badge>) :
                        <span className="text-muted-foreground">{ar ? "غير محدد" : "None"}</span>}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" onClick={() => setAddingType(t)}>
                        <Plus className="h-3.5 w-3.5 me-1" />
                        {cur ? (ar ? "رفع نسخة جديدة" : "Upload new") : (ar ? "إضافة مستند" : "Add document")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setHistoryType(t)}>
                        <History className="h-3.5 w-3.5 me-1" />
                        {ar ? "السجل" : "History"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {addingType && (
        <AddDocumentDialog
          type={addingType}
          depts={depts}
          onClose={() => setAddingType(null)}
        />
      )}
      {historyType && (
        <HistoryDialog type={historyType} onClose={() => setHistoryType(null)} />
      )}
    </div>
  );
}

function FilesCount({ docId, ar }: { docId: string; ar: boolean }) {
  const { data = [] } = useDocumentFiles(docId);
  return (
    <span className="inline-flex items-center gap-1">
      <Paperclip className="h-3 w-3" />
      <span className="text-muted-foreground">{ar ? "مرفقات:" : "Files:"}</span> {data.length}
    </span>
  );
}

function AddDocumentDialog({
  type, depts, onClose,
}: {
  type: DocumentType;
  depts: Dept[];
  onClose: () => void;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const create = useCreateDocument();
  const [docNumber, setDocNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [customize, setCustomize] = useState(false);
  const [deptIds, setDeptIds] = useState<string[]>(type.default_department_ids);
  const [days, setDays] = useState<number>(type.notify_days_before);
  const [repeat, setRepeat] = useState<NotifyRepeat>(type.notify_repeat);
  const [files, setFiles] = useState<File[]>([]);

  const toggleDept = (id: string) => {
    const s = new Set(deptIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    setDeptIds(Array.from(s));
  };

  const submit = async () => {
    try {
      await create.mutateAsync({
        type_id: type.id,
        doc_number: docNumber || null,
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
        notes: notes || null,
        department_ids: customize ? deptIds : null,
        notify_days_before: customize ? days : null,
        notify_repeat: customize ? repeat : null,
        files,
      });
      toast.success(ar ? "تم حفظ المستند" : "Document saved");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{(ar ? "رفع مستند: " : "Upload document: ") + (ar ? type.name_ar : type.name_en)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>{ar ? "رقم المستند" : "Document number"}</Label>
            <Input autoFocus value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>{ar ? "تاريخ الإصدار" : "Issue date"}</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{ar ? "تاريخ الانتهاء" : "Expiry date"}</Label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{ar ? "ملاحظات" : "Notes"}</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{ar ? "المرفقات (متعددة)" : "Attachments (multiple)"}</Label>
            <Input
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && (
              <p className="text-xs text-muted-foreground">{files.length} {ar ? "ملف مختار" : "file(s) selected"}</p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={customize} onCheckedChange={(v) => setCustomize(!!v)} />
            {ar ? "تخصيص الأقسام وإعدادات التنبيه لهذا المستند" : "Customize departments & reminders for this document"}
          </label>

          {customize && (
            <div className="space-y-3 rounded-md border p-3 bg-muted/40">
              <div className="space-y-1">
                <Label>{ar ? "الأقسام المسؤولة" : "Responsible departments"}</Label>
                <div className="max-h-40 overflow-y-auto grid grid-cols-2 gap-1">
                  {depts.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-background cursor-pointer">
                      <Checkbox checked={deptIds.includes(d.id)} onCheckedChange={() => toggleDept(d.id)} />
                      <span className="truncate">{ar ? (d.name_ar || d.name) : (d.name_en || d.name)}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>{ar ? "تنبيه قبل (أيام)" : "Notify before (days)"}</Label>
                  <Input type="number" min={0} value={days} onChange={(e) => setDays(Math.max(0, Number(e.target.value) || 0))} />
                </div>
                <div className="space-y-1">
                  <Label>{ar ? "تكرار التنبيه" : "Repeat"}</Label>
                  <Select value={repeat} onValueChange={(v) => setRepeat(v as NotifyRepeat)}>
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
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{ar ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={submit} disabled={create.isPending}>
            <Upload className="h-4 w-4 me-1" />
            {create.isPending ? (ar ? "جارٍ الحفظ..." : "Saving...") : (ar ? "حفظ" : "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ type, onClose }: { type: DocumentType; onClose: () => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const { data: history = [], isLoading } = useDocumentHistory(type.id);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{(ar ? "سجل: " : "History: ") + (ar ? type.name_ar : type.name_en)}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">{ar ? "جاري التحميل..." : "Loading..."}</div>
        ) : history.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">{ar ? "لا توجد نسخ." : "No versions yet."}</div>
        ) : (
          <div className="space-y-3">
            {history.map((d, i) => (
              <Card key={d.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {i === 0 && !d.superseded_at ? (
                      <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" variant="outline">
                        {ar ? "الحالي" : "Current"}
                      </Badge>
                    ) : (
                      <Badge variant="outline">{ar ? "مؤرشف" : "Archived"}</Badge>
                    )}
                    {d.doc_number || (ar ? "بدون رقم" : "No number")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <div className="grid grid-cols-2 gap-1">
                    <div><span className="text-muted-foreground">{ar ? "الإصدار:" : "Issued:"}</span> {d.issue_date || "—"}</div>
                    <div><span className="text-muted-foreground">{ar ? "الانتهاء:" : "Expires:"}</span> {d.expiry_date || "—"}</div>
                    <div className="col-span-2"><span className="text-muted-foreground">{ar ? "أُضيف:" : "Added:"}</span> {new Date(d.created_at).toLocaleString()}</div>
                  </div>
                  {d.notes && <p className="text-muted-foreground">{d.notes}</p>}
                  <FilesList docId={d.id} ar={ar} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FilesList({ docId, ar }: { docId: string; ar: boolean }) {
  const { data = [] } = useDocumentFiles(docId);
  if (!data.length) return <div className="text-muted-foreground">{ar ? "لا مرفقات." : "No files."}</div>;
  return (
    <div className="space-y-1">
      {data.map((f) => (
        <button
          key={f.id}
          className="flex items-center gap-2 text-primary hover:underline text-xs"
          onClick={async () => {
            try {
              const url = await getSignedFileUrl(f.storage_path);
              window.open(url, "_blank");
            } catch (e) { toast.error((e as Error).message); }
          }}
        >
          <Paperclip className="h-3 w-3" />
          <span className="truncate max-w-xs">{f.file_name}</span>
        </button>
      ))}
    </div>
  );
}
