import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useApproveUser,
  useBulkApproveUsers,
  useBulkSetProfileStatus,
  useHrDashboard,
  useSetProfileStatus,
  useSetUserRole,
  useUpdateProfile,
} from "@/modules/hr/queries";
import {
  useAllDeptPermissionsMap,
  useAllJobPermissionsMap,
  useAllUserPermissionsMap,
  useGlobalPermissionAudit,
} from "@/modules/permissions/queries";
import { PERMISSION_GROUPS, groupOf, type AppPermission } from "@/modules/permissions/api";
import { Button } from "@/components/ui/button";
import { InputIcon } from "@/components/ui/input-icon";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  ArrowLeft, Users, Ban, Play, Search, Shield, MoreHorizontal, KeyRound,
  Copy, UserCheck, UserX, ChevronRight, PlusCircle, MinusCircle, Building2, Briefcase, User as UserIcon,
  CheckCircle2, Clock, AlertTriangle, ShieldAlert, History,
} from "lucide-react";
import { PermissionMatrix } from "@/components/permissions/PermissionMatrix";
import { useI18n } from "@/lib/i18n";
import { pickLangValue } from "@/lib/bilingual";
import { flattenDeptsHierarchy } from "@/lib/orgTree";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Department = Database["public"]["Tables"]["departments"]["Row"];
type JobTitle = Database["public"]["Tables"]["job_titles"]["Row"];
type AppRole = Database["public"]["Enums"]["app_role"];

export const Route = createFileRoute("/_authenticated/hr")({
  component: HrPage,
  head: () => ({ meta: [{ title: "المستخدمون والصلاحيات | Users & Permissions" }] }),
});

type StatusFilter = "all" | "pending" | "active" | "suspended";
type RoleFilter = "all" | AppRole;

