import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, CheckCircle2, XCircle, Calendar, Hash, Workflow, Lock, HardDrive, History, Save } from "lucide-react";
import { toast } from "sonner";
import {
  useFiscalYears, useCreateFiscalYear, useDeleteFiscalYear, useSetCurrentFiscalYear,
  useNumberingSeries, useUpsertNumbering, useUpdateNumbering, useDeleteNumbering,
  useApprovalMatrix, useCreateApprovalRule, useDeleteApprovalRule,
  usePasswordPolicy, useUpsertPasswordPolicy,
  useBackupSettings, useUpsertBackupSettings,
  useLoginHistory,
} from "@/modules/foundation/queries";
import { previewNumbering } from "@/modules/foundation/api";

export const Route = createFileRoute("/_authenticated/settings/foundation")({
  component: FoundationPage,
  head: () => ({ meta: [{ title: "الأساس | Foundation Settings" }] }),
});

function FoundationPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{ar ? "إعدادات الأساس" : "Foundation Settings"}</h2>
        <p className="text-sm text-muted-foreground">
          {ar ? "السنوات المالية، الترقيم، مصفوفة الاعتمادات، سياسات الأمن والنسخ الاحتياطي." : "Fiscal years, numbering, approval matrix, security & backup policies."}
        </p>
      </div>

      <Tabs defaultValue="fy" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="fy" className="gap-1"><Calendar className="h-4 w-4" />{ar ? "السنوات المالية" : "Fiscal Years"}</TabsTrigger>
          <TabsTrigger value="num" className="gap-1"><Hash className="h-4 w-4" />{ar ? "الترقيم" : "Numbering"}</TabsTrigger>
          <TabsTrigger value="matrix" className="gap-1"><Workflow className="h-4 w-4" />{ar ? "مصفوفة الاعتمادات" : "Approval Matrix"}</TabsTrigger>
          <TabsTrigger value="pw" className="gap-1"><Lock className="h-4 w-4" />{ar ? "سياسة كلمة المرور" : "Password Policy"}</TabsTrigger>
          <TabsTrigger value="bk" className="gap-1"><HardDrive className="h-4 w-4" />{ar ? "النسخ الاحتياطي" : "Backup"}</TabsTrigger>
          <TabsTrigger value="hist" className="gap-1"><History className="h-4 w-4" />{ar ? "سجل الدخول" : "Login History"}</TabsTrigger>
        </TabsList>

        <TabsContent value="fy"><FiscalYearsTab ar={ar} /></TabsContent>
        <TabsContent value="num"><NumberingTab ar={ar} /></TabsContent>
        <TabsContent value="matrix"><ApprovalMatrixTab ar={ar} /></TabsContent>
        <TabsContent value="pw"><PasswordPolicyTab ar={ar} /></TabsContent>
        <TabsContent value="bk"><BackupTab ar={ar} /></TabsContent>
        <TabsContent value="hist"><LoginHistoryTab ar={ar} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ==================== FISCAL YEARS ====================
