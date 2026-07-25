import { useMemo, useState } from "react";
import { Loader2, Plus, Search, Users2, Pencil, Trash2, User, Briefcase, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

import { useI18n } from "@/lib/i18n";
import { useAccess } from "@/hooks/useAccess";
import { useCurrentCompany } from "@/modules/company/queries";
import { useEmployees, useUpsertEmployee, useDeleteEmployee } from "@/modules/employees/queries";
import { useOrganizationData } from "@/modules/organization/queries";
import { useBranches } from "@/modules/branches/queries";
import type { Employee, EmploymentStatus, EmploymentType } from "@/modules/employees/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScriptInput } from "@/components/ScriptInput";

const STATUS_OPTIONS: { value: EmploymentStatus; ar: string; en: string; tone: string }[] = [
  { value: "planned",    ar: "مخطط",       en: "Planned",    tone: "bg-slate-100 text-slate-700" },
  { value: "active",     ar: "نشط",        en: "Active",     tone: "bg-emerald-100 text-emerald-700" },
  { value: "probation",  ar: "تحت التجربة", en: "Probation",  tone: "bg-amber-100 text-amber-700" },
  { value: "on_leave",   ar: "إجازة",       en: "On leave",   tone: "bg-blue-100 text-blue-700" },
  { value: "suspended",  ar: "موقوف",       en: "Suspended",  tone: "bg-orange-100 text-orange-700" },
  { value: "retired",    ar: "متقاعد",      en: "Retired",    tone: "bg-purple-100 text-purple-700" },
  { value: "resigned",   ar: "مستقيل",      en: "Resigned",   tone: "bg-rose-100 text-rose-700" },
  { value: "terminated", ar: "منتهى",       en: "Terminated", tone: "bg-red-100 text-red-700" },
  { value: "archived",   ar: "مؤرشف",       en: "Archived",   tone: "bg-neutral-200 text-neutral-700" },
];

const TYPE_OPTIONS: { value: EmploymentType; ar: string; en: string }[] = [
  { value: "full_time",   ar: "دوام كامل",    en: "Full time" },
  { value: "part_time",   ar: "دوام جزئى",    en: "Part time" },
  { value: "contract",    ar: "عقد",           en: "Contract" },
  { value: "temporary",   ar: "مؤقت",          en: "Temporary" },
  { value: "intern",      ar: "متدرب",         en: "Intern" },
  { value: "consultant",  ar: "مستشار",        en: "Consultant" },
  { value: "freelancer",  ar: "مستقل",         en: "Freelancer" },
];

export function EmployeesPanel() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const access = useAccess();
  const canManage = access.isAdmin;
  const { data: employees = [], isLoading } = useEmployees();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<EmploymentStatus | "all">("all");
  const [editing, setEditing] = useState<Employee | "new" | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (statusFilter !== "all" && e.employment_status !== statusFilter) return false;
      if (!q) return true;
      return [e.employee_number, e.full_name, e.email, e.phone, e.national_id]
        .filter(Boolean).some((v) => v!.toLowerCase().includes(q));
    });
  }, [employees, query, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={ar ? "بحث بالاسم، الرقم، البريد…" : "Search by name, number, email…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as EmploymentStatus | "all")}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ar ? "كل الحالات" : "All statuses"}</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{ar ? s.ar : s.en}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canManage && (
          <Button size="sm" className="gap-1.5" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> {ar ? "موظف جديد" : "New employee"}
          </Button>
        )}
        <Link to="/hr">
          <Button size="sm" variant="outline" className="gap-1.5">
            <ChevronRight className="h-4 w-4" /> {ar ? "الحسابات والصلاحيات" : "Users & permissions"}
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> {ar ? "جارٍ التحميل…" : "Loading…"}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center space-y-2">
            <Users2 className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <div className="text-sm font-medium">{ar ? "لا يوجد موظفون" : "No employees"}</div>
            <div className="text-xs text-muted-foreground">
              {ar ? "ابدأ بإضافة موظف — الشخص والوظيفة يُدارَان بشكل منفصل." : "Start by adding an employee — Person and Employment are managed separately."}
            </div>
            {canManage && (
              <Button size="sm" className="gap-1.5 mt-2" onClick={() => setEditing("new")}>
                <Plus className="h-4 w-4" /> {ar ? "إضافة موظف" : "Add employee"}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((emp) => (
            <EmployeeCard key={emp.id} employee={emp} canManage={canManage} onEdit={() => setEditing(emp)} />
          ))}
        </div>
      )}

      {editing && (
        <EmployeeEditor
          employee={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          canManage={canManage}
        />
      )}
    </div>
  );
}

