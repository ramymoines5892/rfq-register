import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, RotateCcw, ShieldAlert, ArrowLeft, Info, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  useDeletedRows,
  useOwnerCheck,
  usePurgeRow,
  useRestoreRow,
} from "@/features/trash/queries";
import type { DeletedRow } from "@/features/trash/api";

export const Route = createFileRoute("/_authenticated/settings/trash")({
  component: TrashPage,
  head: () => ({ meta: [{ title: "سلة المحذوفات | Trash" }] }),
});

/** Configurable per-table display. `label` is what shows in a deleted row. */
const TABLES = [
  { key: "customer_field_definitions", ar: "حقول الفورم",       en: "Form Fields",         label: ["label_ar", "label_en", "key"] },
  { key: "customers",                  ar: "العملاء",             en: "Customers",           label: ["name_ar", "name_en", "name"] },
  { key: "customer_contacts",          ar: "جهات الاتصال",        en: "Contacts",            label: ["name_ar", "name_en", "name"] },
  { key: "customer_banks",             ar: "البنوك",              en: "Banks",               label: ["bank_name_ar", "bank_name_en", "bank_name"] },
  { key: "customer_attachments",       ar: "ملفات العملاء",       en: "Customer Attachments", label: ["display_name", "file_name"] },
  { key: "quotes",                     ar: "العروض",              en: "Quotes",              label: ["quote_number", "title"] },
  { key: "quote_attachments",          ar: "ملفات العروض",        en: "Quote Attachments",   label: ["display_name", "file_name"] },
  { key: "workflow_templates",         ar: "قوالب المهام",         en: "Workflow Templates",  label: ["name"] },
  { key: "workflow_stages",            ar: "مراحل المهام",         en: "Workflow Stages",     label: ["name"] },
  { key: "departments",                ar: "الأقسام",             en: "Departments",         label: ["name_ar", "name_en", "name"] },
  { key: "job_titles",                 ar: "المسميات الوظيفية",   en: "Job Titles",          label: ["name_ar", "name_en", "name"] },
] as const;

type TableKey = (typeof TABLES)[number]["key"];

function TrashPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";

  const [tableKey, setTableKey] = useState<TableKey>("customer_field_definitions");
  const [purging, setPurging] = useState<{ id: string; label: string } | null>(null);
  const [password, setPassword] = useState("");

  const ownerQ = useOwnerCheck();
  const isOwner = ownerQ.data?.isOwner ?? null;
  const ownerEmail = ownerQ.data?.email ?? "";

  const listQ = useDeletedRows(tableKey, !!isOwner);
  const rows = listQ.data?.rows ?? [];
  const profiles = listQ.data?.profiles ?? {};
  const loading = listQ.isLoading || listQ.isFetching;

  const restoreM = useRestoreRow(tableKey);
  const purgeM = usePurgeRow(tableKey);
  const busy = purgeM.isPending;

  const currentTable = useMemo(() => TABLES.find((t) => t.key === tableKey)!, [tableKey]);

  async function restore(row: DeletedRow) {
    try {
      await restoreM.mutateAsync(row.id);
      toast.success(ar ? "تم الاسترجاع (الحقل مخفى — فعّله من الشاشة الأصلية)" : "Restored (item is hidden — enable it from its screen)");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function confirmPurge() {
    if (!purging) return;
    if (!password) { toast.error(ar ? "أدخل كلمة السر" : "Enter password"); return; }
    try {
      await purgeM.mutateAsync({ id: purging.id, email: ownerEmail, password });
      toast.success(ar ? "تم الحذف النهائي" : "Permanently deleted");
      setPurging(null);
      setPassword("");
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "BAD_PASSWORD") {
        toast.error(ar ? "كلمة السر غير صحيحة" : "Incorrect password");
      } else {
        toast.error(msg);
      }
    }
  }

  function labelFor(row: DeletedRow): string {
    for (const col of currentTable.label) {
      const v = row[col];
      if (typeof v === "string" && v.trim()) return v;
    }
    return row.id.slice(0, 8);
  }

  function actorLabel(row: DeletedRow): string {
    const id = row.deleted_by;
    if (!id) return ar ? "غير معروف" : "Unknown";
    const p = profiles[id];
    if (!p) return ar ? "مستخدم غير معروف" : "Unknown user";
    return p.full_name || p.email;
  }

  if (isOwner === null) return <div className="text-center py-8 text-muted-foreground">{ar ? "جاري التحقق..." : "Checking..."}</div>;

  if (!isOwner) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="p-6 text-center space-y-3">
          <ShieldAlert className="h-10 w-10 mx-auto text-destructive" />
          <h2 className="text-lg font-bold">{ar ? "للـ Owner فقط" : "Owner only"}</h2>
          <p className="text-sm text-muted-foreground">
            {ar ? "سلة المحذوفات متاحة للـ Owner (المالك) فقط." : "The trash is accessible to the Owner only."}
          </p>
          <Link to="/settings"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 me-1" />{ar ? "رجوع" : "Back"}</Button></Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div dir={dir} className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Trash2 className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">{ar ? "سلة المحذوفات" : "Trash"}</h2>
        <Badge variant="outline" className="text-[10px]">{ar ? "Owner فقط" : "Owner only"}</Badge>
        <div className="ms-auto">
          <Select value={tableKey} onValueChange={(v) => setTableKey(v as TableKey)}>
            <SelectTrigger className="h-9 w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TABLES.map((t) => (
                <SelectItem key={t.key} value={t.key}>{ar ? t.ar : t.en}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-dashed p-3 flex gap-2 items-start text-xs text-muted-foreground bg-muted/30">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          {ar
            ? "دي كل العناصر اللي حذفها أي مستخدم صاحب صلاحية. البيانات موجودة زي ما هي — إنت لوحدك اللي بتشوفها. الاسترجاع بيرجّعها مخفية (تفعّلها من شاشتها). الحذف النهائي بيطلب كلمة السر بتاعتك."
            : "Every item soft-deleted by any authorized user. Data is intact — only you see it. Restore brings it back hidden (re-enable it from its own screen). Permanent delete asks for your password."}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">{ar ? "تحميل..." : "Loading..."}</div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
          {ar ? "لا توجد عناصر محذوفة في هذا القسم." : "No deleted items in this section."}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardContent className="p-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-medium">{labelFor(row)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {ar ? "اتحذفت بواسطة" : "Deleted by"} <span className="font-medium text-foreground">{actorLabel(row)}</span>
                    {" · "}
                    {new Date(row.deleted_at).toLocaleString(ar ? "ar-EG" : "en-US")}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => restore(row)} className="gap-1">
                    <RotateCcw className="h-3.5 w-3.5" /> {ar ? "استرجاع" : "Restore"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { setPurging({ id: row.id, label: labelFor(row) }); setPassword(""); }}
                    className="gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {ar ? "حذف نهائي" : "Delete forever"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!purging} onOpenChange={(v) => { if (!v) { setPurging(null); setPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {ar ? "تأكيد الحذف النهائي" : "Confirm permanent deletion"}
            </DialogTitle>
            <DialogDescription>
              {ar
                ? "دي عملية لا رجعة فيها. البيانات هتتمسح للأبد. أدخل كلمة السر بتاعتك للتأكيد."
                : "This cannot be undone. The data will be erased forever. Enter your password to confirm."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded border bg-muted/40 p-2 text-xs">
              <span className="text-muted-foreground">{ar ? "العنصر:" : "Item:"} </span>
              <span className="font-medium">{purging?.label}</span>
            </div>
            <div>
              <Label>{ar ? "كلمة السر" : "Password"}</Label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") confirmPurge(); }}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setPurging(null); setPassword(""); }} disabled={busy}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={confirmPurge} disabled={busy || !password}>
              {busy ? (ar ? "جاري..." : "Working...") : (ar ? "احذف نهائيًا" : "Delete forever")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
