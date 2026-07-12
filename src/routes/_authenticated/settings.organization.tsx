import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import { OrgChartImage } from "@/components/organization/OrgChartImage";
import {
  Network, Building2, Briefcase, Plus, Trash2, Search, Save, Sparkles,
  LayoutGrid, Users, ChevronRight, Pencil, Info, Download, ImageIcon, Eye,
} from "lucide-react";

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
  const [draft, setDraft] = useState<
    | { kind: "department"; data: Partial<Department> }
    | { kind: "job_title"; data: Partial<JobTitle> }
    | null
  >(null);

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
  }, []);

  useEffect(() => { load(); }, [load]);

  const memberCounts = useMemo(() => {
    const m: Record<string, number> = {};
    profiles.forEach((p) => { if (p.department_id) m[p.department_id] = (m[p.department_id] || 0) + 1; });
    return m;
  }, [profiles]);

  const selectedRecord = useMemo(() => {
    if (draft) return draft.data as any;
    if (!selected) return null;
    if (selected.kind === "department") return depts.find((d) => d.id === selected.id) ?? null;
    return jobs.find((j) => j.id === selected.id) ?? null;
  }, [selected, depts, jobs, draft]);

  const addDept = (parentId: string | null = null) => {
    const siblings = depts.filter((d) => (d.parent_id ?? null) === parentId);
    const nextPos = (siblings.at(-1)?.position ?? 0) + 1;
    const color = parentId
      ? (depts.find((x) => x.id === parentId)?.color || DEPT_COLORS[0])
      : DEPT_COLORS[depts.length % DEPT_COLORS.length];
    setDraft({
      kind: "department",
      data: {
        id: "__new__",
        name: "", name_ar: "", name_en: "",
        code: null, color, parent_id: parentId, position: nextPos,
        phone: null, extension: null, location: null,
        is_system: false, metadata: {} as any,
      } as Partial<Department>,
    });
    setSelected({ id: "__new__", kind: "department" });
  };

  const addJob = (deptId: string | null = null) => {
    const siblings = jobs.filter((j) => (j.department_id ?? null) === deptId);
    const nextPos = (siblings.at(-1)?.position ?? 0) + 1;
    setDraft({
      kind: "job_title",
      data: {
        id: "__new__",
        name: "", name_ar: "", name_en: "",
        code: null, level: 3, department_id: deptId, position: nextPos,
        description: null, is_system: false, metadata: {} as any,
      } as Partial<JobTitle>,
    });
    setSelected({ id: "__new__", kind: "job_title" });
  };

  const closeInspector = () => { setSelected(null); setDraft(null); };

  const chartRef = useRef<HTMLDivElement | null>(null);
  const downloadChart = async () => {
    if (!chartRef.current) return;
    try {
      const dataUrl = await toPng(chartRef.current, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `organization-chart-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      toast.success(ar ? "تم تحميل الصورة" : "Image downloaded");
    } catch (e: any) {
      toast.error(ar ? "تعذر إنشاء الصورة" : "Failed to export image", { description: e?.message });
    }
  };

  const remove = async (id: string, kind: "department" | "job_title") => {
    const label =
      kind === "department"
        ? pick(depts.find((d) => d.id === id) ?? ({ name: "" } as any), lang)
        : pick(jobs.find((j) => j.id === id) ?? ({ name: "" } as any), lang);

    const blockers: string[] = [];
    if (kind === "department") {
      const memberCount = memberCounts[id] || 0;
      const childCount = depts.filter((d) => d.parent_id === id).length;
      const jobCount = jobs.filter((j) => j.department_id === id).length;
      if (memberCount) blockers.push(ar ? `• ${memberCount} موظف` : `• ${memberCount} member(s)`);
      if (childCount) blockers.push(ar ? `• ${childCount} قسم فرعي` : `• ${childCount} sub-department(s)`);
      if (jobCount) blockers.push(ar ? `• ${jobCount} مسمى وظيفي` : `• ${jobCount} job title(s)`);
    }

    if (blockers.length > 0) {
      await confirm({
        title: ar ? `تعذر حذف "${label}"` : `Cannot delete "${label}"`,
        description:
          (ar
            ? "لا يمكن حذف هذا العنصر لأنه يحتوي على:\n"
            : "This item cannot be deleted because it contains:\n") +
          blockers.join("\n") +
          (ar
            ? "\n\nانقل أو احذف العناصر التابعة أولاً."
            : "\n\nMove or delete the dependent items first."),
        confirmText: ar ? "حسنًا" : "OK",
        cancelText: ar ? "إغلاق" : "Close",
      });
      return;
    }

    const ok = await confirm({
      title: ar ? `حذف "${label}"؟` : `Delete "${label}"?`,
      description: ar
        ? "سيتم نقل السجل إلى سلة المحذوفات ويمكن استعادته لاحقًا."
        : "The record will be moved to trash and can be restored later.",
      confirmText: ar ? "حذف" : "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    const table = kind === "department" ? "departments" : "job_titles";
    const { error } = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(ar ? "تعذر الحذف" : "Failed", { description: error.message });
    toast.success(ar ? "تم الحذف" : "Deleted");
    if (selected?.id === id) closeInspector();
    await load();
  };

  const q = query.trim().toLowerCase();
  const matches = (text: string) => !q || text.toLowerCase().includes(q);
  const deptMatches = (d: Department) => matches(pick(d, lang)) || matches(d.code || "");
  const jobMatches = (j: JobTitle) => matches(pick(j, lang)) || matches(j.code || "");

  const rootDepts = depts.filter((d) => !d.parent_id);
  const unassignedJobs = jobs.filter((j) => !j.department_id);

  const totalDepts = depts.length;
  const totalJobs = jobs.length;
  const totalMembers = Object.values(memberCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3" dir={dir}>
      {/* Compact header: title + inline stats + form-builder menu */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Network className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg sm:text-xl font-bold">
              {ar ? "الهيكل التنظيمي" : "Organization Structure"}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                <b className="text-foreground">{totalDepts}</b> {ar ? "إدارة" : "depts"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                <b className="text-foreground">{totalJobs}</b> {ar ? "مسمى" : "jobs"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                <b className="text-foreground">{totalMembers}</b> {ar ? "موظف" : "members"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Link to="/settings/form-builder" search={{ entity: "department" }}>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
              <LayoutGrid className="h-3.5 w-3.5 me-1" />
              {ar ? "حقول الإدارات" : "Dept fields"}
            </Button>
          </Link>
          <Link to="/settings/form-builder" search={{ entity: "job_title" }}>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
              <LayoutGrid className="h-3.5 w-3.5 me-1" />
              {ar ? "حقول المسميات" : "Job fields"}
            </Button>
          </Link>
        </div>
      </div>

      {/* Split: tree editor (left) + sticky chart image (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        {/* LEFT — Tree editor */}
        <Card className="lg:col-span-3">
          <CardContent className="p-3 sm:p-4">
            {/* Toolbar inside editor: search + add actions */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="flex-1 min-w-[180px]">
                <InputIcon
                  leftIcon={<Search />}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={ar ? "ابحث بالاسم أو الكود..." : "Search..."}
                  clearable
                  onClear={() => setQuery("")}
                  className="h-9"
                />
              </div>
              <Button size="sm" variant="outline" onClick={() => addDept(null)}>
                <Plus className="h-4 w-4 me-1" />
                {ar ? "إدارة" : "Dept"}
              </Button>
              <Button size="sm" onClick={() => addJob(null)}>
                <Plus className="h-4 w-4 me-1" />
                {ar ? "مسمى" : "Job"}
              </Button>
            </div>

            {loading ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                {ar ? "جارٍ التحميل..." : "Loading..."}
              </div>
            ) : rootDepts.length === 0 && unassignedJobs.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
                <Sparkles className="h-8 w-8" />
                <p className="text-sm">{ar ? "ابدأ بإضافة أول إدارة" : "Start by adding your first department"}</p>
                <Button size="sm" onClick={() => addDept(null)}>
                  <Plus className="h-4 w-4 me-1" />
                  {ar ? "إضافة إدارة" : "Add Department"}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {rootDepts
                  .filter((d) => !q || deepMatchesDept(d, depts, jobs, deptMatches, jobMatches))
                  .map((d) => (
                    <DeptCard
                      key={d.id}
                      dept={d}
                      depth={0}
                      depts={depts}
                      jobs={jobs}
                      memberCounts={memberCounts}
                      lang={lang}
                      query={q}
                      selected={selected}
                      onSelect={(id, kind) => setSelected({ id, kind })}
                      onAddDept={addDept}
                      onAddJob={addJob}
                      onDelete={remove}
                    />
                  ))}

                {unassignedJobs.length > 0 && (
                  <div className="rounded-xl border border-dashed p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {ar ? "مسميات بدون إدارة" : "Unassigned titles"}
                      </div>
                      <Badge variant="outline" className="text-[10px]">{unassignedJobs.length}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {unassignedJobs
                        .filter((j) => !q || jobMatches(j))
                        .map((j) => (
                          <JobChip
                            key={j.id}
                            job={j}
                            lang={lang}
                            selected={selected?.id === j.id && selected.kind === "job_title"}
                            onSelect={() => setSelected({ id: j.id, kind: "job_title" })}
                            onDelete={() => remove(j.id, "job_title")}
                          />
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT — Sticky chart preview + download */}
        <Card className="lg:col-span-2 lg:sticky lg:top-4">
          <CardContent className="p-3 sm:p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 mb-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5" />
                  {ar ? "معاينة الرسمة" : "Chart preview"}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {ar ? "تتحدث تلقائيًا — للاستخدام في بروفايل الشركة" : "Auto-updates — for company profile"}
                </div>
              </div>
              <Button size="sm" onClick={downloadChart} disabled={loading || rootDepts.length === 0}>
                <Download className="h-4 w-4 me-1" />
                PNG
              </Button>
            </div>
            <div className="rounded-lg border bg-white overflow-auto max-h-[70vh]">
              {rootDepts.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  {ar ? "أضف إدارة لعرض الرسمة" : "Add a department to see the chart"}
                </div>
              ) : (
                <div ref={chartRef}>
                  <OrgChartImage departments={depts} jobs={jobs} lang={ar ? "ar" : "en"} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inspector Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && closeInspector()}>
        <SheetContent side={ar ? "left" : "right"} className="w-full sm:max-w-md flex flex-col">
          {selected && selectedRecord && (
            <RecordEditor
              key={selected.id}
              kind={selected.kind}
              record={selectedRecord}
              isNew={selected.id === "__new__"}
              departments={depts}
              customFields={customFields.filter((f) => f.entity_key === (selected.kind === "department" ? "department" : "job_title"))}
              onSaved={load}
              onClose={closeInspector}
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

function deepMatchesDept(
  d: Department,
  allDepts: Department[],
  allJobs: JobTitle[],
  deptMatches: (d: Department) => boolean,
  jobMatches: (j: JobTitle) => boolean,
): boolean {
  if (deptMatches(d)) return true;
  if (allJobs.some((j) => j.department_id === d.id && jobMatches(j))) return true;
  return allDepts.some((c) => c.parent_id === d.id && deepMatchesDept(c, allDepts, allJobs, deptMatches, jobMatches));
}

/* ---------------------------------- TILES ---------------------------------- */

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted text-muted-foreground">{icon}</div>
        <div className="min-w-0">
          <div className="text-lg font-bold leading-tight">{value}</div>
          <div className="text-[11px] text-muted-foreground truncate">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

/* --------------------------------- DEPT CARD -------------------------------- */

function DeptCard({
  dept, depth, depts, jobs, memberCounts, lang, query, selected, onSelect, onAddDept, onAddJob, onDelete,
}: {
  dept: Department;
  depth: number;
  depts: Department[];
  jobs: JobTitle[];
  memberCounts: Record<string, number>;
  lang: string;
  query: string;
  selected: { id: string; kind: "department" | "job_title" } | null;
  onSelect: (id: string, kind: "department" | "job_title") => void;
  onAddDept: (parentId: string | null) => void;
  onAddJob: (deptId: string | null) => void;
  onDelete: (id: string, kind: "department" | "job_title") => void;
}) {
  const ar = lang === "ar";
  const color = dept.color || "#3b6fa0";
  const children = depts.filter((c) => c.parent_id === dept.id);
  const deptJobs = jobs.filter((j) => j.department_id === dept.id);
  const isSelected = selected?.id === dept.id && selected.kind === "department";
  const label = pick(dept, lang);
  const members = memberCounts[dept.id] || 0;

  const q = query;
  const matchesDeep = !q || (() => {
    const dm = (label + " " + (dept.code || "")).toLowerCase().includes(q);
    if (dm) return true;
    if (deptJobs.some((j) => (pick(j, lang) + " " + (j.code || "")).toLowerCase().includes(q))) return true;
    return true;
  })();
  if (!matchesDeep) return null;

  return (
    <div
      className={`rounded-xl border bg-card overflow-hidden transition-all ${
        isSelected ? "ring-2 ring-primary ring-offset-1" : ""
      }`}
      style={{ borderInlineStartWidth: 4, borderInlineStartColor: color }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-muted/50"
        style={{ backgroundColor: `${color}0d` }}
        onClick={() => onSelect(dept.id, "department")}
      >
        <div className="grid place-items-center h-8 w-8 rounded-lg shrink-0" style={{ backgroundColor: `${color}22`, color }}>
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm truncate">{label}</span>
            {dept.code && (
              <span className="text-[10px] font-mono uppercase text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                {dept.code}
              </span>
            )}
            {dept.is_system && <Badge variant="secondary" className="text-[9px] h-4 px-1">{ar ? "نظام" : "Sys"}</Badge>}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{children.length}</span>
            <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{deptJobs.length}</span>
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{members}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            size="icon" variant="ghost" className="h-7 w-7"
            title={ar ? "قسم فرعي" : "Sub-dept"}
            onClick={() => onAddDept(dept.id)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon" variant="ghost" className="h-7 w-7"
            title={ar ? "تعديل" : "Edit"}
            onClick={() => onSelect(dept.id, "department")}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {!dept.is_system && (
            <Button
              size="icon" variant="ghost" className="h-7 w-7 text-destructive"
              title={ar ? "حذف" : "Delete"}
              onClick={() => onDelete(dept.id, "department")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Job title chips */}
      {deptJobs.length > 0 && (
        <div className="px-3 py-2 border-t bg-background/40">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {ar ? "المسميات الوظيفية" : "Job Titles"}
            </div>
            <button
              type="button"
              className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
              onClick={() => onAddJob(dept.id)}
            >
              <Plus className="h-3 w-3" />{ar ? "إضافة" : "Add"}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {deptJobs.map((j) => (
              <JobChip
                key={j.id}
                job={j}
                lang={lang}
                color={color}
                selected={selected?.id === j.id && selected.kind === "job_title"}
                onSelect={() => onSelect(j.id, "job_title")}
                onDelete={() => onDelete(j.id, "job_title")}
              />
            ))}
          </div>
        </div>
      )}

      {/* Nested children */}
      {children.length > 0 && (
        <div className="px-3 py-2 space-y-2 border-t bg-muted/20">
          {children.map((c) => (
            <DeptCard
              key={c.id}
              dept={c}
              depth={depth + 1}
              depts={depts}
              jobs={jobs}
              memberCounts={memberCounts}
              lang={lang}
              query={query}
              selected={selected}
              onSelect={onSelect}
              onAddDept={onAddDept}
              onAddJob={onAddJob}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {deptJobs.length === 0 && children.length === 0 && (
        <div className="px-3 py-2 border-t bg-background/40 flex items-center gap-2">
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1"
            onClick={() => onAddJob(dept.id)}
          >
            <Plus className="h-3 w-3" />{ar ? "إضافة مسمى وظيفي" : "Add job title"}
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1"
            onClick={() => onAddDept(dept.id)}
          >
            <Plus className="h-3 w-3" />{ar ? "إضافة قسم فرعي" : "Add sub-department"}
          </button>
        </div>
      )}
    </div>
  );
}

function JobChip({
  job, lang, color, selected, onSelect, onDelete,
}: {
  job: JobTitle;
  lang: string;
  color?: string;
  selected?: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const ar = lang === "ar";
  const c = color || "#64748b";
  return (
    <div
      className={`group inline-flex items-center gap-1.5 rounded-full border bg-background pl-2 pr-1 py-0.5 text-xs cursor-pointer transition-all hover:shadow-sm ${
        selected ? "ring-2 ring-primary ring-offset-1" : ""
      }`}
      onClick={onSelect}
    >
      <Briefcase className="h-3 w-3 shrink-0" style={{ color: c }} />
      <span className="font-medium truncate max-w-[160px]">{pick(job, lang)}</span>
      {job.level != null && (
        <span className="text-[9px] font-mono text-muted-foreground bg-muted rounded px-1">L{job.level}</span>
      )}
      {!job.is_system && (
        <button
          type="button"
          className="ms-0.5 h-4 w-4 rounded-full grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title={ar ? "حذف" : "Delete"}
        >
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------- INSPECTOR ------------------------------- */

function RecordEditor({
  kind, record, isNew, departments, customFields, onSaved, onClose,
}: {
  kind: "department" | "job_title";
  record: Department | JobTitle | Partial<Department> | Partial<JobTitle>;
  isNew: boolean;
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

  const [nameAr, setNameAr] = useState(record.name_ar || record.name || "");
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
    if (!nameAr.trim() && !nameEn.trim()) {
      return toast.error(ar ? "الاسم مطلوب" : "Name is required");
    }
    setSaving(true);
    if (isDept) {
      const payload: any = {
        name: nameAr || nameEn, name_ar: nameAr || null, name_en: nameEn || null,
        code: code || null, color, parent_id: parentId, phone: phone || null,
        extension: extension || null, location: location || null, metadata,
      };
      if (isNew) payload.position = (record as any).position ?? 0;
      const { error } = isNew
        ? await supabase.from("departments").insert(payload)
        : await supabase.from("departments").update(payload).eq("id", (record as Department).id);
      setSaving(false);
      if (error) return toast.error(ar ? "تعذر الحفظ" : "Failed", { description: error.message });
    } else {
      const payload: any = {
        name: nameAr || nameEn, name_ar: nameAr || null, name_en: nameEn || null,
        code: code || null, level, department_id: departmentId, description: description || null, metadata,
      };
      if (isNew) payload.position = (record as any).position ?? 0;
      const { error } = isNew
        ? await supabase.from("job_titles").insert(payload)
        : await supabase.from("job_titles").update(payload).eq("id", (record as JobTitle).id);
      setSaving(false);
      if (error) return toast.error(ar ? "تعذر الحفظ" : "Failed", { description: error.message });
    }
    toast.success(isNew ? (ar ? "تم الإنشاء" : "Created") : (ar ? "تم الحفظ" : "Saved"));
    onSaved();
    onClose();
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>
          {isNew
            ? (isDept ? (ar ? "إدارة جديدة" : "New Department") : (ar ? "مسمى وظيفي جديد" : "New Job Title"))
            : (isDept ? (ar ? "تعديل الإدارة" : "Edit Department") : (ar ? "تعديل المسمى" : "Edit Job Title"))}
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