function FiscalYearsTab({ ar }: { ar: boolean }) {
  const { data = [], isLoading } = useFiscalYears();
  const create = useCreateFiscalYear();
  const del = useDeleteFiscalYear();
  const setCurrent = useSetCurrentFiscalYear();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "", is_current: false, is_closed: false, notes: "" });

  const submit = async () => {
    if (!form.name || !form.start_date || !form.end_date) {
      toast.error(ar ? "املأ كل الحقول" : "Fill all required fields");
      return;
    }
    try {
      await create.mutateAsync(form);
      toast.success(ar ? "تم الإنشاء" : "Created");
      setOpen(false);
      setForm({ name: "", start_date: "", end_date: "", is_current: false, is_closed: false, notes: "" });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{ar ? "السنوات المالية" : "Fiscal Years"}</CardTitle>
          <CardDescription>{ar ? "أنشئ سنة مالية واحدة أو أكثر وحدد الحالية." : "Create one or more fiscal years and mark the current one."}</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 me-1" />{ar ? "إضافة" : "Add"}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{ar ? "سنة مالية جديدة" : "New Fiscal Year"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{ar ? "الاسم" : "Name"}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="FY 2026" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{ar ? "من" : "Start"}</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                <div><Label>{ar ? "إلى" : "End"}</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.is_current} onCheckedChange={(v) => setForm({ ...form, is_current: v })} /><Label>{ar ? "السنة الحالية" : "Current"}</Label></div>
              <div><Label>{ar ? "ملاحظات" : "Notes"}</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submit} disabled={create.isPending}>{ar ? "حفظ" : "Save"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="text-sm text-muted-foreground">…</div> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>{ar ? "الاسم" : "Name"}</TableHead>
              <TableHead>{ar ? "من" : "Start"}</TableHead>
              <TableHead>{ar ? "إلى" : "End"}</TableHead>
              <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((fy) => (
                <TableRow key={fy.id}>
                  <TableCell className="font-medium">{fy.name}</TableCell>
                  <TableCell>{fy.start_date}</TableCell>
                  <TableCell>{fy.end_date}</TableCell>
                  <TableCell className="flex gap-1">
                    {fy.is_current && <Badge>{ar ? "الحالية" : "Current"}</Badge>}
                    {fy.is_closed && <Badge variant="secondary">{ar ? "مقفلة" : "Closed"}</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {!fy.is_current && <Button size="sm" variant="ghost" onClick={() => setCurrent.mutate(fy.id)}>{ar ? "اجعلها الحالية" : "Set current"}</Button>}
                    <Button size="sm" variant="ghost" onClick={() => del.mutate(fy.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{ar ? "لا توجد سنوات مالية." : "No fiscal years yet."}</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== NUMBERING ====================
function NumberingTab({ ar }: { ar: boolean }) {
  const { data = [], isLoading } = useNumberingSeries();
  const upsert = useUpsertNumbering();
  const update = useUpdateNumbering();
  const del = useDeleteNumbering();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    doc_type: "",
    label_ar: "",
    label_en: "",
    prefix: "",
    padding: 6,
    reset_policy: "yearly" as "never" | "yearly" | "monthly" | "daily",
    format_template: "{prefix}-{year}-{seq}",
    next_seq: 1,
  });

  const submit = async () => {
    if (!form.doc_type || !form.prefix) { toast.error(ar ? "نوع المستند والبادئة مطلوبان" : "doc_type and prefix required"); return; }
    try {
      await upsert.mutateAsync(form);
      toast.success(ar ? "تم الحفظ" : "Saved");
      setOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{ar ? "سلاسل الترقيم" : "Numbering Series"}</CardTitle>
          <CardDescription>{ar ? "قالب ومتغيرات: {prefix} {year} {month} {day} {seq}" : "Template variables: {prefix} {year} {month} {day} {seq}"}</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 me-1" />{ar ? "إضافة" : "Add"}</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{ar ? "سلسلة ترقيم" : "Numbering Series"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{ar ? "نوع المستند (Key)" : "Doc type (key)"}</Label><Input value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })} placeholder="invoice / po / quote" /></div>
                <div><Label>{ar ? "البادئة" : "Prefix"}</Label><Input value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} placeholder="INV" /></div>
                <div><Label>{ar ? "التسمية بالعربية" : "Label AR"}</Label><Input value={form.label_ar} onChange={(e) => setForm({ ...form, label_ar: e.target.value })} /></div>
                <div><Label>{ar ? "التسمية بالإنجليزية" : "Label EN"}</Label><Input value={form.label_en} onChange={(e) => setForm({ ...form, label_en: e.target.value })} /></div>
                <div><Label>{ar ? "حشو الأرقام" : "Padding"}</Label><Input type="number" min={3} max={12} value={form.padding} onChange={(e) => setForm({ ...form, padding: parseInt(e.target.value || "6") })} /></div>
                <div>
                  <Label>{ar ? "إعادة التصفير" : "Reset"}</Label>
                  <Select value={form.reset_policy} onValueChange={(v: any) => setForm({ ...form, reset_policy: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">{ar ? "أبداً" : "Never"}</SelectItem>
                      <SelectItem value="yearly">{ar ? "سنوي" : "Yearly"}</SelectItem>
                      <SelectItem value="monthly">{ar ? "شهري" : "Monthly"}</SelectItem>
                      <SelectItem value="daily">{ar ? "يومي" : "Daily"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>{ar ? "قالب الصيغة" : "Format template"}</Label><Input value={form.format_template} onChange={(e) => setForm({ ...form, format_template: e.target.value })} /></div>
              <div className="bg-muted rounded p-2 text-sm">
                <span className="text-muted-foreground me-2">{ar ? "معاينة:" : "Preview:"}</span>
                <code className="font-bold">{previewNumbering(form)}</code>
              </div>
            </div>
            <DialogFooter><Button onClick={submit} disabled={upsert.isPending}>{ar ? "حفظ" : "Save"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="text-sm text-muted-foreground">…</div> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>{ar ? "النوع" : "Type"}</TableHead>
              <TableHead>{ar ? "البادئة" : "Prefix"}</TableHead>
              <TableHead>{ar ? "التصفير" : "Reset"}</TableHead>
              <TableHead>{ar ? "التالي" : "Next"}</TableHead>
              <TableHead>{ar ? "المعاينة" : "Preview"}</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.doc_type}<div className="text-xs text-muted-foreground">{ar ? s.label_ar : s.label_en}</div></TableCell>
                  <TableCell><Input className="h-8 w-24" value={s.prefix} onChange={(e) => update.mutate({ id: s.id, patch: { prefix: e.target.value } })} /></TableCell>
                  <TableCell>
                    <Select value={s.reset_policy} onValueChange={(v: any) => update.mutate({ id: s.id, patch: { reset_policy: v } })}>
                      <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="never">{ar ? "أبداً" : "Never"}</SelectItem>
                        <SelectItem value="yearly">{ar ? "سنوي" : "Yearly"}</SelectItem>
                        <SelectItem value="monthly">{ar ? "شهري" : "Monthly"}</SelectItem>
                        <SelectItem value="daily">{ar ? "يومي" : "Daily"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input className="h-8 w-20" type="number" value={s.next_seq} onChange={(e) => update.mutate({ id: s.id, patch: { next_seq: parseInt(e.target.value || "1") } })} /></TableCell>
                  <TableCell><code className="text-xs">{previewNumbering(s)}</code></TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => del.mutate(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
              {data.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{ar ? "لا توجد سلاسل." : "No series yet."}</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== APPROVAL MATRIX ====================
const ENTITY_TYPES = [
  { value: "purchase_order", ar: "أمر شراء", en: "Purchase Order" },
  { value: "sales_order", ar: "أمر بيع", en: "Sales Order" },
  { value: "quotation", ar: "عرض سعر", en: "Quotation" },
  { value: "stock_transfer", ar: "تحويل مخزون", en: "Stock Transfer" },
  { value: "stock_adjustment", ar: "ضبط مخزون", en: "Stock Adjustment" },
  { value: "sales_invoice", ar: "فاتورة بيع", en: "Sales Invoice" },
  { value: "purchase_invoice", ar: "فاتورة شراء", en: "Purchase Invoice" },
];
const APP_ROLES = ["owner", "admin", "manager", "user"];

function ApprovalMatrixTab({ ar }: { ar: boolean }) {
  const { data = [], isLoading } = useApprovalMatrix();
  const create = useCreateApprovalRule();
  const del = useDeleteApprovalRule();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    entity_type: "purchase_order",
    action: "post",
    stage_no: 1,
    min_amount: "" as string,
    max_amount: "" as string,
    currency: "" as string,
    required_app_role: "admin",
    is_active: true,
  });

  const submit = async () => {
    try {
      await create.mutateAsync({
        entity_type: form.entity_type,
        action: form.action,
        stage_no: form.stage_no,
        min_amount: form.min_amount ? Number(form.min_amount) : null,
        max_amount: form.max_amount ? Number(form.max_amount) : null,
        currency: form.currency || null,
        required_app_role: form.required_app_role as any,
        is_active: form.is_active,
      });
      toast.success(ar ? "تم" : "Created");
      setOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{ar ? "مصفوفة الاعتمادات" : "Approval Matrix"}</CardTitle>
          <CardDescription>{ar ? "مراحل موافقة متسلسلة حسب نوع المستند والمبلغ." : "Sequential approval stages by document type and amount."}</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 me-1" />{ar ? "قاعدة" : "Rule"}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{ar ? "قاعدة اعتماد" : "Approval Rule"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{ar ? "نوع المستند" : "Entity"}</Label>
                  <Select value={form.entity_type} onValueChange={(v) => setForm({ ...form, entity_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ENTITY_TYPES.map((e) => <SelectItem key={e.value} value={e.value}>{ar ? e.ar : e.en}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{ar ? "الإجراء" : "Action"}</Label><Input value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} /></div>
                <div><Label>{ar ? "المرحلة" : "Stage"}</Label><Input type="number" min={1} value={form.stage_no} onChange={(e) => setForm({ ...form, stage_no: parseInt(e.target.value || "1") })} /></div>
                <div>
                  <Label>{ar ? "الدور المطلوب" : "Required role"}</Label>
                  <Select value={form.required_app_role} onValueChange={(v) => setForm({ ...form, required_app_role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{APP_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{ar ? "أدنى مبلغ" : "Min amount"}</Label><Input type="number" value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: e.target.value })} /></div>
                <div><Label>{ar ? "أعلى مبلغ" : "Max amount"}</Label><Input type="number" value={form.max_amount} onChange={(e) => setForm({ ...form, max_amount: e.target.value })} /></div>
                <div><Label>{ar ? "العملة (اختياري)" : "Currency"}</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="EGP" /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={submit} disabled={create.isPending}>{ar ? "حفظ" : "Save"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="text-sm text-muted-foreground">…</div> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>{ar ? "المستند" : "Entity"}</TableHead>
              <TableHead>{ar ? "الإجراء" : "Action"}</TableHead>
              <TableHead>{ar ? "المرحلة" : "Stage"}</TableHead>
              <TableHead>{ar ? "المبلغ" : "Amount"}</TableHead>
              <TableHead>{ar ? "الدور" : "Role"}</TableHead>
              <TableHead>{ar ? "نشط" : "Active"}</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((r) => {
                const label = ENTITY_TYPES.find((e) => e.value === r.entity_type);
                return (
                  <TableRow key={r.id}>
                    <TableCell>{label ? (ar ? label.ar : label.en) : r.entity_type}</TableCell>
                    <TableCell><code className="text-xs">{r.action}</code></TableCell>
                    <TableCell>{r.stage_no}</TableCell>
                    <TableCell className="text-xs">
                      {r.min_amount != null && `≥ ${r.min_amount}`}
                      {r.min_amount != null && r.max_amount != null && " · "}
                      {r.max_amount != null && `≤ ${r.max_amount}`}
                      {r.currency && ` ${r.currency}`}
                    </TableCell>
                    <TableCell>{r.required_app_role}</TableCell>
                    <TableCell>{r.is_active ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                );
              })}
              {data.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{ar ? "لا توجد قواعد." : "No rules yet."}</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== PASSWORD POLICY ====================
function PasswordPolicyTab({ ar }: { ar: boolean }) {
  const { data } = usePasswordPolicy();
  const save = useUpsertPasswordPolicy();
  const [form, setForm] = useState<any>(null);

  const eff = form ?? data ?? {
    min_length: 8, require_uppercase: true, require_lowercase: true, require_number: true, require_symbol: false,
    expiry_days: 0, prevent_reuse_last_n: 3, lockout_attempts: 5, lockout_minutes: 15, session_timeout_minutes: 480, require_2fa: false,
  };
  const set = (k: string, v: any) => setForm({ ...eff, [k]: v });

  const submit = async () => {
    try {
      await save.mutateAsync(eff);
      toast.success(ar ? "تم الحفظ" : "Saved");
      setForm(null);
    } catch (e: any) { toast.error(e.message); }
  };

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between border-b py-2 gap-3"><Label className="flex-1">{label}</Label><div>{children}</div></div>
  );

  return (
    <Card>
      <CardHeader><CardTitle>{ar ? "سياسة كلمة المرور" : "Password Policy"}</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        <Row label={ar ? "الحد الأدنى للطول" : "Min length"}><Input className="w-24" type="number" min={4} max={64} value={eff.min_length} onChange={(e) => set("min_length", parseInt(e.target.value || "8"))} /></Row>
        <Row label={ar ? "اشتراط حرف كبير" : "Require uppercase"}><Switch checked={eff.require_uppercase} onCheckedChange={(v) => set("require_uppercase", v)} /></Row>
        <Row label={ar ? "اشتراط حرف صغير" : "Require lowercase"}><Switch checked={eff.require_lowercase} onCheckedChange={(v) => set("require_lowercase", v)} /></Row>
        <Row label={ar ? "اشتراط رقم" : "Require number"}><Switch checked={eff.require_number} onCheckedChange={(v) => set("require_number", v)} /></Row>
        <Row label={ar ? "اشتراط رمز خاص" : "Require symbol"}><Switch checked={eff.require_symbol} onCheckedChange={(v) => set("require_symbol", v)} /></Row>
        <Row label={ar ? "انتهاء الصلاحية (أيام، 0=أبداً)" : "Expiry days (0=never)"}><Input className="w-24" type="number" min={0} value={eff.expiry_days} onChange={(e) => set("expiry_days", parseInt(e.target.value || "0"))} /></Row>
        <Row label={ar ? "منع إعادة استخدام آخر N" : "Prevent reuse last N"}><Input className="w-24" type="number" min={0} value={eff.prevent_reuse_last_n} onChange={(e) => set("prevent_reuse_last_n", parseInt(e.target.value || "0"))} /></Row>
        <Row label={ar ? "محاولات القفل" : "Lockout attempts"}><Input className="w-24" type="number" min={1} value={eff.lockout_attempts} onChange={(e) => set("lockout_attempts", parseInt(e.target.value || "5"))} /></Row>
        <Row label={ar ? "مدة القفل (دقائق)" : "Lockout minutes"}><Input className="w-24" type="number" min={1} value={eff.lockout_minutes} onChange={(e) => set("lockout_minutes", parseInt(e.target.value || "15"))} /></Row>
        <Row label={ar ? "انتهاء الجلسة (دقائق)" : "Session timeout (min)"}><Input className="w-24" type="number" min={5} value={eff.session_timeout_minutes} onChange={(e) => set("session_timeout_minutes", parseInt(e.target.value || "480"))} /></Row>
        <Row label={ar ? "اشتراط 2FA" : "Require 2FA"}><Switch checked={eff.require_2fa} onCheckedChange={(v) => set("require_2fa", v)} /></Row>
        <div className="pt-3 flex justify-end"><Button onClick={submit} disabled={save.isPending}><Save className="h-4 w-4 me-1" />{ar ? "حفظ" : "Save"}</Button></div>
      </CardContent>
    </Card>
  );
}

// ==================== BACKUP ====================
function BackupTab({ ar }: { ar: boolean }) {
  const { data } = useBackupSettings();
  const save = useUpsertBackupSettings();
  const [form, setForm] = useState<any>(null);
  const eff = form ?? data ?? { enabled: true, retention_days: 30, notify_email: "" };
  const set = (k: string, v: any) => setForm({ ...eff, [k]: v });

  const submit = async () => {
    try {
      await save.mutateAsync(eff);
      toast.success(ar ? "تم الحفظ" : "Saved");
      setForm(null);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ar ? "إعدادات النسخ الاحتياطي" : "Backup Settings"}</CardTitle>
        <CardDescription>{ar ? "النسخ الاحتياطي الفعلي تُديره منصة Cloud." : "Actual backups are managed by the platform."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2"><Switch checked={eff.enabled} onCheckedChange={(v) => set("enabled", v)} /><Label>{ar ? "مُفعّل" : "Enabled"}</Label></div>
        <div><Label>{ar ? "مدة الاحتفاظ (أيام)" : "Retention (days)"}</Label><Input type="number" min={1} max={3650} value={eff.retention_days} onChange={(e) => set("retention_days", parseInt(e.target.value || "30"))} /></div>
        <div><Label>{ar ? "إيميل التنبيه" : "Notification email"}</Label><Input type="email" value={eff.notify_email ?? ""} onChange={(e) => set("notify_email", e.target.value)} /></div>
        {data?.last_backup_at && <div className="text-xs text-muted-foreground">{ar ? "آخر نسخة:" : "Last backup:"} {new Date(data.last_backup_at).toLocaleString()}</div>}
        <div className="flex justify-end"><Button onClick={submit} disabled={save.isPending}><Save className="h-4 w-4 me-1" />{ar ? "حفظ" : "Save"}</Button></div>
      </CardContent>
    </Card>
  );
}

// ==================== LOGIN HISTORY ====================
function LoginHistoryTab({ ar }: { ar: boolean }) {
  const { data = [], isLoading } = useLoginHistory(200);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{ar ? "سجل الدخول" : "Login History"}</CardTitle>
        <CardDescription>{ar ? "يرى المستخدم سجله فقط، والأدمن يرى الكل." : "Users see their own; admins see all."}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="text-sm text-muted-foreground">…</div> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>{ar ? "التاريخ" : "Date"}</TableHead>
              <TableHead>{ar ? "الإيميل" : "Email"}</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
              <TableHead>{ar ? "المتصفح" : "User Agent"}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">{r.email}</TableCell>
                  <TableCell className="text-xs font-mono">{r.ip_address ?? "-"}</TableCell>
                  <TableCell>{r.success ? <Badge>{ar ? "ناجح" : "Success"}</Badge> : <Badge variant="destructive">{ar ? "فشل" : "Failed"}</Badge>}</TableCell>
                  <TableCell className="text-xs max-w-xs truncate">{r.user_agent ?? "-"}</TableCell>
                </TableRow>
              ))}
              {data.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{ar ? "لا يوجد سجل." : "No records."}</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
