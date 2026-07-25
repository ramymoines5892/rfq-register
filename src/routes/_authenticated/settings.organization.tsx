import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useConfirm } from "@/hooks/useConfirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputIcon } from "@/components/ui/input-icon";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import { OrgChartImage } from "@/components/organization/OrgChartImage";
import {
  Network, Building2, Briefcase, Plus, Trash2, Search, Save, Sparkles,
  LayoutGrid, Users, ChevronRight, Pencil, Info, Download, ImageIcon, Eye, Shield,
} from "lucide-react";
import { PermissionMatrix } from "@/components/permissions/PermissionMatrix";


import { flattenDeptsHierarchy } from "@/lib/orgTree";
import { DEPT_ICONS, getDeptIcon } from "@/lib/deptIcons";

import {
  useOrganizationData,
  useReorderDepartments,
  useSoftDeleteOrgRow,
  useUpsertDepartment,
  useUpsertJobTitle,
} from "@/modules/organization/queries";
import type { Department, JobTitle, FieldDef, ProfileLite } from "@/modules/organization/api";

type Profile = ProfileLite;

const DEPT_COLORS = [
  "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ec4899",
  "#06b6d4", "#ef4444", "#84cc16", "#f97316", "#6366f1",
];

export const Route = createFileRoute("/_authenticated/settings/organization")({
  component: OrganizationPage,
  head: () => ({ meta: [{ title: "الهيكل التنظيمي | Organization" }] }),
});

function OrganizationPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const confirm = useConfirm();

  const [depts, setDepts] = useState<Department[]>([]);
  const [jobs, setJobs] = useState<JobTitle[]>([]);
  const [customFields, setCustomFields] = useState<FieldDef[]>([]);
  const [profiles, setProfiles] = useState<Pick<Profile, "id" | "full_name" | "email" | "department_id">[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ id: string; kind: "department" | "job_title" } | null>(null);
  const [draft, setDraft] = useState<
    | { kind: "department"; data: Partial<Department> }
    | { kind: "job_title"; data: Partial<JobTitle> }
    | null
  >(null);

  const { data: orgData, isLoading, refetch } = useOrganizationData();
  const loading = isLoading;

  // Sync remote data into local state (local state is used for optimistic reorder updates).
  useEffect(() => {
    if (!orgData) return;
    setDepts(orgData.depts);
    setJobs(orgData.jobs);
    setCustomFields(orgData.customFields);
    setProfiles(orgData.profiles);
  }, [orgData]);

  const load = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const reorderMutation = useReorderDepartments();
  const softDeleteMutation = useSoftDeleteOrgRow();
  const upsertDeptMutation = useUpsertDepartment();
  const upsertJobMutation = useUpsertJobTitle();


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

  // Check if targetId is a descendant of sourceId (to prevent cycles)
  const isDescendant = useCallback((sourceId: string, targetId: string): boolean => {
    if (sourceId === targetId) return true;
    const target = depts.find((d) => d.id === targetId);
    if (!target?.parent_id) return false;
    return isDescendant(sourceId, target.parent_id);
  }, [depts]);

  // Move a department: reparent and/or reorder within a parent
  const moveDept = useCallback(async (
    sourceId: string,
    newParentId: string | null,
    insertBeforeId: string | null = null,
  ) => {
    const source = depts.find((d) => d.id === sourceId);
    if (!source) return;
    if (newParentId && isDescendant(sourceId, newParentId)) {
      toast.error(ar ? "لا يمكن نقل إدارة داخل إحدى إداراتها الفرعية" : "Cannot move a department into its own descendant");
      return;
    }
    // Build new sibling order for the target parent
    const siblings = depts
      .filter((d) => (d.parent_id ?? null) === newParentId && d.id !== sourceId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const insertIdx = insertBeforeId ? siblings.findIndex((s) => s.id === insertBeforeId) : siblings.length;
    const ordered = [...siblings];
    ordered.splice(insertIdx < 0 ? ordered.length : insertIdx, 0, source);

    // Persist: update parent_id + positions in bulk
    const updates = ordered.map((d, idx) => ({
      id: d.id,
      parent_id: d.id === sourceId ? newParentId : d.parent_id,
      position: idx + 1,
    }));
    // Optimistic UI
    setDepts((prev) => prev.map((d) => {
      const u = updates.find((x) => x.id === d.id);
      return u ? { ...d, parent_id: u.parent_id ?? null, position: u.position } : d;
    }));
    try {
      await reorderMutation.mutateAsync(updates);
    } catch (err: any) {
      toast.error(ar ? "تعذر النقل" : "Failed to move", { description: err?.message });
      await load();
    }
  }, [depts, isDescendant, ar, load, reorderMutation]);

  // Promote a department to the top: it becomes the only root and adopts all
  // other current roots as its children.
  const promoteToTop = useCallback(async (sourceId: string) => {
    const source = depts.find((d) => d.id === sourceId);
    if (!source) return;
    const otherRoots = depts
      .filter((d) => !d.parent_id && d.id !== sourceId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    if (otherRoots.length === 0 && !source.parent_id) return;

    const updates = [
      { id: sourceId, parent_id: null as string | null, position: 1 },
      ...otherRoots.map((d, idx) => ({ id: d.id, parent_id: sourceId, position: idx + 1 })),
    ];
    setDepts((prev) => prev.map((d) => {
      const u = updates.find((x) => x.id === d.id);
      return u ? { ...d, parent_id: u.parent_id, position: u.position } : d;
    }));
    try {
      await reorderMutation.mutateAsync(updates);
      toast.success(ar ? "تم الرفع للأعلى" : "Promoted to top");
    } catch (err: any) {
      toast.error(ar ? "تعذر النقل" : "Failed to move", { description: err?.message });
      await load();
    }
  }, [depts, ar, load, reorderMutation]);



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
    try {
      await softDeleteMutation.mutateAsync({ id, kind });
      toast.success(ar ? "تم الحذف" : "Deleted");
      if (selected?.id === id) closeInspector();
    } catch (err: any) {
      toast.error(ar ? "تعذر الحذف" : "Failed", { description: err?.message });
    }
  };

  const q = query.trim().toLowerCase();
  const matches = (text: string) => !q || text.toLowerCase().includes(q);
  const deptMatches = (d: Department) => matches(pick(d, lang)) || matches(d.code || "");
  const jobMatches = (j: JobTitle) => matches(pick(j, lang)) || matches(j.code || "");

  const rootDepts = depts.filter((d) => !d.parent_id).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
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
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8">
                <Eye className="h-4 w-4 me-1" />
                {ar ? "معاينة الرسمة" : "Preview chart"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  {ar ? "رسمة الهيكل التنظيمي" : "Organization Chart"}
                </DialogTitle>
              </DialogHeader>
              <div className="rounded-lg border bg-white p-2">
                {rootDepts.length === 0 ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    {ar ? "أضف إدارة لعرض الرسمة" : "Add a department to see the chart"}
                  </div>
                ) : (
                  <div ref={chartRef}>
                    <OrgChartImage departments={depts} jobs={jobs} memberCounts={memberCounts} lang={ar ? "ar" : "en"} />
                  </div>
                )}
              </div>
              <DialogFooter>
                <p className="text-[11px] text-muted-foreground me-auto self-center">
                  {ar ? "تتحدث تلقائيًا مع كل تعديل" : "Auto-updates as you edit"}
                </p>
                <Button onClick={downloadChart} disabled={loading || rootDepts.length === 0}>
                  <Download className="h-4 w-4 me-1" />
                  {ar ? "تحميل PNG" : "Download PNG"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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

      {/* Full-width tree editor */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          {/* Toolbar: search + add actions */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="flex-1 min-w-[200px]">
              <InputIcon
                leftIcon={<Search />}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={ar ? "ابحث بالاسم أو الكود..." : "Search by name or code..."}
                clearable
                onClear={() => setQuery("")}
                className="h-9"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => addDept(null)}>
              <Plus className="h-4 w-4 me-1" />
              {ar ? "إدارة جديدة" : "New department"}
            </Button>
            <Button size="sm" onClick={() => addJob(null)}>
              <Plus className="h-4 w-4 me-1" />
              {ar ? "مسمى جديد" : "New job title"}
            </Button>
          </div>
          <p className="mb-2 text-[11px] text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3" />
            {ar
              ? "اسحب أي إدارة وأفلتها على المنتصف لجعلها فرعية، أو على الحافة اليسرى/اليمنى لوضعها قبل/بعد الإدارة."
              : "Drag onto the middle to nest, or onto the left/right edge to place before/after."}
          </p>

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
            <TooltipProvider delayDuration={120}>
              <TopDropZone ar={ar} onPromote={promoteToTop} />
              <div className="flex flex-nowrap items-start justify-center gap-2 sm:gap-3 py-4 max-w-full">

              {rootDepts
                .filter((d) => !q || deepMatchesDept(d, depts, jobs, deptMatches, jobMatches))
                .map((d) => (
                  <div key={d.id} className="flex-1 basis-0 min-w-0 flex flex-col items-center">
                    <DeptCard
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
                      onMove={moveDept}
                      parentId={null}
                    />
                  </div>
                ))}

              </div>


              {unassignedJobs.length > 0 && (
                <div className="mt-4 rounded-xl border border-dashed p-3">
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
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

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

/* -------------------------------- TOP DROP ZONE ----------------------------- */

function TopDropZone({ ar, onPromote }: { ar: boolean; onPromote: (id: string) => void }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("text/dept-id")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        const id = e.dataTransfer.getData("text/dept-id");
        setOver(false);
        if (!id) return;
        e.preventDefault();
        onPromote(id);
      }}
      className={`mb-2 rounded-lg border-2 border-dashed py-2 text-center text-[11px] transition-colors ${
        over ? "border-primary bg-primary/10 text-primary" : "border-border/60 text-muted-foreground"
      }`}
    >
      {ar
        ? "اسحب إدارة هنا لجعلها في الأعلى وتصبح باقي الإدارات فرعية منها"
        : "Drop a department here to make it the top-level parent of all others"}
    </div>
  );
}


/* --------------------------------- DEPT CARD -------------------------------- */

function DeptCard({
  dept, depth, depts, jobs, memberCounts, lang, query, selected, onSelect, onAddDept, onAddJob, onDelete, onMove, parentId,
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
  onMove: (sourceId: string, newParentId: string | null, insertBeforeId?: string | null) => void;
  parentId: string | null;
}) {
  const ar = lang === "ar";
  const color = dept.color || "#3b6fa0";
  const children = depts.filter((c) => c.parent_id === dept.id).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const deptJobs = jobs.filter((j) => j.department_id === dept.id);
  const isSelected = selected?.id === dept.id && selected.kind === "department";
  const label = pick(dept, lang);
  const members = memberCounts[dept.id] || 0;
  const [dropMode, setDropMode] = useState<null | "child" | "before" | "after">(null);


  const q = query;
  const matchesDeep = !q || (() => {
    const dm = (label + " " + (dept.code || "")).toLowerCase().includes(q);
    if (dm) return true;
    if (deptJobs.some((j) => (pick(j, lang) + " " + (j.code || "")).toLowerCase().includes(q))) return true;
    return true;
  })();
  if (!matchesDeep) return null;

  // Find the sibling that comes after this dept (used to translate "after" → insertBefore)
  const siblings = depts
    .filter((d) => (d.parent_id ?? null) === parentId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const myIdx = siblings.findIndex((s) => s.id === dept.id);
  const nextSiblingId = myIdx >= 0 && myIdx < siblings.length - 1 ? siblings[myIdx + 1].id : null;

  return (
    <div
      className="relative flex flex-col items-center gap-4"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("text/dept-id")) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        const rect = e.currentTarget.getBoundingClientRect();
        const relX = e.clientX - rect.left;
        const ratio = relX / rect.width;
        setDropMode(ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "child");
      }}
      onDragLeave={(e) => { e.stopPropagation(); setDropMode(null); }}
      onDrop={(e) => {
        const sourceId = e.dataTransfer.getData("text/dept-id");
        const mode = dropMode;
        setDropMode(null);
        if (!sourceId || sourceId === dept.id) return;
        e.preventDefault();
        e.stopPropagation();
        if (mode === "before") {
          onMove(sourceId, parentId, dept.id);
        } else if (mode === "after") {
          onMove(sourceId, parentId, nextSiblingId);
        } else {
          onMove(sourceId, dept.id, null);
        }
      }}
    >
      {dropMode === "before" && (
        <div className="absolute -start-1 top-0 bottom-0 w-1 rounded bg-primary" />
      )}
      {dropMode === "after" && (
        <div className="absolute -end-1 top-0 bottom-0 w-1 rounded bg-primary" />
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/dept-id", dept.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            className={`group relative flex flex-col items-center gap-2 outline-none cursor-grab active:cursor-grabbing ${
              isSelected ? "text-primary" : "text-foreground"
            } ${dropMode === "child" ? "scale-105" : ""}`}
            onClick={() => onSelect(dept.id, "department")}
            onDoubleClick={() => onSelect(dept.id, "department")}
          >
            <span
              className={`grid place-items-center rounded-full border-2 bg-background shadow-sm transition-all group-hover:-translate-y-1 group-hover:shadow-md ${
                depth === 0
                  ? "h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16"
                  : depth === 1
                  ? "h-9 w-9 sm:h-10 sm:w-10 md:h-12 md:w-12"
                  : "h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10"
              } ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""} ${
                dropMode === "child" ? "ring-2 ring-primary ring-offset-2" : ""
              }`}
              style={{ borderColor: color, color, backgroundColor: `${color}12` }}
            >
              {(() => {
                const DeptIco = getDeptIcon((dept as any).icon, depth);
                return <DeptIco className={
                  depth === 0
                    ? "h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7"
                    : depth === 1
                    ? "h-4 w-4 sm:h-4 sm:w-4 md:h-5 md:w-5"
                    : "h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4"
                } />;
              })()}

            </span>
            <span className={`text-center font-semibold leading-tight line-clamp-2 ${
              depth === 0
                ? "max-w-20 text-[10px] sm:max-w-24 sm:text-xs"
                : depth === 1
                ? "max-w-16 text-[9px] sm:max-w-20 sm:text-[11px]"
                : "max-w-14 text-[9px] sm:max-w-16 sm:text-[10px]"
            }`}>{label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="center" className="max-w-72 text-start bg-popover text-popover-foreground border border-border shadow-md">
          <div className="space-y-2">
            <div>
              <div className="font-bold text-sm">{label}</div>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {dept.code && <span className="text-[10px] font-mono rounded bg-muted px-1.5 py-0.5">{dept.code}</span>}
                {dept.is_system && <Badge variant="secondary" className="text-[9px] h-4 px-1">{ar ? "نظام" : "Sys"}</Badge>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-md border p-2 text-center">
                <Building2 className="mx-auto mb-1 h-3.5 w-3.5" />
                <div className="font-bold">{children.length}</div>
                <div className="text-[10px] text-muted-foreground">{ar ? "فرعي" : "Sub"}</div>
              </div>
              <div className="rounded-md border p-2 text-center">
                <Briefcase className="mx-auto mb-1 h-3.5 w-3.5" />
                <div className="font-bold">{deptJobs.length}</div>
                <div className="text-[10px] text-muted-foreground">{ar ? "مسميات" : "Jobs"}</div>
              </div>
              <div className="rounded-md border p-2 text-center">
                <Users className="mx-auto mb-1 h-3.5 w-3.5" />
                <div className="font-bold">{members}</div>
                <div className="text-[10px] text-muted-foreground">{ar ? "أشخاص" : "People"}</div>
              </div>
            </div>
            {deptJobs.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-muted-foreground">{ar ? "المسميات الوظيفية" : "Job titles"}</div>
                <div className="flex flex-wrap gap-1">
                  {deptJobs.map((j) => (
                    <span key={j.id} className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                      {pick(j, lang)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 border-t pt-2">
              <Button size="icon" variant="ghost" className="h-7 w-7" title={ar ? "إضافة إدارة فرعية" : "Add sub-department"} onClick={() => onAddDept(dept.id)}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" title={ar ? "إضافة مسمى" : "Add job"} onClick={() => onAddJob(dept.id)}>
                <Briefcase className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" title={ar ? "تعديل" : "Edit"} onClick={() => onSelect(dept.id, "department")}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {!dept.is_system && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title={ar ? "حذف" : "Delete"} onClick={() => onDelete(dept.id, "department")}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>

      {children.length > 0 && (
        <div className="relative pt-6">
          {/* vertical trunk from parent down to the horizontal bus */}
          <div className="absolute left-1/2 top-0 h-6 w-px bg-border -translate-x-1/2" />
          <div className="flex flex-nowrap items-start justify-center gap-1 sm:gap-2">
            {children.map((c, i) => {
              const isFirst = i === 0;
              const isLast = i === children.length - 1;
              const only = children.length === 1;
              return (
                <div key={c.id} className="relative pt-6 flex-1 basis-0 min-w-0 flex flex-col items-center">

                  {/* horizontal bus segment (half for edges, full for middle, none if only child) */}
                  {!only && (
                    <div
                      className="absolute top-0 h-px bg-border"
                      style={{
                        insetInlineStart: isFirst ? "50%" : 0,
                        insetInlineEnd: isLast ? "50%" : 0,
                      }}
                    />
                  )}
                  {/* vertical drop from bus to each child */}
                  <div className="absolute left-1/2 top-0 h-6 w-px bg-border -translate-x-1/2" />
                  <DeptCard
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
                    onMove={onMove}
                    parentId={dept.id}
                  />
                </div>
              );
            })}
          </div>
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
  const [icon, setIcon] = useState<string>(((dept as any)?.icon as string) || "");

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
  const [permsOpen, setPermsOpen] = useState(false);
  const upsertDept = useUpsertDepartment();
  const upsertJob = useUpsertJobTitle();
  const recordId = (record as any).id as string | undefined;
  const displayName = ar ? (nameAr || nameEn) : (nameEn || nameAr);

  const save = async () => {
    if (!nameAr.trim() && !nameEn.trim()) {
      return toast.error(ar ? "الاسم مطلوب" : "Name is required");
    }
    setSaving(true);
    try {
      if (isDept) {
        const payload: any = {
          name: nameAr || nameEn, name_ar: nameAr || null, name_en: nameEn || null,
          code: code || null, color, icon: icon || null, parent_id: parentId, phone: phone || null,
          extension: extension || null, location: location || null, metadata,
        };
        if (isNew) payload.position = (record as any).position ?? 0;
        await upsertDept.mutateAsync({
          isNew,
          id: isNew ? undefined : (record as Department).id,
          payload,
        });
      } else {
        const payload: any = {
          name: nameAr || nameEn, name_ar: nameAr || null, name_en: nameEn || null,
          code: code || null, level, department_id: departmentId, description: description || null, metadata,
        };
        if (isNew) payload.position = (record as any).position ?? 0;
        await upsertJob.mutateAsync({
          isNew,
          id: isNew ? undefined : (record as JobTitle).id,
          payload,
        });
      }
      toast.success(isNew ? (ar ? "تم الإنشاء" : "Created") : (ar ? "تم الحفظ" : "Saved"));
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(ar ? "تعذر الحفظ" : "Failed", { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SheetHeader>
        <div className="flex items-center justify-between gap-2">
          <SheetTitle>
            {isNew
              ? (isDept ? (ar ? "إدارة جديدة" : "New Department") : (ar ? "مسمى وظيفي جديد" : "New Job Title"))
              : (isDept ? (ar ? "تعديل الإدارة" : "Edit Department") : (ar ? "تعديل المسمى" : "Edit Job Title"))}
          </SheetTitle>
          {!isNew && recordId && (
            <Button
              type="button" size="sm" variant="outline"
              className="gap-1.5"
              onClick={() => setPermsOpen(true)}
            >
              <Shield className="h-3.5 w-3.5" />
              {ar ? "الصلاحيات" : "Permissions"}
            </Button>
          )}
        </div>
      </SheetHeader>
      <PermissionMatrix
        open={permsOpen}
        onOpenChange={setPermsOpen}
        scope={recordId ? { kind: isDept ? "department" : "job_title", id: recordId, name: displayName || "" } : null}
      />
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
              <Label className="text-xs">{ar ? "الأيقونة" : "Icon"}</Label>
              <div className="grid grid-cols-9 gap-1.5 max-h-40 overflow-y-auto rounded-md border p-2">
                {DEPT_ICONS.map((it) => {
                  const IcoC = it.icon;
                  const active = icon === it.key;
                  return (
                    <button
                      key={it.key}
                      type="button"
                      onClick={() => setIcon(active ? "" : it.key)}
                      title={ar ? it.label_ar : it.label_en}
                      className={`h-8 w-8 flex items-center justify-center rounded-md border transition-all ${
                        active ? "ring-2 ring-offset-1 ring-primary" : "hover:bg-muted"
                      }`}
                      style={{ color: active ? color : undefined, borderColor: active ? color : undefined }}
                    >
                      <IcoC className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">{ar ? "الإدارة الأب" : "Parent department"}</Label>
              <Select value={parentId ?? "none"} onValueChange={(v) => setParentId(v === "none" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{ar ? "بدون (إدارة أساسية)" : "None (top level)"}</SelectItem>
                  {flattenDeptsHierarchy(departments).filter((x) => x.dept.id !== record.id).map(({ dept: d, depth }) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span style={{ paddingInlineStart: depth * 14 }}>
                        {depth > 0 ? "└ " : ""}{pick(d, lang)}
                      </span>
                    </SelectItem>
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
                  {flattenDeptsHierarchy(departments).map(({ dept: d, depth }) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span style={{ paddingInlineStart: depth * 14 }}>
                        {depth > 0 ? "└ " : ""}{pick(d, lang)}
                      </span>
                    </SelectItem>
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
