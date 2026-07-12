import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useApproveUser,
  useBulkApproveUsers,
  useBulkSetProfileStatus,
  useGrantPermission,
  useHrDashboard,
  useRevokePermission,
  useSetProfileStatus,
  useSetUserRole,
  useUpdateProfile,
  useUserPermissions,
} from "@/features/hr/queries";
import { Button } from "@/components/ui/button";
import { InputIcon } from "@/components/ui/input-icon";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  ArrowLeft, Building2, UserCheck, Users, Ban, Play,
  Search, ArrowUpDown, ChevronUp, ChevronDown,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { pickLangValue } from "@/lib/bilingual";
import { flattenDeptsHierarchy } from "@/lib/orgTree";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Department = Database["public"]["Tables"]["departments"]["Row"];
type JobTitle = Database["public"]["Tables"]["job_titles"]["Row"];
type AppRole = Database["public"]["Enums"]["app_role"];
type AppPermission = Database["public"]["Enums"]["app_permission"];

const ALL_PERMISSIONS: AppPermission[] = [
  "customers.view", "customers.create", "customers.edit", "customers.delete", "customers.manage", "customers.view_payment_info",
  "quotes.view_own", "quotes.view_team", "quotes.view_all", "quotes.view",
  "quotes.create", "quotes.edit", "quotes.delete", "quotes.assign", "quotes.manage", "quotes.approve",
  "workflows.view", "workflows.manage",
  "hr.view", "hr.manage",
  "team.view", "team.manage",
  "users.manage_roles", "templates.manage",
  "notifications.view",
  "reports.view",
  "manage_customer_fields", "manage_form_fields",
];

const permLabelAr: Record<AppPermission, string> = {
  "customers.view": "عرض العملاء",
  "customers.create": "إضافة عميل",
  "customers.edit": "تعديل عميل",
  "customers.delete": "حذف عميل",
  "customers.manage": "إدارة العملاء",
  "customers.view_payment_info": "عرض بيانات الدفع/البنوك",
  "quotes.view": "عرض العروض",
  "quotes.view_own": "عرض عروضه فقط",
  "quotes.view_team": "عرض عروض الفريق",
  "quotes.view_all": "عرض كل العروض",
  "quotes.create": "إنشاء عرض",
  "quotes.edit": "تعديل عرض",
  "quotes.delete": "حذف عرض",
  "quotes.assign": "تكليف عرض",
  "quotes.manage": "إدارة العروض",
  "quotes.approve": "الموافقة على العروض",
  "workflows.view": "عرض القوالب", "workflows.manage": "إدارة القوالب",
  "hr.view": "عرض HR", "hr.manage": "إدارة HR",
  "team.view": "عرض الفريق", "team.manage": "إدارة الفريق",
  "users.manage_roles": "إدارة الأدوار",
  "templates.manage": "إدارة قوالب الحقول",
  "notifications.view": "عرض الإشعارات",
  "reports.view": "عرض التقارير",
  "manage_customer_fields": "إدارة حقول العميل",
  "manage_form_fields": "إدارة حقول النظام (كل الشاشات)",
};

export const Route = createFileRoute("/_authenticated/hr")({
  component: HrPage,
  head: () => ({ meta: [{ title: "الموارد البشرية" }] }),
});

type SortKey = "name" | "role" | "department" | "status" | "created";
type StatusFilter = "all" | "pending" | "active" | "suspended";
type RoleFilter = "all" | AppRole;

