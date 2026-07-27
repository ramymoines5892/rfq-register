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
import { KpiCard, EffectiveBadges, RowMenu, GlobalAuditPanel, UserDrawer } from "@/modules/hr/components/parts";
import { ApproveRequestDialog } from "@/modules/hr/components/ApproveRequestDialog";
import { useI18n } from "@/lib/i18n";
import { pickLangValue } from "@/lib/bilingual";
import { flattenDeptsHierarchy } from "@/lib/orgTree";
import { supabase } from "@/integrations/supabase/client";
import { sendPasswordReset } from "@/modules/auth/api";
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
      await sendPasswordReset(email, `${window.location.origin}/reset-password`);
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