function HrPage() {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const { data, isLoading: loading, refetch } = useHrDashboard();
  const profiles = (data?.profiles ?? []) as Profile[];
  const roles = data?.roles ?? [];
  const departments = (data?.departments ?? []) as Department[];
  const jobTitles = (data?.jobTitles ?? []) as JobTitle[];
  const me = data?.me ?? "";
  const [drawerUser, setDrawerUser] = useState<Profile | null>(null);
  const [matrixUser, setMatrixUser] = useState<Profile | null>(null);

  // Bulk permission maps for effective-badge computation.
  const deptMapQ = useAllDeptPermissionsMap();
  const jobMapQ = useAllJobPermissionsMap();
  const userMapQ = useAllUserPermissionsMap();
  const deptMap = deptMapQ.data ?? new Map();
  const jobMap = jobMapQ.data ?? new Map();
  const userMap = userMapQ.data ?? new Map();

  // Toolbar state
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"users" | "requests" | "audit">("users");

  const load = () => { void refetch(); setSelected(new Set()); };

  const roleOf = (uid: string): AppRole | null =>
    roles.find((r) => r.user_id === uid && r.role === "owner")?.role
    ?? roles.find((r) => r.user_id === uid && r.role === "admin")?.role
    ?? roles.find((r) => r.user_id === uid)?.role
    ?? null;

  const deptName = (id: string | null | undefined) => {
    if (!id) return "—";
    const d = departments.find((x) => x.id === id);
    return d ? (pickLangValue(d as any, "name", lang).value || d.name) : "—";
  };
  const jobName = (id: string | null | undefined) => {
    if (!id) return "—";
    const j = jobTitles.find((x) => x.id === id);
    return j ? (pickLangValue(j as any, "name", lang).value || j.name) : "—";
  };

  /** Effective permission set for a user (personal ∪ job ∪ dept). */
  const effectiveOf = (p: Profile): Set<AppPermission> => {
    const out = new Set<AppPermission>();
    userMap.get(p.id)?.forEach((x: AppPermission) => out.add(x));
    if (p.job_title_id) jobMap.get(p.job_title_id)?.forEach((x: AppPermission) => out.add(x));
    if (p.department_id) deptMap.get(p.department_id)?.forEach((x: AppPermission) => out.add(x));
    return out;
  };

  // ── KPIs ────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    let active = 0, pending = 0, suspended = 0, missingLink = 0;
    for (const p of profiles) {
      if (p.status === "active") active++;
      else if (p.status === "pending") pending++;
      else if (p.status === "suspended") suspended++;
      if (p.status !== "pending" && (!p.department_id || !p.job_title_id)) missingLink++;
    }
    return { total: profiles.length, active, pending, suspended, missingLink };
  }, [profiles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = profiles.filter((p) => p.status !== "pending");
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    if (roleFilter !== "all") list = list.filter((p) => roleOf(p.id) === roleFilter);
    if (deptFilter !== "all") list = list.filter((p) => (p.department_id ?? "none") === deptFilter);
    if (q) list = list.filter((p) =>
      (p.full_name ?? "").toLowerCase().includes(q) ||
      (p.email ?? "").toLowerCase().includes(q)
    );
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, roles, query, statusFilter, roleFilter, deptFilter]);

  const pendingList = useMemo(() => profiles.filter((p) => p.status === "pending"), [profiles]);

  // ── Mutations ───────────────────────────────────────────────────
  const approveM = useApproveUser();
  const setStatusM = useSetProfileStatus();
  const setRoleM = useSetUserRole();
  const updateProfileM = useUpdateProfile();
  const bulkApproveM = useBulkApproveUsers();
  const bulkStatusM = useBulkSetProfileStatus();

  async function approve(userId: string) {
    try { await approveM.mutateAsync(userId); toast.success(t("saved")); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function setStatus(userId: string, status: "active" | "suspended") {
    try { await setStatusM.mutateAsync({ userId, status }); toast.success(t("saved")); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function changeRole(userId: string, role: AppRole) {
    try { await setRoleM.mutateAsync({ userId, role }); toast.success(t("saved")); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function updateField(userId: string, patch: Partial<Profile>) {
    try { await updateProfileM.mutateAsync({ userId, patch }); toast.success(t("saved")); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function sendReset(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success(ar ? "تم إرسال رابط إعادة التعيين" : "Reset link sent");
    } catch (e) { toast.error((e as Error).message); }
  }
  async function bulk(action: "approve" | "suspend" | "activate") {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const targets = profiles.filter((p) => ids.includes(p.id) && p.id !== me && roleOf(p.id) !== "owner");
    try {
      if (action === "approve") {
        const pendingIds = targets.filter((p) => p.status === "pending").map((p) => p.id);
        if (!pendingIds.length) { toast.error(ar ? "لا توجد طلبات جديدة" : "No pending users"); return; }
        await bulkApproveM.mutateAsync(pendingIds);
      } else {
        const status = action === "suspend" ? "suspended" : "active";
        await bulkStatusM.mutateAsync({ userIds: targets.map((p) => p.id), status });
      }
      toast.success(t("saved"));
    } catch (e) { toast.error((e as Error).message); }
    setSelected(new Set());
  }

  const allChecked = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const someChecked = filtered.some((p) => selected.has(p.id));

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 me-1" />{t("backToQuotes")}</Button></Link>
          </div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            {ar ? "المستخدمون والصلاحيات" : "Users & Permissions"}
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard icon={<Users className="h-4 w-4" />} label={ar ? "إجمالي" : "Total"} value={kpis.total} tone="muted" />
          <KpiCard icon={<CheckCircle2 className="h-4 w-4" />} label={ar ? "نشط" : "Active"} value={kpis.active} tone="emerald" />
          <KpiCard
            icon={<Clock className="h-4 w-4" />} label={ar ? "بانتظار الموافقة" : "Pending"} value={kpis.pending} tone="amber"
            onClick={kpis.pending > 0 ? () => setTab("requests") : undefined}
          />
          <KpiCard icon={<Ban className="h-4 w-4" />} label={ar ? "معلّق" : "Suspended"} value={kpis.suspended} tone="rose" />
          <KpiCard
            icon={<AlertTriangle className="h-4 w-4" />} label={ar ? "بدون إدارة/وظيفة" : "Missing dept/job"} value={kpis.missingLink} tone="orange"
          />
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">{t("loading")}</div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="users" className="gap-1.5">
                <Users className="h-4 w-4" /> {ar ? "المستخدمون" : "Users"}
              </TabsTrigger>
              <TabsTrigger value="requests" className="gap-1.5">
                <UserCheck className="h-4 w-4" /> {ar ? "طلبات الانضمام" : "Join requests"}
                {kpis.pending > 0 && <Badge variant="destructive" className="ms-1">{kpis.pending}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="audit" className="gap-1.5">
                <History className="h-4 w-4" /> {ar ? "سجل التغييرات" : "Audit log"}
              </TabsTrigger>
            </TabsList>

            {/* ── USERS TAB ────────────────────────────────────────── */}
            <TabsContent value="users" className="mt-4 space-y-3">
              <Card>
                <CardContent className="p-3 flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <InputIcon
                      leftIcon={<Search />}
                      value={query}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                      placeholder={ar ? "بحث بالاسم أو الإيميل..." : "Search by name or email..."}
                      clearable onClear={() => setQuery("")} className="h-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                    <SelectTrigger className="h-9 w-36"><SelectValue placeholder={t("status")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{ar ? "كل الحالات" : "All statuses"}</SelectItem>
                      <SelectItem value="active">{ar ? "نشط" : "Active"}</SelectItem>
                      <SelectItem value="suspended">{ar ? "معلّق" : "Suspended"}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
                    <SelectTrigger className="h-9 w-32"><SelectValue placeholder={t("role")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{ar ? "كل الأدوار" : "All roles"}</SelectItem>
                      <SelectItem value="owner">{t("roleOwner")}</SelectItem>
                      <SelectItem value="admin">{t("roleAdmin")}</SelectItem>
                      <SelectItem value="member">{t("roleMember")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={deptFilter} onValueChange={setDeptFilter}>
                    <SelectTrigger className="h-9 w-40"><SelectValue placeholder={t("department")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{ar ? "كل الإدارات" : "All departments"}</SelectItem>
                      <SelectItem value="none">{t("none")}</SelectItem>
                      {flattenDeptsHierarchy(departments).map(({ dept: d, depth }) => (
                        <SelectItem key={d.id} value={d.id}>
                          <span style={{ paddingInlineStart: depth * 14 }}>
                            {depth > 0 ? "└ " : ""}{pickLangValue(d as any, "name", lang).value || d.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Bulk actions */}
              {selected.size > 0 && (
                <Card className="bg-primary/5 border-primary/30">
                  <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                      {ar ? `تم تحديد ${selected.size} مستخدم` : `${selected.size} selected`}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => bulk("activate")}><Play className="h-4 w-4 me-1" />{t("activate")}</Button>
                      <Button size="sm" variant="outline" onClick={() => bulk("suspend")}><Ban className="h-4 w-4 me-1" />{t("suspendUser")}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>{t("cancel")}</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Users table */}
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="p-3 w-10">
                          <Checkbox
                            checked={allChecked ? true : someChecked ? "indeterminate" : false}
                            onCheckedChange={(c) => {
                              if (c) setSelected(new Set(filtered.map((p) => p.id)));
                              else setSelected(new Set());
                            }}
                          />
                        </th>
                        <th className="p-3 text-start font-medium">{ar ? "المستخدم" : "User"}</th>
                        <th className="p-3 text-start font-medium">{t("role")}</th>
                        <th className="p-3 text-start font-medium">{t("department")}</th>
                        <th className="p-3 text-start font-medium">{t("jobTitle")}</th>
                        <th className="p-3 text-start font-medium">{ar ? "الصلاحيات الفعّالة" : "Effective permissions"}</th>
                        <th className="p-3 text-start font-medium">{t("status")}</th>
                        <th className="p-3 text-end font-medium w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 && (
                        <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">{ar ? "لا يوجد نتائج" : "No results"}</td></tr>
                      )}
                      {filtered.map((p) => {
                        const role = roleOf(p.id);
                        const isSelf = p.id === me;
                        const isOwner = role === "owner";
                        const checked = selected.has(p.id);
                        const eff = effectiveOf(p);
                        return (
                          <tr key={p.id} className="border-t hover:bg-muted/30">
                            <td className="p-3">
                              <Checkbox checked={checked} onCheckedChange={(c) => {
                                setSelected((s) => { const n = new Set(s); if (c) n.add(p.id); else n.delete(p.id); return n; });
                              }} />
                            </td>
                            <td className="p-3 min-w-[200px] cursor-pointer" onClick={() => setDrawerUser(p)}>
                              <div className="font-medium truncate flex items-center gap-1.5">
                                {p.full_name || p.email}
                                {isSelf && <Badge variant="outline" className="text-[9px] px-1 py-0">{ar ? "أنت" : "You"}</Badge>}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                            </td>
                            <td className="p-3">
                              {isOwner || isSelf ? (
                                <Badge variant={isOwner ? "default" : "secondary"}>
                                  {ar ? (role === "owner" ? "المالك" : role === "admin" ? "مسؤول" : "عضو") : role}
                                </Badge>
                              ) : (
                                <Select value={role ?? "member"} onValueChange={(v) => changeRole(p.id, v as AppRole)}>
                                  <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin">{t("roleAdmin")}</SelectItem>
                                    <SelectItem value="member">{t("roleMember")}</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </td>
                            <td className="p-3">
                              <Select
                                value={p.department_id ?? "none"}
                                onValueChange={(v) => updateField(p.id, { department_id: v === "none" ? null : v })}
                              >
                                <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">{t("none")}</SelectItem>
                                  {flattenDeptsHierarchy(departments).map(({ dept: d, depth }) => (
                                    <SelectItem key={d.id} value={d.id}>
                                      <span style={{ paddingInlineStart: depth * 14 }}>
                                        {depth > 0 ? "└ " : ""}{pickLangValue(d as any, "name", lang).value || d.name}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-3">
                              <Select
                                value={p.job_title_id ?? "none"}
                                onValueChange={(v) => updateField(p.id, { job_title_id: v === "none" ? null : v })}
                              >
                                <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">{t("none")}</SelectItem>
                                  {jobTitles.map((j) => (
                                    <SelectItem key={j.id} value={j.id}>
                                      {pickLangValue(j as any, "name", lang).value || j.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-3">
                              <EffectiveBadges
                                eff={eff}
                                onOpen={() => setMatrixUser(p)}
                                isOwner={isOwner}
                              />
                            </td>
                            <td className="p-3">
                              {p.status === "active" && <Badge variant="outline" className="border-emerald-400 text-emerald-700">{ar ? "نشط" : "Active"}</Badge>}
                              {p.status === "suspended" && <Badge variant="destructive">{ar ? "معلّق" : "Suspended"}</Badge>}
                              {p.status === "pending" && <Badge variant="outline" className="border-amber-400 text-amber-700">{ar ? "بانتظار" : "Pending"}</Badge>}
                            </td>
                            <td className="p-3 text-end">
                              <RowMenu
                                isSelf={isSelf} isOwner={isOwner} status={p.status}
                                onManagePerms={() => setMatrixUser(p)}
                                onOpenDrawer={() => setDrawerUser(p)}
                                onReset={() => sendReset(p.email)}
                                onCopyEmail={() => { navigator.clipboard.writeText(p.email); toast.success(ar ? "تم النسخ" : "Copied"); }}
                                onSuspend={() => setStatus(p.id, "suspended")}
                                onActivate={() => setStatus(p.id, "active")}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </TabsContent>

            {/* ── REQUESTS TAB ─────────────────────────────────────── */}
            <TabsContent value="requests" className="mt-4">
              {pendingList.length === 0 ? (
                <Card><CardContent className="p-10 text-center text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500" />
                  {ar ? "لا توجد طلبات معلّقة." : "No pending requests."}
                </CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pendingList.map((p) => (
                    <Card key={p.id}>
                      <CardContent className="p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.full_name || p.email}</div>
                          <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                          <div className="text-[11px] text-muted-foreground mt-1">
                            {ar ? "طُلب في" : "Requested"}{" "}
                            {new Intl.DateTimeFormat(ar ? "ar-EG" : "en-US", { dateStyle: "medium" }).format(new Date(p.created_at))}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button size="sm" onClick={() => approve(p.id)}><UserCheck className="h-4 w-4 me-1" />{ar ? "موافقة" : "Approve"}</Button>
                          <Button size="sm" variant="outline" onClick={() => setStatus(p.id, "suspended")}>
                            <UserX className="h-4 w-4 me-1" />{ar ? "رفض" : "Reject"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── AUDIT TAB ────────────────────────────────────────── */}
            <TabsContent value="audit" className="mt-4">
              <GlobalAuditPanel />
            </TabsContent>
          </Tabs>
        )}
      </main>

      <UserDrawer
        user={drawerUser}
        role={drawerUser ? roleOf(drawerUser.id) : null}
        me={me}
        departments={departments}
        jobTitles={jobTitles}
        activeProfiles={profiles.filter((p) => p.status !== "pending")}
        deptName={deptName(drawerUser?.department_id)}
        jobName={jobName(drawerUser?.job_title_id)}
        effective={drawerUser ? effectiveOf(drawerUser) : new Set()}
        onOpenMatrix={() => { if (drawerUser) setMatrixUser(drawerUser); }}
        onClose={() => { setDrawerUser(null); load(); }}
      />

      <PermissionMatrix
        open={!!matrixUser}
        onOpenChange={(o) => { if (!o) { setMatrixUser(null); load(); } }}
        scope={matrixUser ? { kind: "user", id: matrixUser.id, name: matrixUser.full_name || matrixUser.email } : null}
      />
    </div>
  );
}

/* ─── KPI card ─────────────────────────────────────────────────── */
const TONE: Record<string, string> = {
  muted: "bg-muted/50 text-muted-foreground",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
};
function KpiCard({ icon, label, value, tone, onClick }: {
  icon: React.ReactNode; label: string; value: number; tone: keyof typeof TONE; onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <Card
      className={`${clickable ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${TONE[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-lg font-bold leading-tight">{value}</div>
        </div>
        {clickable && <ChevronRight className="h-4 w-4 text-muted-foreground ms-auto" />}
      </CardContent>
    </Card>
  );
}

/* ─── Effective badges (grouped) ───────────────────────────────── */
function EffectiveBadges({ eff, onOpen, isOwner }: {
  eff: Set<AppPermission>; onOpen: () => void; isOwner: boolean;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";

  if (isOwner) {
    return (
      <button onClick={onOpen} className="inline-flex items-center gap-1.5 text-xs hover:underline">
        <Badge className="gap-1"><Shield className="h-3 w-3" />{ar ? "كل الصلاحيات" : "All permissions"}</Badge>
      </button>
    );
  }
  if (eff.size === 0) {
    return (
      <button onClick={onOpen} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:underline">
        <Shield className="h-3.5 w-3.5" /> {ar ? "لا توجد" : "None"}
      </button>
    );
  }
  // Group by module
  const counts = new Map<string, number>();
  eff.forEach((p) => {
    const g = groupOf(p);
    counts.set(g, (counts.get(g) ?? 0) + 1);
  });
  const groupsShown = PERMISSION_GROUPS.filter((g) => counts.has(g.key)).slice(0, 3);
  const extra = Math.max(0, counts.size - groupsShown.length);
  return (
    <button onClick={onOpen} className="flex flex-wrap items-center gap-1 hover:opacity-80" title={ar ? "إدارة الصلاحيات" : "Manage"}>
      <Badge variant="secondary" className="gap-1 text-[10px]">
        <Shield className="h-3 w-3" />{eff.size}
      </Badge>
      {groupsShown.map((g) => (
        <Badge key={g.key} variant="outline" className="text-[10px]">
          {ar ? g.ar : g.en} · {counts.get(g.key)}
        </Badge>
      ))}
      {extra > 0 && <Badge variant="outline" className="text-[10px]">+{extra}</Badge>}
    </button>
  );
}

/* ─── Row action menu ──────────────────────────────────────────── */
function RowMenu({
  isSelf, isOwner, status,
  onManagePerms, onOpenDrawer, onReset, onCopyEmail, onSuspend, onActivate,
}: {
  isSelf: boolean; isOwner: boolean; status: Profile["status"];
  onManagePerms: () => void; onOpenDrawer: () => void; onReset: () => void; onCopyEmail: () => void;
  onSuspend: () => void; onActivate: () => void;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={onOpenDrawer}>
          <UserIcon className="h-4 w-4 me-2" />{ar ? "عرض التفاصيل" : "View details"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onManagePerms}>
          <Shield className="h-4 w-4 me-2" />{ar ? "إدارة الصلاحيات" : "Manage permissions"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCopyEmail}>
          <Copy className="h-4 w-4 me-2" />{ar ? "نسخ الإيميل" : "Copy email"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onReset}>
          <KeyRound className="h-4 w-4 me-2" />{ar ? "إرسال إعادة تعيين كلمة السر" : "Send password reset"}
        </DropdownMenuItem>
        {!isSelf && !isOwner && (
          <>
            <DropdownMenuSeparator />
            {status === "active" ? (
              <DropdownMenuItem onClick={onSuspend} className="text-rose-600">
                <Ban className="h-4 w-4 me-2" />{ar ? "تعليق الحساب" : "Suspend"}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onActivate} className="text-emerald-600">
                <Play className="h-4 w-4 me-2" />{ar ? "تفعيل الحساب" : "Activate"}
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─── Global audit panel ───────────────────────────────────────── */
function GlobalAuditPanel() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const q = useGlobalPermissionAudit(150);
  const fmt = new Intl.DateTimeFormat(ar ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short" });

  if (q.isLoading) return <div className="py-8 text-center text-muted-foreground">{ar ? "جاري التحميل..." : "Loading..."}</div>;
  if (q.error) return (
    <Card><CardContent className="py-8 text-center text-sm text-destructive">
      {ar ? "تعذر تحميل السجل (تحتاج صلاحية مسؤول)." : "Cannot load audit log (admin permission required)."}
    </CardContent></Card>
  );
  const entries = q.data ?? [];
  if (!entries.length) return (
    <Card><CardContent className="py-10 text-center text-muted-foreground">
      {ar ? "لا توجد تغييرات مسجلة." : "No changes recorded."}
    </CardContent></Card>
  );

  const scopeIcon = { department: Building2, job_title: Briefcase, user: UserIcon } as const;
  const scopeLabel = (s: "department" | "job_title" | "user") =>
    ar ? { department: "إدارة", job_title: "وظيفة", user: "مستخدم" }[s]
       : { department: "Department", job_title: "Job title", user: "User" }[s];

  return (
    <Card>
      <ul className="divide-y">
        {entries.map((e) => {
          const Icon = scopeIcon[e.scope];
          return (
            <li key={e.id} className="p-3 flex items-start gap-3">
              {e.action === "grant"
                ? <PlusCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                : <MinusCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <Icon className="h-3 w-3" />{scopeLabel(e.scope)}
                  </Badge>
                  <span className="font-medium truncate">{e.target_name || e.target_id.slice(0, 8)}</span>
                  <span className="text-muted-foreground">
                    {e.action === "grant" ? (ar ? "منح" : "granted") : (ar ? "ألغى" : "revoked")}
                  </span>
                  <span className="font-mono text-[11px] rounded bg-muted px-1.5 py-0.5">{e.permission}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {ar ? "بواسطة" : "by"}{" "}
                  <span className="font-medium">{e.actor_name || e.actor_email || (ar ? "نظام" : "system")}</span>
                  {" · "}{fmt.format(new Date(e.created_at))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ─── User drawer ──────────────────────────────────────────────── */
function UserDrawer({
  user, role, me, departments, jobTitles, activeProfiles,
  deptName, jobName, effective,
  onOpenMatrix, onClose,
}: {
  user: Profile | null; role: AppRole | null; me: string;
  departments: Department[]; jobTitles: JobTitle[]; activeProfiles: Profile[];
  deptName: string; jobName: string; effective: Set<AppPermission>;
  onOpenMatrix: () => void; onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const isSelf = user?.id === me;
  const isOwner = role === "owner";
  const updateProfile = useUpdateProfile();
  const setRoleM = useSetUserRole();

  async function updateField(patch: Partial<Profile>) {
    if (!user) return;
    try { await updateProfile.mutateAsync({ userId: user.id, patch }); toast.success(t("saved")); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function changeRole(newRole: AppRole) {
    if (!user) return;
    try { await setRoleM.mutateAsync({ userId: user.id, role: newRole }); toast.success(t("saved")); }
    catch (e) { toast.error((e as Error).message); }
  }

  const groupCounts = useMemo(() => {
    const m = new Map<string, number>();
    effective.forEach((p) => {
      const g = groupOf(p);
      m.set(g, (m.get(g) ?? 0) + 1);
    });
    return m;
  }, [effective]);

  return (
    <Sheet open={!!user} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={ar ? "left" : "right"} className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="truncate flex items-center gap-2">
            <UserIcon className="h-4 w-4" />{user?.full_name || user?.email}
          </SheetTitle>
          <div className="text-sm text-muted-foreground truncate">{user?.email}</div>
          <div className="flex flex-wrap gap-1 pt-1">
            {role && <Badge variant={isOwner ? "default" : "secondary"}>{ar ? (role === "owner" ? "المالك" : role === "admin" ? "مسؤول" : "عضو") : role}</Badge>}
            <Badge variant="outline" className="gap-1"><Building2 className="h-3 w-3" />{deptName}</Badge>
            <Badge variant="outline" className="gap-1"><Briefcase className="h-3 w-3" />{jobName}</Badge>
          </div>
        </SheetHeader>

        {user && (
          <div className="space-y-5 py-4">
            <section className="space-y-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground">{ar ? "الوظيفة" : "Job"}</div>
              <FieldRow label={t("department")}>
                <Select value={user.department_id ?? "none"} onValueChange={(v) => updateField({ department_id: v === "none" ? null : v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("none")}</SelectItem>
                    {flattenDeptsHierarchy(departments).map(({ dept: d, depth }) => (
                      <SelectItem key={d.id} value={d.id}>
                        <span style={{ paddingInlineStart: depth * 14 }}>
                          {depth > 0 ? "└ " : ""}{pickLangValue(d as any, "name", lang).value || d.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label={t("jobTitle")}>
                <Select value={user.job_title_id ?? "none"} onValueChange={(v) => updateField({ job_title_id: v === "none" ? null : v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("none")}</SelectItem>
                    {jobTitles.map((j) => <SelectItem key={j.id} value={j.id}>{pickLangValue(j as any, "name", lang).value || j.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label={t("directManager")}>
                <Select value={user.manager_id ?? "none"} onValueChange={(v) => updateField({ manager_id: v === "none" ? null : v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("none")}</SelectItem>
                    {activeProfiles.filter((a) => a.id !== user.id).map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FieldRow>
            </section>

            {role && !isOwner && !isSelf && (
              <section className="space-y-2">
                <div className="text-xs font-semibold uppercase text-muted-foreground">{t("role")}</div>
                <Select value={role} onValueChange={(v) => changeRole(v as AppRole)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{t("roleAdmin")}</SelectItem>
                    <SelectItem value="member">{t("roleMember")}</SelectItem>
                  </SelectContent>
                </Select>
              </section>
            )}

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase text-muted-foreground">
                  {ar ? "الصلاحيات الفعّالة" : "Effective permissions"}
                </div>
                <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={onOpenMatrix}>
                  <Shield className="h-3.5 w-3.5" />
                  {ar ? "إدارة الصلاحيات" : "Manage"}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                {ar
                  ? "الصلاحيات النهائية = الإدارة + المسمى الوظيفي + الصلاحيات الشخصية."
                  : "Effective = Department + Job Title + Personal overrides."}
              </div>
              {isOwner ? (
                <Badge className="gap-1"><Shield className="h-3 w-3" />{ar ? "المالك يمتلك كل الصلاحيات" : "Owner has full access"}</Badge>
              ) : effective.size === 0 ? (
                <div className="text-sm text-muted-foreground">{ar ? "لا توجد صلاحيات." : "No permissions."}</div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm font-medium">{ar ? "الإجمالي:" : "Total:"} {effective.size}</div>
                  <div className="flex flex-wrap gap-1">
                    {PERMISSION_GROUPS.filter((g) => groupCounts.has(g.key)).map((g) => (
                      <Badge key={g.key} variant="outline" className="gap-1 text-xs">
                        {ar ? g.ar : g.en} · {groupCounts.get(g.key)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        <SheetFooter>
          <Button onClick={onClose}>{ar ? "تم" : "Done"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-2">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div>{children}</div>
    </div>
  );
}