function HrPage() {
  const { t, lang } = useI18n();
  const { data, isLoading: loading, refetch } = useHrDashboard();
  const profiles = (data?.profiles ?? []) as Profile[];
  const roles = data?.roles ?? [];
  const departments = (data?.departments ?? []) as Department[];
  const jobTitles = (data?.jobTitles ?? []) as JobTitle[];
  const me = data?.me ?? "";
  const [drawerUser, setDrawerUser] = useState<Profile | null>(null);

  // table state
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Backwards-compat helper: existing mutation code calls `load()` after writes.
  const load = () => { void refetch(); setSelected(new Set()); };

  const roleOf = (uid: string): AppRole | null =>
    roles.find((r) => r.user_id === uid && r.role === "owner")?.role
    ?? roles.find((r) => r.user_id === uid && r.role === "admin")?.role
    ?? roles.find((r) => r.user_id === uid)?.role
    ?? null;

  const deptName = (id: string | null) => id ? (pickLangValue(departments.find((d) => d.id === id) as any, "name", lang).value || departments.find((d) => d.id === id)?.name || "—") : "—";
  const jobName = (id: string | null) => id ? (pickLangValue(jobTitles.find((j) => j.id === id) as any, "name", lang).value || jobTitles.find((j) => j.id === id)?.name || "—") : "—";


  const pendingCount = useMemo(() => profiles.filter((p) => p.status === "pending").length, [profiles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = profiles.slice();
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    if (roleFilter !== "all") list = list.filter((p) => roleOf(p.id) === roleFilter);
    if (deptFilter !== "all") list = list.filter((p) => (p.department_id ?? "none") === deptFilter);
    if (q) list = list.filter((p) =>
      (p.full_name ?? "").toLowerCase().includes(q) ||
      (p.email ?? "").toLowerCase().includes(q)
    );
    list.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "name": return dir * ((a.full_name || a.email || "").localeCompare(b.full_name || b.email || ""));
        case "role": return dir * ((roleOf(a.id) ?? "").localeCompare(roleOf(b.id) ?? ""));
        case "department": return dir * (deptName(a.department_id).localeCompare(deptName(b.department_id)));
        case "status": return dir * ((a.status ?? "").localeCompare(b.status ?? ""));
        case "created":
        default: return dir * ((a.created_at ?? "").localeCompare(b.created_at ?? ""));
      }
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, roles, departments, query, statusFilter, roleFilter, deptFilter, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  }
  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? <ArrowUpDown className="h-3 w-3 opacity-40" /> :
    sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;

  const approveM = useApproveUser();
  const setStatusM = useSetProfileStatus();
  const bulkApproveM = useBulkApproveUsers();
  const bulkStatusM = useBulkSetProfileStatus();

  async function approve(userId: string) {
    try { await approveM.mutateAsync(userId); toast.success(t("saved")); }
    catch (e) { toast.error((e as Error).message); }
    setSelected(new Set());
  }
  async function setStatus(userId: string, status: "active" | "suspended") {
    try { await setStatusM.mutateAsync({ userId, status }); toast.success(t("saved")); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function bulk(action: "approve" | "suspend" | "activate") {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const targets = profiles.filter((p) => ids.includes(p.id) && p.id !== me && roleOf(p.id) !== "owner");
    try {
      if (action === "approve") {
        const pendingIds = targets.filter((p) => p.status === "pending").map((p) => p.id);
        if (!pendingIds.length) { toast.error(lang === "ar" ? "لا يوجد طلبات جديدة ضمن المحدد" : "No pending users selected"); return; }
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
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 me-1" />{t("backToQuotes")}</Button></Link>
          <h1 className="text-lg font-bold flex items-center gap-2"><Building2 className="h-5 w-5" /> {t("hr")}</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">{t("loading")}</div>
        ) : (
          <Tabs defaultValue="users">
            <TabsList>
              <TabsTrigger value="users" className="gap-1">
                <Users className="h-4 w-4" /> {lang === "ar" ? "المستخدمون" : "Users"}
                {pendingCount > 0 && <Badge variant="destructive" className="ms-1">{pendingCount}</Badge>}
              </TabsTrigger>
            </TabsList>


            <TabsContent value="users" className="mt-4 space-y-3">
              {/* Toolbar */}
              <Card>
                <CardContent className="p-3 flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <InputIcon
                      leftIcon={<Search />}
                      value={query}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                      placeholder={lang === "ar" ? "بحث بالاسم أو الإيميل..." : "Search by name or email..."}
                      clearable
                      onClear={() => setQuery("")}
                      className="h-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                    <SelectTrigger className="h-9 w-36"><SelectValue placeholder={t("status")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{lang === "ar" ? "كل الحالات" : "All statuses"}</SelectItem>
                      <SelectItem value="pending">{lang === "ar" ? "قيد الموافقة" : "Pending"}</SelectItem>
                      <SelectItem value="active">{lang === "ar" ? "نشط" : "Active"}</SelectItem>
                      <SelectItem value="suspended">{lang === "ar" ? "معلّق" : "Suspended"}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
                    <SelectTrigger className="h-9 w-32"><SelectValue placeholder={t("role")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{lang === "ar" ? "كل الأدوار" : "All roles"}</SelectItem>
                      <SelectItem value="owner">{t("roleOwner")}</SelectItem>
                      <SelectItem value="admin">{t("roleAdmin")}</SelectItem>
                      <SelectItem value="member">{t("roleMember")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={deptFilter} onValueChange={setDeptFilter}>
                    <SelectTrigger className="h-9 w-40"><SelectValue placeholder={t("department")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{lang === "ar" ? "كل الإدارات" : "All departments"}</SelectItem>
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

              {/* Bulk bar */}
              {selected.size > 0 && (
                <Card className="bg-primary/5 border-primary/30">
                  <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                      {lang === "ar" ? `تم تحديد ${selected.size} مستخدم` : `${selected.size} selected`}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => bulk("approve")}><UserCheck className="h-4 w-4 me-1" />{lang === "ar" ? "موافقة" : "Approve"}</Button>
                      <Button size="sm" variant="outline" onClick={() => bulk("activate")}><Play className="h-4 w-4 me-1" />{t("activate")}</Button>
                      <Button size="sm" variant="outline" onClick={() => bulk("suspend")}><Ban className="h-4 w-4 me-1" />{t("suspendUser")}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>{t("cancel")}</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Table */}
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
                        <ThSort onClick={() => toggleSort("name")}>{lang === "ar" ? "الاسم" : "Name"} <SortIcon k="name" /></ThSort>
                        <ThSort onClick={() => toggleSort("role")}>{t("role")} <SortIcon k="role" /></ThSort>
                        <ThSort onClick={() => toggleSort("department")}>{t("department")} <SortIcon k="department" /></ThSort>
                        <th className="p-3 text-start font-medium">{t("jobTitle")}</th>
                        <ThSort onClick={() => toggleSort("status")}>{t("status")} <SortIcon k="status" /></ThSort>
                        <th className="p-3 text-end font-medium">{lang === "ar" ? "إجراءات" : "Actions"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 && (
                        <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">{lang === "ar" ? "لا يوجد نتائج" : "No results"}</td></tr>
                      )}
                      {filtered.map((p) => {
                        const role = roleOf(p.id);
                        const isSelf = p.id === me;
                        const isOwner = role === "owner";
                        const checked = selected.has(p.id);
                        return (
                          <tr key={p.id}
                            className="border-t hover:bg-muted/30 cursor-pointer"
                            onClick={(e) => {
                              const tag = (e.target as HTMLElement).tagName;
                              if (tag === "INPUT" || tag === "BUTTON" || (e.target as HTMLElement).closest("button,input,[role=checkbox]")) return;
                              setDrawerUser(p);
                            }}>
                            <td className="p-3" onClick={(e) => e.stopPropagation()}>
                              <Checkbox checked={checked} onCheckedChange={(c) => {
                                setSelected((s) => { const n = new Set(s); if (c) n.add(p.id); else n.delete(p.id); return n; });
                              }} />
                            </td>
                            <td className="p-3 min-w-[180px]">
                              <div className="font-medium truncate">{p.full_name || p.email}</div>
                              <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                            </td>
                            <td className="p-3">
                              {role ? <Badge variant={isOwner ? "default" : "secondary"}>{lang === "ar" ? (role === "owner" ? "المالك" : role === "admin" ? "مسؤول" : "عضو") : role}</Badge> : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="p-3">{deptName(p.department_id)}</td>
                            <td className="p-3">{jobName(p.job_title_id)}</td>
                            <td className="p-3">
                              {p.status === "pending" && <Badge variant="outline" className="border-amber-400 text-amber-700">{lang === "ar" ? "قيد الموافقة" : "Pending"}</Badge>}
                              {p.status === "active" && <Badge variant="outline" className="border-emerald-400 text-emerald-700">{lang === "ar" ? "نشط" : "Active"}</Badge>}
                              {p.status === "suspended" && <Badge variant="destructive">{lang === "ar" ? "معلّق" : "Suspended"}</Badge>}
                            </td>
                            <td className="p-3 text-end whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              {p.status === "pending" ? (
                                <Button size="sm" onClick={() => approve(p.id)}><UserCheck className="h-4 w-4 me-1" />{lang === "ar" ? "موافقة" : "Approve"}</Button>
                              ) : (!isSelf && !isOwner) ? (
                                p.status === "active"
                                  ? <Button variant="ghost" size="icon" title={t("suspendUser")} onClick={() => setStatus(p.id, "suspended")}><Ban className="h-4 w-4 text-rose-600" /></Button>
                                  : <Button variant="ghost" size="icon" title={t("activate")} onClick={() => setStatus(p.id, "active")}><Play className="h-4 w-4 text-emerald-600" /></Button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </TabsContent>

            {/* Departments and Job Titles moved to /settings/organization */}

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
        onClose={() => { setDrawerUser(null); load(); }}
      />
    </div>
  );
}

function ThSort({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <th className="p-3 text-start font-medium">
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={onClick}>{children}</button>
    </th>
  );
}

function UserDrawer({ user, role, me, departments, jobTitles, activeProfiles, onClose }: {
  user: Profile | null; role: AppRole | null; me: string;
  departments: Department[]; jobTitles: JobTitle[]; activeProfiles: Profile[];
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const permsQ = useUserPermissions(user?.id);
  const granted = useMemo(() => new Set(permsQ.data ?? []), [permsQ.data]);
  const permLoading = permsQ.isLoading || permsQ.isFetching;
  const isSelf = user?.id === me;
  const isOwner = role === "owner";

  const updateProfile = useUpdateProfile();
  const setRoleM = useSetUserRole();
  const grantM = useGrantPermission();
  const revokeM = useRevokePermission();

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
  async function togglePerm(p: AppPermission, checked: boolean) {
    if (!user) return;
    try {
      if (checked) await grantM.mutateAsync({ userId: user.id, permission: p });
      else await revokeM.mutateAsync({ userId: user.id, permission: p });
    } catch (e) { toast.error((e as Error).message); }
  }


  return (
    <Sheet open={!!user} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={lang === "ar" ? "left" : "right"} className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="truncate">{user?.full_name || user?.email}</SheetTitle>
          <div className="text-sm text-muted-foreground truncate">{user?.email}</div>
        </SheetHeader>

        {user && (
          <div className="space-y-5 py-4">
            <section className="space-y-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground">{lang === "ar" ? "الوظيفة" : "Job"}</div>
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
              <div className="text-xs font-semibold uppercase text-muted-foreground">{t("permissions")}</div>
              {permLoading ? (
                <div className="py-3 text-sm text-muted-foreground">{t("loading")}</div>
              ) : (
                <div className="grid grid-cols-1 gap-1 max-h-[40vh] overflow-auto rounded border p-2">
                  {ALL_PERMISSIONS.map((p) => (
                    <label key={p} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                      <Checkbox checked={granted.has(p)} onCheckedChange={(c) => togglePerm(p, !!c)} />
                      <span>{lang === "ar" ? permLabelAr[p] : p}</span>
                    </label>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        <SheetFooter>
          <Button onClick={onClose}>{lang === "ar" ? "تم" : "Done"}</Button>
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

