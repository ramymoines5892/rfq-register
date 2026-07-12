import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useConfirm } from "@/hooks/useConfirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputIcon } from "@/components/ui/input-icon";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Network, Building2, Briefcase, Plus, Trash2, Pencil, Search, Save, Sparkles, Settings,
} from "lucide-react";
import { OrgChart } from "@/components/organization/OrgChart";
import type { Database } from "@/integrations/supabase/types";

type Department = Database["public"]["Tables"]["departments"]["Row"];
type JobTitle = Database["public"]["Tables"]["job_titles"]["Row"];
type FieldTemplate = Database["public"]["Tables"]["org_field_templates"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const DEPT_COLORS = [
  "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ec4899",
  "#06b6d4", "#ef4444", "#84cc16", "#f97316", "#6366f1",
];

export const Route = createFileRoute("/_authenticated/settings/organization")({
  component: OrganizationPage,
  head: () => ({ meta: [{ title: "الهيكل التنظيمي | Organization" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
});

function OrganizationPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const confirm = useConfirm();

  const [tab, setTab] = useState<"departments" | "jobs">("departments");
  const [depts, setDepts] = useState<Department[]>([]);
  const [jobs, setJobs] = useState<JobTitle[]>([]);
  const [templates, setTemplates] = useState<FieldTemplate[]>([]);
  const [profiles, setProfiles] = useState<Pick<Profile, "id" | "full_name" | "email" | "department_id">[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ id: string; kind: "department" | "job_title" } | null>(null);
  const [showFieldsDialog, setShowFieldsDialog] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [d, j, t, p, roles, userRes] = await Promise.all([
      supabase.from("departments").select("*").is("deleted_at", null).order("position"),
      supabase.from("job_titles").select("*").is("deleted_at", null).order("position"),
      supabase.from("org_field_templates").select("*").order("position"),
      supabase.from("profiles").select("id, full_name, email, department_id"),
      supabase.auth.getUser().then(async ({ data }) => {
        if (!data.user) return { admin: false };
        const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
        return { admin: !!r?.some((x) => x.role === "owner" || x.role === "admin") };
      }),
      supabase.auth.getUser(),
    ]);
    setDepts((d.data ?? []) as Department[]);
    setJobs((j.data ?? []) as JobTitle[]);
    setTemplates((t.data ?? []) as FieldTemplate[]);
    setProfiles(p.data ?? []);
    setIsAdmin(roles.admin);
    setLoading(false);
    void userRes;
  }, []);

  useEffect(() => { load(); }, [load]);

  const memberCounts = useMemo(() => {
    const m: Record<string, number> = {};
    profiles.forEach((p) => { if (p.department_id) m[p.department_id] = (m[p.department_id] || 0) + 1; });
    return m;
  }, [profiles]);

  const filteredDepts = useMemo(() => {
    if (!query.trim()) return depts;
    const q = query.toLowerCase();
    return depts.filter((d) =>
      (d.name_ar || "").toLowerCase().includes(q) ||
      (d.name_en || "").toLowerCase().includes(q) ||
      (d.code || "").toLowerCase().includes(q)
    );
  }, [depts, query]);

  const filteredJobs = useMemo(() => {
    if (!query.trim()) return jobs;
    const q = query.toLowerCase();
    return jobs.filter((j) =>
      (j.name_ar || "").toLowerCase().includes(q) ||
      (j.name_en || "").toLowerCase().includes(q) ||
      (j.code || "").toLowerCase().includes(q)
    );
  }, [jobs, query]);

  const chartDepts = useMemo(
    () => depts.map((d) => ({ id: d.id, name: pick(d, lang), code: d.code, color: d.color, parent_id: d.parent_id })),
    [depts, lang]
  );
  const chartJobs = useMemo(
    () => jobs.map((j) => ({ id: j.id, name: pick(j, lang), code: j.code, department_id: j.department_id })),
    [jobs, lang]
  );

  const selectedRecord = useMemo(() => {
    if (!selected) return null;
    if (selected.kind === "department") return depts.find((d) => d.id === selected.id) ?? null;
    return jobs.find((j) => j.id === selected.id) ?? null;
  }, [selected, depts, jobs]);

  const addDept = async () => {
    const nextPos = (depts.at(-1)?.position ?? 0) + 1;
    const color = DEPT_COLORS[depts.length % DEPT_COLORS.length];
    const { data, error } = await supabase.from("departments").insert({
      name: ar ? "إدارة جديدة" : "New Department",
      name_ar: "إدارة جديدة", name_en: "New Department",
      color, position: nextPos,
    }).select().single();
    if (error) return toast.error(ar ? "تعذر الإضافة" : "Failed", { description: error.message });
    toast.success(ar ? "تمت الإضافة" : "Added");
    await load();
    setSelected({ id: data.id, kind: "department" });
  };

  const addJob = async () => {
    const nextPos = (jobs.at(-1)?.position ?? 0) + 1;
    const { data, error } = await supabase.from("job_titles").insert({
      name: ar ? "مسمى جديد" : "New Title",
      name_ar: "مسمى جديد", name_en: "New Title",
      level: 3, position: nextPos,
    }).select().single();
    if (error) return toast.error(ar ? "تعذر الإضافة" : "Failed", { description: error.message });
    toast.success(ar ? "تمت الإضافة" : "Added");
    await load();
    setSelected({ id: data.id, kind: "job_title" });
  };

  const remove = async (id: string, kind: "department" | "job_title") => {
    const ok = await confirm({
      title: ar ? "تأكيد الحذف" : "Confirm delete",
      description: ar ? "سيتم نقل السجل إلى سلة المحذوفات." : "The record will be moved to trash.",
      variant: "destructive",
    });
    if (!ok) return;
    const table = kind === "department" ? "departments" : "job_titles";
    const { error } = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(ar ? "تعذر الحذف" : "Failed", { description: error.message });
    toast.success(ar ? "تم الحذف" : "Deleted");
    if (selected?.id === id) setSelected(null);
    await load();
  };

  return (
    <div className="space-y-4" dir={dir}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Network className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{ar ? "الهيكل التنظيمي" : "Organization Structure"}</h2>
            <p className="text-xs text-muted-foreground">
              {ar ? "الإدارات والأقسام والمسميات الوظيفية" : "Departments, sections, and job titles"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowFieldsDialog(true)}>
              <Settings className="h-4 w-4 me-1" />
              {ar ? "حقول مخصصة" : "Custom fields"}
            </Button>
          )}
          <Button size="sm" onClick={tab === "departments" ? addDept : addJob}>
            <Plus className="h-4 w-4 me-1" />
            {tab === "departments" ? (ar ? "إدارة جديدة" : "New department") : (ar ? "مسمى جديد" : "New title")}
          </Button>
        </div>
      </div>

      {/* Org Chart */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground text-sm">
              {ar ? "جارٍ التحميل..." : "Loading..."}
            </div>
          ) : depts.length === 0 ? (
            <div className="h-[300px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Sparkles className="h-8 w-8" />
              <p className="text-sm">{ar ? "ابدأ بإضافة إدارة" : "Start by adding a department"}</p>
              <Button size="sm" onClick={addDept}><Plus className="h-4 w-4 me-1" />{ar ? "إضافة" : "Add"}</Button>
            </div>
          ) : (
            <OrgChart
              departments={chartDepts}
              jobTitles={chartJobs}
              memberCounts={memberCounts}
              selectedId={selected?.id ?? null}
              onSelect={(id, kind) => setSelected({ id, kind })}
            />
          )}
        </CardContent>
      </Card>

      {/* Tabs + Lists */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "departments" | "jobs")} className="flex-1">
              <TabsList>
                <TabsTrigger value="departments" className="gap-1">
                  <Building2 className="h-4 w-4" />{ar ? "الإدارات" : "Departments"}
                  <Badge variant="secondary" className="ms-1">{depts.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="jobs" className="gap-1">
                  <Briefcase className="h-4 w-4" />{ar ? "المسميات" : "Job Titles"}
                  <Badge variant="secondary" className="ms-1">{jobs.length}</Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <InputIcon
              leftIcon={<Search />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={ar ? "بحث..." : "Search..."}
              clearable
              onClear={() => setQuery("")}
              className="h-9 w-48"
            />
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as "departments" | "jobs")}>
            <TabsContent value="departments" className="mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {filteredDepts.map((d) => (
                  <RecordCard
                    key={d.id}
                    label={pick(d, lang)}
                    subtitle={d.code}
                    color={d.color}
                    active={selected?.id === d.id && selected?.kind === "department"}
                    icon={<Building2 className="h-4 w-4" />}
                    onClick={() => setSelected({ id: d.id, kind: "department" })}
                    onDelete={!d.is_system ? () => remove(d.id, "department") : undefined}
                    right={<span className="text-[11px] text-muted-foreground">{memberCounts[d.id] || 0} {ar ? "عضو" : "members"}</span>}
                  />
                ))}
                {filteredDepts.length === 0 && (
                  <div className="col-span-full text-center py-8 text-sm text-muted-foreground">
                    {ar ? "لا يوجد" : "No results"}
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="jobs" className="mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {filteredJobs.map((j) => {
                  const dept = depts.find((d) => d.id === j.department_id);
                  return (
                    <RecordCard
                      key={j.id}
                      label={pick(j, lang)}
                      subtitle={j.code || (dept ? pick(dept, lang) : "")}
                      color={dept?.color}
                      active={selected?.id === j.id && selected?.kind === "job_title"}
                      icon={<Briefcase className="h-4 w-4" />}
                      onClick={() => setSelected({ id: j.id, kind: "job_title" })}
                      onDelete={!j.is_system ? () => remove(j.id, "job_title") : undefined}
                      right={<Badge variant="outline" className="text-[10px]">L{j.level}</Badge>}
                    />
                  );
                })}
                {filteredJobs.length === 0 && (
                  <div className="col-span-full text-center py-8 text-sm text-muted-foreground">
                    {ar ? "لا يوجد" : "No results"}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Inspector Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side={ar ? "left" : "right"} className="w-full sm:max-w-md flex flex-col">
          {selected && selectedRecord && (
            <RecordEditor
              key={selected.id}
              kind={selected.kind}
              record={selectedRecord}
              departments={depts}
              templates={templates.filter((t) => t.entity === (selected.kind === "department" ? "department" : "job_title"))}
              onSaved={load}
              onClose={() => setSelected(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Custom field templates dialog */}
      {isAdmin && (
        <FieldTemplatesDialog
          open={showFieldsDialog}
          onOpenChange={setShowFieldsDialog}
          templates={templates}
          onChanged={load}
        />
      )}
    </div>
  );
}

function pick(row: { name_ar?: string | null; name_en?: string | null; name: string }, lang: string) {
  if (lang === "ar") return row.name_ar || row.name;
  return row.name_en || row.name;
}

function RecordCard({
  label, subtitle, color, active, icon, onClick, onDelete, right,
}: {
  label: string; subtitle?: string | null; color?: string | null; active?: boolean;
  icon: React.ReactNode; onClick: () => void; onDelete?: () => void; right?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={`group rounded-lg border-2 bg-card p-2.5 cursor-pointer transition-all hover:shadow-sm ${
        active ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
      }`}
      style={color && !active ? { borderInlineStartWidth: "4px", borderInlineStartColor: color } : undefined}
    >
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-md shrink-0" style={{ backgroundColor: `${color || "#94a3b8"}20`, color: color || undefined }}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{label}</div>
          {subtitle && <div className="text-[11px] text-muted-foreground truncate font-mono">{subtitle}</div>}
        </div>
        {right}
        {onDelete && (
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function RecordEditor({
  kind, record, departments, templates, onSaved, onClose,
}: {
  kind: "department" | "job_title";
  record: Department | JobTitle;
  departments: Department[];
  templates: FieldTemplate[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const isDept = kind === "department";
  const dept = isDept ? (record as Department) : null;
  const job = !isDept ? (record as JobTitle) : null;

  const [nameAr, setNameAr] = useState(record.name_ar || record.name);
  const [nameEn, setNameEn] = useState(record.name_en || "");
  const [code, setCode] = useState((record as any).code || "");
  const [color, setColor] = useState(dept?.color || DEPT_COLORS[0]);
  const [parentId, setParentId] = useState<string | null>(dept?.parent_id ?? null);
  const [phone, setPhone] = useState(dept?.phone || "");
  const [extension, setExtension] = useState(dept?.extension || "");
  const [location, setLocation] = useState(dept?.location || "");
  const [level, setLevel] = useState(job?.level ?? 3);
  const [departmentId, setDepartmentId] = useState<string | null>(job?.department_id ?? null);
  const [description, setDescription] = useState(job?.description || "");
  const [metadata, setMetadata] = useState<Record<string, any>>(
    ((record as any).metadata as Record<string, any>) || {}
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    if (isDept) {
      const payload = {
        name: nameAr || nameEn, name_ar: nameAr || null, name_en: nameEn || null,
        code: code || null, color, parent_id: parentId, phone: phone || null,
        extension: extension || null, location: location || null, metadata,
      };
      const { error } = await supabase.from("departments").update(payload).eq("id", record.id);
      setSaving(false);
      if (error) return toast.error(ar ? "تعذر الحفظ" : "Failed", { description: error.message });
    } else {
      const payload = {
        name: nameAr || nameEn, name_ar: nameAr || null, name_en: nameEn || null,
        code: code || null, level, department_id: departmentId, description: description || null, metadata,
      };
      const { error } = await supabase.from("job_titles").update(payload).eq("id", record.id);
      setSaving(false);
      if (error) return toast.error(ar ? "تعذر الحفظ" : "Failed", { description: error.message });
    }
    toast.success(ar ? "تم الحفظ" : "Saved");
    onSaved();
    onClose();
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>
          {isDept ? (ar ? "تعديل الإدارة" : "Edit Department") : (ar ? "تعديل المسمى" : "Edit Job Title")}
        </SheetTitle>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto space-y-4 py-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{ar ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
            <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{ar ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
            <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">{ar ? "الكود" : "Code"}</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono" placeholder="e.g. SLS" />
        </div>

        {isDept && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">{ar ? "اللون" : "Color"}</Label>
              <div className="flex flex-wrap gap-1.5">
                {DEPT_COLORS.map((c) => (
                  <button
                    key={c} type="button"
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full transition-all ${color === c ? "ring-2 ring-offset-2 ring-primary" : "hover:scale-110"}`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{ar ? "الإدارة الأب" : "Parent department"}</Label>
              <Select value={parentId ?? "none"} onValueChange={(v) => setParentId(v === "none" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{ar ? "بدون (إدارة أساسية)" : "None (top level)"}</SelectItem>
                  {departments.filter((d) => d.id !== record.id).map((d) => (
                    <SelectItem key={d.id} value={d.id}>{pick(d, lang)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{ar ? "التليفون" : "Phone"}</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{ar ? "رقم داخلي" : "Extension"}</Label>
                <Input value={extension} onChange={(e) => setExtension(e.target.value)} dir="ltr" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{ar ? "الموقع" : "Location"}</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </>
        )}

        {!isDept && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">{ar ? "الإدارة" : "Department"}</Label>
              <Select value={departmentId ?? "none"} onValueChange={(v) => setDepartmentId(v === "none" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{ar ? "بدون" : "None"}</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{pick(d, lang)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{ar ? "المستوى الوظيفي (1 = أعلى)" : "Level (1 = highest)"}</Label>
              <Select value={String(level)} onValueChange={(v) => setLevel(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      L{n} — {n === 1 ? (ar ? "قيادي" : "Executive") : n === 2 ? (ar ? "مدير" : "Manager") : n === 3 ? (ar ? "مشرف" : "Supervisor") : n === 4 ? (ar ? "موظف" : "Staff") : (ar ? "متدرب" : "Trainee")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{ar ? "الوصف" : "Description"}</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </>
        )}

        {/* Custom fields from templates */}
        {templates.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <div className="text-xs font-semibold text-muted-foreground uppercase">
              {ar ? "حقول إضافية" : "Additional fields"}
            </div>
            {templates.map((tpl) => (
              <div key={tpl.id} className="space-y-1">
                <Label className="text-xs">{ar ? tpl.label_ar : (tpl.label_en || tpl.label_ar)}</Label>
                <Input
                  type={tpl.field_type === "number" ? "number" : tpl.field_type === "email" ? "email" : tpl.field_type === "date" ? "date" : "text"}
                  value={metadata[tpl.key] ?? ""}
                  onChange={(e) => setMetadata({ ...metadata, [tpl.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      <SheetFooter className="border-t pt-3">
        <Button variant="outline" onClick={onClose}>{ar ? "إلغاء" : "Cancel"}</Button>
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4 me-1" />{ar ? "حفظ" : "Save"}
        </Button>
      </SheetFooter>
    </>
  );
}

function FieldTemplatesDialog({
  open, onOpenChange, templates, onChanged,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  templates: FieldTemplate[]; onChanged: () => void;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const confirm = useConfirm();
  const [entity, setEntity] = useState<"department" | "job_title">("department");
  const [labelAr, setLabelAr] = useState("");
  const [labelEn, setLabelEn] = useState("");
  const [key, setKey] = useState("");
  const [type, setType] = useState<FieldTemplate["field_type"]>("text");

  const filtered = templates.filter((t) => t.entity === entity);

  const add = async () => {
    if (!labelAr.trim() || !key.trim()) {
      return toast.error(ar ? "املأ الحقول" : "Fill required fields");
    }
    const { error } = await supabase.from("org_field_templates").insert({
      entity, key: key.trim().toLowerCase().replace(/\s+/g, "_"),
      label_ar: labelAr.trim(), label_en: labelEn.trim() || null,
      field_type: type,
      position: (filtered.at(-1)?.position ?? 0) + 1,
    });
    if (error) return toast.error(ar ? "تعذر الإضافة" : "Failed", { description: error.message });
    toast.success(ar ? "تم" : "Added");
    setLabelAr(""); setLabelEn(""); setKey("");
    onChanged();
  };

  const del = async (id: string) => {
    const ok = await confirm({
      title: ar ? "حذف الحقل" : "Delete field",
      description: ar ? "لن يحذف البيانات المخزنة، لكن لن يظهر الحقل في النموذج." : "Stored values remain but the field is hidden.",
      variant: "destructive",
    });
    if (!ok) return;
    const { error } = await supabase.from("org_field_templates").delete().eq("id", id);
    if (error) return toast.error(ar ? "تعذر الحذف" : "Failed", { description: error.message });
    toast.success(ar ? "تم" : "Deleted");
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{ar ? "الحقول المخصصة" : "Custom fields"}</DialogTitle>
          <DialogDescription>
            {ar ? "أضف حقول إضافية تظهر تلقائيًا عند تعديل الإدارة أو المسمى." : "Add extra fields shown in the edit panel."}
          </DialogDescription>
        </DialogHeader>
        <Tabs value={entity} onValueChange={(v) => setEntity(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="department" className="flex-1">{ar ? "الإدارات" : "Departments"}</TabsTrigger>
            <TabsTrigger value="job_title" className="flex-1">{ar ? "المسميات" : "Job titles"}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-4">{ar ? "لا يوجد حقول" : "No fields yet"}</div>
          )}
          {filtered.map((t) => (
            <div key={t.id} className="flex items-center gap-2 p-2 rounded-md border bg-muted/20">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{ar ? t.label_ar : (t.label_en || t.label_ar)}</div>
                <div className="text-[11px] font-mono text-muted-foreground">{t.key} · {t.field_type}</div>
              </div>
              {t.is_system && <Badge variant="secondary" className="text-[10px]">{ar ? "نظام" : "system"}</Badge>}
              {!t.is_system && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del(t.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-2 pt-2 border-t">
          <div className="text-xs font-semibold uppercase text-muted-foreground">{ar ? "إضافة حقل" : "Add field"}</div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder={ar ? "الاسم عربي" : "Label AR"} value={labelAr} onChange={(e) => setLabelAr(e.target.value)} />
            <Input placeholder={ar ? "الاسم إنجليزي" : "Label EN"} value={labelEn} onChange={(e) => setLabelEn(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="key_name" className="font-mono" value={key} onChange={(e) => setKey(e.target.value)} />
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">{ar ? "نص" : "Text"}</SelectItem>
                <SelectItem value="number">{ar ? "رقم" : "Number"}</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="phone">{ar ? "تليفون" : "Phone"}</SelectItem>
                <SelectItem value="url">URL</SelectItem>
                <SelectItem value="date">{ar ? "تاريخ" : "Date"}</SelectItem>
                <SelectItem value="textarea">{ar ? "نص طويل" : "Textarea"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{ar ? "إغلاق" : "Close"}</Button>
          <Button onClick={add}><Plus className="h-4 w-4 me-1" />{ar ? "إضافة" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
