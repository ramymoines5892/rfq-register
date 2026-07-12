import { createFileRoute, Link, redirect } from "@tanstack/react-router";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Network, Building2, Briefcase, Plus, Trash2, Search, Save, Sparkles,
  ChevronRight, ChevronDown, LayoutGrid,
} from "lucide-react";

import { OrgChart } from "@/components/organization/OrgChart";
import type { Database } from "@/integrations/supabase/types";

type Department = Database["public"]["Tables"]["departments"]["Row"];
type JobTitle = Database["public"]["Tables"]["job_titles"]["Row"];
type FieldDef = Database["public"]["Tables"]["customer_field_definitions"]["Row"];
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

  const [depts, setDepts] = useState<Department[]>([]);
  const [jobs, setJobs] = useState<JobTitle[]>([]);
  const [customFields, setCustomFields] = useState<FieldDef[]>([]);
  const [profiles, setProfiles] = useState<Pick<Profile, "id" | "full_name" | "email" | "department_id">[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ id: string; kind: "department" | "job_title" } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const [d, j, f, p] = await Promise.all([
      supabase.from("departments").select("*").is("deleted_at", null).order("position"),
      supabase.from("job_titles").select("*").is("deleted_at", null).order("position"),
      supabase
        .from("customer_field_definitions")
        .select("*")
        .in("entity_key", ["department", "job_title"])
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("position"),
      supabase.from("profiles").select("id, full_name, email, department_id"),
    ]);
    setDepts((d.data ?? []) as Department[]);
    setJobs((j.data ?? []) as JobTitle[]);
    setCustomFields((f.data ?? []) as FieldDef[]);
    setProfiles(p.data ?? []);
    setLoading(false);
    // auto-expand top-level departments
    setExpanded((prev) => {
      if (prev.size > 0) return prev;
      const next = new Set<string>();
      (d.data ?? []).forEach((x: any) => { if (!x.parent_id) next.add(x.id); });
      return next;
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const memberCounts = useMemo(() => {
    const m: Record<string, number> = {};
    profiles.forEach((p) => { if (p.department_id) m[p.department_id] = (m[p.department_id] || 0) + 1; });
    return m;
  }, [profiles]);

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

  const addDept = async (parentId: string | null = null) => {
    const siblings = depts.filter((d) => (d.parent_id ?? null) === parentId);
    const nextPos = (siblings.at(-1)?.position ?? 0) + 1;
    const color = parentId
      ? (depts.find((x) => x.id === parentId)?.color || DEPT_COLORS[0])
      : DEPT_COLORS[depts.length % DEPT_COLORS.length];
    const { data, error } = await supabase.from("departments").insert({
      name: ar ? "إدارة جديدة" : "New Department",
      name_ar: "إدارة جديدة", name_en: "New Department",
      color, position: nextPos, parent_id: parentId,
    }).select().single();
    if (error) return toast.error(ar ? "تعذر الإضافة" : "Failed", { description: error.message });
    if (parentId) setExpanded((s) => new Set(s).add(parentId));
    await load();
    setSelected({ id: data.id, kind: "department" });
  };

  const addJob = async (deptId: string | null = null) => {
    const siblings = jobs.filter((j) => (j.department_id ?? null) === deptId);
    const nextPos = (siblings.at(-1)?.position ?? 0) + 1;
    const { data, error } = await supabase.from("job_titles").insert({
      name: ar ? "مسمى جديد" : "New Title",
      name_ar: "مسمى جديد", name_en: "New Title",
      level: 3, position: nextPos, department_id: deptId,
    }).select().single();
    if (error) return toast.error(ar ? "تعذر الإضافة" : "Failed", { description: error.message });
    if (deptId) setExpanded((s) => new Set(s).add(deptId));
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
    if (selected?.id === id) setSelected(null);
    await load();
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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
          <Link to="/settings/form-builder" search={{ entity: "department" }}>
            <Button variant="outline" size="sm">
              <LayoutGrid className="h-4 w-4 me-1" />
              {ar ? "حقول الإدارات" : "Dept fields"}
            </Button>
          </Link>
          <Link to="/settings/form-builder" search={{ entity: "job_title" }}>
            <Button variant="outline" size="sm">
              <LayoutGrid className="h-4 w-4 me-1" />
              {ar ? "حقول المسميات" : "Job fields"}
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4">
        {/* LEFT: Tree */}
        <Card className="lg:sticky lg:top-20 lg:self-start">
          <CardContent className="p-3 space-y-2">
            <InputIcon
              leftIcon={<Search />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={ar ? "بحث..." : "Search..."}
              clearable
              onClear={() => setQuery("")}
              className="h-9"
            />
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => addDept(null)}>
                <Plus className="h-3.5 w-3.5 me-1" />
                <Building2 className="h-3.5 w-3.5 me-1" />
                {ar ? "إدارة" : "Dept"}
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => addJob(null)}>
                <Plus className="h-3.5 w-3.5 me-1" />
                <Briefcase className="h-3.5 w-3.5 me-1" />
                {ar ? "مسمى" : "Job"}
              </Button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto -mx-1 px-1">
              {loading ? (
                <div className="py-8 text-center text-xs text-muted-foreground">{ar ? "تحميل..." : "Loading..."}</div>
              ) : depts.length === 0 && jobs.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  {ar ? "ابدأ بإضافة إدارة" : "Start by adding a department"}
                </div>
              ) : (
                <TreeView
                  depts={depts}
                  jobs={jobs}
                  memberCounts={memberCounts}
                  query={query.trim().toLowerCase()}
                  expanded={expanded}
                  onToggle={toggleExpand}
                  selected={selected}
                  onSelect={(id, kind) => setSelected({ id, kind })}
                  onAddDept={addDept}
                  onAddJob={addJob}
                  onDelete={remove}
                  lang={lang}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: Chart */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="h-[600px] flex items-center justify-center text-muted-foreground text-sm">
                {ar ? "جارٍ التحميل..." : "Loading..."}
              </div>
            ) : depts.length === 0 ? (
              <div className="h-[600px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Sparkles className="h-8 w-8" />
                <p className="text-sm">{ar ? "ابدأ بإضافة إدارة من الشجرة" : "Add a department from the tree"}</p>
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
      </div>

      {/* Inspector Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side={ar ? "left" : "right"} className="w-full sm:max-w-md flex flex-col">
          {selected && selectedRecord && (
            <RecordEditor
              key={selected.id}
              kind={selected.kind}
              record={selectedRecord}
              departments={depts}
              customFields={customFields.filter((f) => f.entity_key === (selected.kind === "department" ? "department" : "job_title"))}
              onSaved={load}
              onClose={() => setSelected(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function pick(row: { name_ar?: string | null; name_en?: string | null; name: string }, lang: string) {
  if (lang === "ar") return row.name_ar || row.name;
  return row.name_en || row.name;
}

/* ------------------------------- TREE VIEW ------------------------------- */

function TreeView({
  depts, jobs, memberCounts, query, expanded, onToggle, selected, onSelect,
  onAddDept, onAddJob, onDelete, lang,
}: {
  depts: Department[];
  jobs: JobTitle[];
  memberCounts: Record<string, number>;
  query: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selected: { id: string; kind: "department" | "job_title" } | null;
  onSelect: (id: string, kind: "department" | "job_title") => void;
  onAddDept: (parentId: string | null) => void;
  onAddJob: (deptId: string | null) => void;
  onDelete: (id: string, kind: "department" | "job_title") => void;
  lang: string;
}) {
  const rootDepts = depts.filter((d) => !d.parent_id);
  const unassignedJobs = jobs.filter((j) => !j.department_id);

  const matches = (text: string) => !query || text.toLowerCase().includes(query);

  const renderDept = (d: Department, depth: number): React.ReactNode => {
    const label = pick(d, lang);
    const children = depts.filter((c) => c.parent_id === d.id);
    const deptJobs = jobs.filter((j) => j.department_id === d.id);
    const selfMatch = matches(label) || matches(d.code || "");
    const childrenNodes = children.map((c) => renderDept(c, depth + 1)).filter(Boolean);
    const jobNodes = deptJobs.filter((j) => selfMatch || matches(pick(j, lang)) || matches(j.code || ""));
    if (query && !selfMatch && childrenNodes.length === 0 && jobNodes.length === 0) return null;

    const isOpen = expanded.has(d.id) || !!query;
    const isSelected = selected?.id === d.id && selected.kind === "department";

    return (
      <div key={d.id}>
        <TreeRow
          depth={depth}
          color={d.color}
          icon={<Building2 className="h-3.5 w-3.5" />}
          label={label}
          code={d.code}
          badge={memberCounts[d.id] ? `${memberCounts[d.id]}` : undefined}
          hasChildren={children.length + deptJobs.length > 0}
          isOpen={isOpen}
          onToggle={() => onToggle(d.id)}
          selected={isSelected}
          onClick={() => onSelect(d.id, "department")}
          actions={
            <>
              <TreeAction title="Sub-dept" onClick={() => onAddDept(d.id)}>
                <Plus className="h-3 w-3" /><Building2 className="h-3 w-3" />
              </TreeAction>
              <TreeAction title="Job" onClick={() => onAddJob(d.id)}>
                <Plus className="h-3 w-3" /><Briefcase className="h-3 w-3" />
              </TreeAction>
              {!d.is_system && (
                <TreeAction title="Delete" destructive onClick={() => onDelete(d.id, "department")}>
                  <Trash2 className="h-3 w-3" />
                </TreeAction>
              )}
            </>
          }
        />
        {isOpen && (
          <div>
            {childrenNodes}
            {jobNodes.map((j) => (
              <TreeRow
                key={j.id}
                depth={depth + 1}
                color={d.color}
                icon={<Briefcase className="h-3.5 w-3.5" />}
                label={pick(j, lang)}
                code={j.code}
                badge={`L${j.level}`}
                selected={selected?.id === j.id && selected.kind === "job_title"}
                onClick={() => onSelect(j.id, "job_title")}
                actions={
                  !j.is_system ? (
                    <TreeAction title="Delete" destructive onClick={() => onDelete(j.id, "job_title")}>
                      <Trash2 className="h-3 w-3" />
                    </TreeAction>
                  ) : null
                }
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-0.5">
      {rootDepts.map((d) => renderDept(d, 0))}
      {unassignedJobs.length > 0 && (
        <div className="mt-2 pt-2 border-t">
          <div className="text-[10px] uppercase text-muted-foreground px-2 py-1">
            {lang === "ar" ? "بدون إدارة" : "Unassigned"}
          </div>
          {unassignedJobs
            .filter((j) => !query || matches(pick(j, lang)) || matches(j.code || ""))
            .map((j) => (
              <TreeRow
                key={j.id}
                depth={0}
                icon={<Briefcase className="h-3.5 w-3.5" />}
                label={pick(j, lang)}
                code={j.code}
                badge={`L${j.level}`}
                selected={selected?.id === j.id && selected.kind === "job_title"}
                onClick={() => onSelect(j.id, "job_title")}
                actions={
                  !j.is_system ? (
                    <TreeAction title="Delete" destructive onClick={() => onDelete(j.id, "job_title")}>
                      <Trash2 className="h-3 w-3" />
                    </TreeAction>
                  ) : null
                }
              />
            ))}
        </div>
      )}
    </div>
  );
}

function TreeRow({
  depth, color, icon, label, code, badge, hasChildren, isOpen, onToggle, selected, onClick, actions,
}: {
  depth: number;
  color?: string | null;
  icon: React.ReactNode;
  label: string;
  code?: string | null;
  badge?: string;
  hasChildren?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  selected?: boolean;
  onClick: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className={`group flex items-center gap-1 rounded-md text-sm cursor-pointer transition-colors ${
        selected ? "bg-primary/10 text-primary" : "hover:bg-muted"
      }`}
      style={{ paddingInlineStart: 4 + depth * 14 }}
      onClick={onClick}
    >
      {hasChildren ? (
        <button
          type="button"
          className="p-0.5 shrink-0 hover:bg-muted rounded"
          onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
        >
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3 rtl:rotate-180" />}
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}
      <span className="shrink-0" style={{ color: color || undefined }}>{icon}</span>
      <span className="flex-1 truncate py-1.5">{label}</span>
      {code && <span className="text-[10px] font-mono text-muted-foreground uppercase">{code}</span>}
      {badge && <Badge variant="outline" className="h-4 text-[9px] px-1">{badge}</Badge>}
      <div className="flex items-center opacity-0 group-hover:opacity-100 pe-1">
        {actions}
      </div>
    </div>
  );
}

function TreeAction({
  children, onClick, title, destructive,
}: { children: React.ReactNode; onClick: () => void; title: string; destructive?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`inline-flex items-center gap-0.5 h-5 px-1 rounded hover:bg-background ${
        destructive ? "text-destructive" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------- INSPECTOR ------------------------------- */

function RecordEditor({
  kind, record, departments, customFields, onSaved, onClose,
}: {
  kind: "department" | "job_title";
  record: Department | JobTitle;
  departments: Department[];
  customFields: FieldDef[];
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

        {/* Custom fields defined via Form Builder */}
        {customFields.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-muted-foreground uppercase">
                {ar ? "حقول إضافية" : "Additional fields"}
              </div>
              <Link
                to="/settings/form-builder"
                search={{ entity: isDept ? "department" : "job_title" }}
                className="text-[10px] text-primary hover:underline"
              >
                {ar ? "إدارة الحقول" : "Manage fields"}
              </Link>
            </div>
            {customFields.map((f) => (
              <div key={f.id} className="space-y-1">
                <Label className="text-xs">{ar ? f.label_ar : (f.label_en || f.label_ar)}</Label>
                <Input
                  type={f.field_type === "number" ? "number" : f.field_type === "email" ? "email" : f.field_type === "date" ? "date" : "text"}
                  value={metadata[f.key] ?? ""}
                  onChange={(e) => setMetadata({ ...metadata, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
        {customFields.length === 0 && (
          <div className="pt-2 border-t">
            <Link
              to="/settings/form-builder"
              search={{ entity: isDept ? "department" : "job_title" }}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <LayoutGrid className="h-3 w-3" />
              {ar ? "أضف حقول مخصصة من منشئ الحقول" : "Add custom fields from Form Builder"}
            </Link>
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