function EmployeeCard({ employee, canManage, onEdit }: { employee: Employee; canManage: boolean; onEdit: () => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const del = useDeleteEmployee();
  const status = STATUS_OPTIONS.find((s) => s.value === employee.employment_status);
  const type = TYPE_OPTIONS.find((t) => t.value === employee.employment_type);
  const displayName = ar
    ? (employee.full_name_ar || employee.full_name)
    : (employee.full_name_en || employee.full_name);

  async function onDelete() {
    if (!confirm(ar ? "حذف الموظف؟" : "Delete employee?")) return;
    try {
      await del.mutateAsync(employee.id);
      toast.success(ar ? "تم الحذف" : "Deleted");
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  }

  return (
    <Card className="group hover:border-primary/60 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0 font-semibold">
            {(displayName || "?").trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{displayName || (ar ? "بدون اسم" : "Unnamed")}</div>
            {employee.employee_number && (
              <div className="text-[11px] font-mono text-muted-foreground">#{employee.employee_number}</div>
            )}
            {employee.email && <div className="text-xs text-muted-foreground truncate">{employee.email}</div>}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {status && <Badge className={`text-[10px] border-0 ${status.tone}`}>{ar ? status.ar : status.en}</Badge>}
          {type && <Badge variant="outline" className="text-[10px]">{ar ? type.ar : type.en}</Badge>}
        </div>

        <div className="flex gap-1.5 pt-1">
          <Button size="sm" variant="outline" className="flex-1 h-8 gap-1.5" onClick={onEdit}>
            <Pencil className="h-3 w-3" /> {ar ? "تعديل" : "Edit"}
          </Button>
          {canManage && (
            <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmployeeEditor({
  employee, onClose, canManage,
}: { employee: Employee | null; onClose: () => void; canManage: boolean }) {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const isNew = !employee;
  const { data: company } = useCurrentCompany();
  const { data: org } = useOrganizationData();
  const { data: branches = [] } = useBranches();
  const upsert = useUpsertEmployee();

  const [person, setPerson] = useState({
    first_name: employee?.person?.first_name ?? "",
    middle_name: employee?.person?.middle_name ?? "",
    last_name: employee?.person?.last_name ?? "",
    full_name_ar: employee?.person?.full_name_ar ?? employee?.full_name_ar ?? "",
    full_name_en: employee?.person?.full_name_en ?? employee?.full_name_en ?? "",
    national_id: employee?.person?.national_id ?? employee?.national_id ?? "",
    passport_no: employee?.person?.passport_no ?? employee?.passport_no ?? "",
    birth_date: employee?.person?.birth_date ?? "",
    gender: employee?.person?.gender ?? "",
    nationality: employee?.person?.nationality ?? "",
    personal_email: employee?.person?.personal_email ?? employee?.email ?? "",
    personal_phone: employee?.person?.personal_phone ?? employee?.phone ?? "",
  });

  const [emp, setEmp] = useState({
    employee_number: employee?.employee_number ?? "",
    employment_status: (employee?.employment_status ?? "active") as EmploymentStatus,
    employment_type: (employee?.employment_type ?? "full_time") as EmploymentType,
    branch_id: employee?.branch_id ?? "",
    department_id: employee?.department_id ?? "",
    position_id: employee?.position_id ?? "",
    direct_manager_id: employee?.direct_manager_id ?? "",
    joining_date: employee?.joining_date ?? "",
    termination_date: employee?.termination_date ?? "",
    cost_center: employee?.cost_center ?? "",
    notes: employee?.notes ?? "",
  });

  async function save() {
    if (!person.full_name_ar.trim() && !person.full_name_en.trim() && !person.first_name.trim()) {
      toast.error(ar ? "الاسم مطلوب" : "Name required");
      return;
    }
    try {
      await upsert.mutateAsync({
        id: employee?.id ?? null,
        payload: {
          person: {
            first_name: person.first_name || null,
            middle_name: person.middle_name || null,
            last_name: person.last_name || null,
            full_name_ar: person.full_name_ar || null,
            full_name_en: person.full_name_en || null,
            national_id: person.national_id || null,
            passport_no: person.passport_no || null,
            birth_date: person.birth_date || null,
            gender: person.gender || null,
            nationality: person.nationality || null,
            personal_email: person.personal_email || null,
            personal_phone: person.personal_phone || null,
          },
          employee: {
            company_id: company?.id ?? null,
            employee_number: emp.employee_number || null,
            employment_status: emp.employment_status,
            employment_type: emp.employment_type,
            branch_id: emp.branch_id || null,
            department_id: emp.department_id || null,
            position_id: emp.position_id || null,
            direct_manager_id: emp.direct_manager_id || null,
            joining_date: emp.joining_date || null,
            termination_date: emp.termination_date || null,
            cost_center: emp.cost_center || null,
            notes: emp.notes || null,
          },
        },
      });
      toast.success(ar ? "تم الحفظ" : "Saved");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  }

  const depts = org?.depts ?? [];
  const jobs = org?.jobs ?? [];

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={ar ? "left" : "right"} className="w-full sm:max-w-2xl overflow-y-auto scrollbar-slim" dir={dir}>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users2 className="h-4 w-4 text-primary" />
            {isNew ? (ar ? "إضافة موظف" : "Add employee") : (ar ? "تعديل موظف" : "Edit employee")}
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="person" className="mt-4">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="person" className="gap-1.5"><User className="h-3.5 w-3.5" /> {ar ? "البيانات الشخصية" : "Person"}</TabsTrigger>
            <TabsTrigger value="employment" className="gap-1.5"><Briefcase className="h-3.5 w-3.5" /> {ar ? "بيانات التوظيف" : "Employment"}</TabsTrigger>
          </TabsList>

          {/* Person Info */}
          <TabsContent value="person" className="space-y-3 mt-4">
            <div className="text-[11px] text-muted-foreground border-s-2 border-primary/30 ps-2">
              {ar
                ? "الهوية الشخصية ثابتة ولا تتغير بتغيير الوظيفة أو الشركة."
                : "Person identity is permanent — it does not change when the job or company changes."}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={ar ? "الاسم بالعربية" : "Full name (AR)"}>
                <ScriptInput script="arabic" isAr value={person.full_name_ar} onChange={(v) => setPerson({ ...person, full_name_ar: v })} dir="rtl" placeholder="أحمد محمد" />
              </Field>
              <Field label={ar ? "الاسم بالإنجليزية" : "Full name (EN)"}>
                <ScriptInput script="latin" value={person.full_name_en} onChange={(v) => setPerson({ ...person, full_name_en: v })} placeholder="Ahmed Mohamed" />
              </Field>
              <Field label={ar ? "الاسم الأول" : "First name"}>
                <Input value={person.first_name} onChange={(e) => setPerson({ ...person, first_name: e.target.value })} />
              </Field>
              <Field label={ar ? "الاسم الأوسط" : "Middle name"}>
                <Input value={person.middle_name} onChange={(e) => setPerson({ ...person, middle_name: e.target.value })} />
              </Field>
              <Field label={ar ? "اسم العائلة" : "Last name"}>
                <Input value={person.last_name} onChange={(e) => setPerson({ ...person, last_name: e.target.value })} />
              </Field>
              <Field label={ar ? "الجنسية" : "Nationality"}>
                <Input value={person.nationality} onChange={(e) => setPerson({ ...person, nationality: e.target.value })} />
              </Field>
              <Field label={ar ? "الرقم القومى" : "National ID"}>
                <Input value={person.national_id} onChange={(e) => setPerson({ ...person, national_id: e.target.value })} />
              </Field>
              <Field label={ar ? "جواز السفر" : "Passport"}>
                <Input value={person.passport_no} onChange={(e) => setPerson({ ...person, passport_no: e.target.value })} />
              </Field>
              <Field label={ar ? "تاريخ الميلاد" : "Birth date"}>
                <Input type="date" value={person.birth_date} onChange={(e) => setPerson({ ...person, birth_date: e.target.value })} />
              </Field>
              <Field label={ar ? "النوع" : "Gender"}>
                <Select value={person.gender || undefined} onValueChange={(v) => setPerson({ ...person, gender: v })}>
                  <SelectTrigger><SelectValue placeholder={ar ? "اختر…" : "Select…"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{ar ? "ذكر" : "Male"}</SelectItem>
                    <SelectItem value="female">{ar ? "أنثى" : "Female"}</SelectItem>
                    <SelectItem value="other">{ar ? "أخرى" : "Other"}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={ar ? "البريد الشخصى" : "Personal email"}>
                <Input type="email" value={person.personal_email} onChange={(e) => setPerson({ ...person, personal_email: e.target.value })} />
              </Field>
              <Field label={ar ? "الهاتف الشخصى" : "Personal phone"}>
                <Input value={person.personal_phone} onChange={(e) => setPerson({ ...person, personal_phone: e.target.value })} />
              </Field>
            </div>
          </TabsContent>

          {/* Employment Info */}
          <TabsContent value="employment" className="space-y-3 mt-4">
            <div className="text-[11px] text-muted-foreground border-s-2 border-primary/30 ps-2">
              {ar
                ? "بيانات التوظيف تاريخية — قابلة للتغيير مع الاحتفاظ بسجل الشخص كما هو."
                : "Employment data is historical — it can change while the person's identity stays the same."}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={ar ? "رقم الموظف" : "Employee number"} hint={ar ? "فريد داخل الشركة" : "Unique in company"}>
                <Input value={emp.employee_number} onChange={(e) => setEmp({ ...emp, employee_number: e.target.value })} placeholder="EMP-0001" className="font-mono" />
              </Field>
              <Field label={ar ? "مركز التكلفة" : "Cost center"}>
                <Input value={emp.cost_center} onChange={(e) => setEmp({ ...emp, cost_center: e.target.value })} placeholder="CC-001" className="font-mono" />
              </Field>
              <Field label={ar ? "حالة التوظيف" : "Employment status"}>
                <Select value={emp.employment_status} onValueChange={(v) => setEmp({ ...emp, employment_status: v as EmploymentStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{ar ? s.ar : s.en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={ar ? "نوع التوظيف" : "Employment type"}>
                <Select value={emp.employment_type} onValueChange={(v) => setEmp({ ...emp, employment_type: v as EmploymentType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{ar ? t.ar : t.en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={ar ? "تاريخ الالتحاق" : "Joining date"}>
                <Input type="date" value={emp.joining_date} onChange={(e) => setEmp({ ...emp, joining_date: e.target.value })} />
              </Field>
              <Field label={ar ? "تاريخ الانتهاء" : "Termination date"}>
                <Input type="date" value={emp.termination_date} onChange={(e) => setEmp({ ...emp, termination_date: e.target.value })} />
              </Field>
              <Field label={ar ? "الفرع الافتراضى" : "Default branch"}>
                <Select value={emp.branch_id || undefined} onValueChange={(v) => setEmp({ ...emp, branch_id: v })}>
                  <SelectTrigger><SelectValue placeholder={ar ? "اختر…" : "Select…"} /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{ar ? (b.name_ar || b.name) : b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={ar ? "الإدارة الافتراضية" : "Default department"}>
                <Select value={emp.department_id || undefined} onValueChange={(v) => setEmp({ ...emp, department_id: v })}>
                  <SelectTrigger><SelectValue placeholder={ar ? "اختر…" : "Select…"} /></SelectTrigger>
                  <SelectContent>
                    {depts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{ar ? (d.name_ar || d.name) : d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={ar ? "الوظيفة" : "Position"}>
                <Select value={emp.position_id || undefined} onValueChange={(v) => setEmp({ ...emp, position_id: v })}>
                  <SelectTrigger><SelectValue placeholder={ar ? "اختر…" : "Select…"} /></SelectTrigger>
                  <SelectContent>
                    {jobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>{ar ? (j.name_ar || j.name) : j.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label={ar ? "ملاحظات" : "Notes"}>
              <Textarea rows={3} value={emp.notes} onChange={(e) => setEmp({ ...emp, notes: e.target.value })} />
            </Field>
          </TabsContent>
        </Tabs>

        <div className="sticky bottom-0 -mx-6 px-6 pt-3 pb-2 mt-4 border-t bg-background flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{ar ? "إلغاء" : "Cancel"}</Button>
          {canManage && (
            <Button onClick={save} disabled={upsert.isPending} className="gap-1.5">
              {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {ar ? "حفظ" : "Save"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">
        {label}
        {hint && <span className="text-[10px] text-muted-foreground font-normal ms-1">— {hint}</span>}
      </Label>
      {children}
    </div>
  );
}
