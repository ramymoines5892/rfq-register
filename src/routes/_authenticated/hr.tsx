import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  ArrowLeft, Building2, Briefcase, Trash2, UserCheck, Users, Plus, Ban, Play,
  Search, ArrowUpDown, ChevronUp, ChevronDown,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { BilingualInputs, BilingualText, pickLangValue } from "@/lib/bilingual";
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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<{ user_id: string; role: AppRole }[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string>("");
  const [drawerUser, setDrawerUser] = useState<Profile | null>(null);

  // table state
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    setMe(userData.user?.id ?? "");
    const [{ data: p }, { data: r }, { data: d }, { data: j }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("departments").select("*").order("name"),
      supabase.from("job_titles").select("*").order("name"),
    ]);
    setProfiles((p ?? []) as Profile[]);
    setRoles((r ?? []) as { user_id: string; role: AppRole }[]);
    setDepartments((d ?? []) as Department[]);
    setJobTitles((j ?? []) as JobTitle[]);
    setSelected(new Set());
    setLoading(false);
  }

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

  async function approve(userId: string) {
    const { error: e1 } = await supabase.from("profiles").update({ status: "active" }).eq("id", userId);
    if (e1) { toast.error(e1.message); return; }
    await supabase.from("user_roles").insert({ user_id: userId, role: "member" as AppRole });
    toast.success(t("saved"));
    load();
  }
  async function setStatus(userId: string, status: "active" | "suspended") {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success(t("saved"));
    load();
  }
  async function bulk(action: "approve" | "suspend" | "activate") {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const targets = profiles.filter((p) => ids.includes(p.id) && p.id !== me && roleOf(p.id) !== "owner");
    if (action === "approve") {
      const pendingIds = targets.filter((p) => p.status === "pending").map((p) => p.id);
      if (!pendingIds.length) { toast.error(lang === "ar" ? "لا يوجد طلبات جديدة ضمن المحدد" : "No pending users selected"); return; }
      await supabase.from("profiles").update({ status: "active" }).in("id", pendingIds);
      await supabase.from("user_roles").insert(pendingIds.map((id) => ({ user_id: id, role: "member" as AppRole })));
    } else {
      const status = action === "suspend" ? "suspended" : "active";
      await supabase.from("profiles").update({ status }).in("id", targets.map((p) => p.id));
    }
    toast.success(t("saved"));
    load();
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
              <TabsTrigger value="departments" className="gap-1"><Building2 className="h-4 w-4" /> {t("departments")}</TabsTrigger>
              <TabsTrigger value="jobs" className="gap-1"><Briefcase className="h-4 w-4" /> {t("jobTitles")}</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="mt-4 space-y-3">
              {/* Toolbar */}
              <Card>
                <CardContent className="p-3 flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute top-1/2 -translate-y-1/2 start-2 h-4 w-4 text-muted-foreground" />
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={lang === "ar" ? "بحث بالاسم أو الإيميل..." : "Search by name or email..."} className="ps-8 h-9" />
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
                      {departments.map((d) => <SelectItem key={d.id} value={d.id}>{pickLangValue(d as any, "name", lang).value || d.name}</SelectItem>)}
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

            <TabsContent value="departments" className="mt-4">
              <DepartmentsTab departments={departments} profiles={profiles.filter(p => p.status !== "pending")} onChanged={load} />
            </TabsContent>

            <TabsContent value="jobs" className="mt-4">
              <JobTitlesTab jobTitles={jobTitles} departments={departments} onChanged={load} />
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
  const [granted, setGranted] = useState<Set<AppPermission>>(new Set());
  const [permLoading, setPermLoading] = useState(false);
  const isSelf = user?.id === me;
  const isOwner = role === "owner";

  useEffect(() => {
    if (!user) return;
    setPermLoading(true);
    supabase.from("user_permissions").select("permission").eq("user_id", user.id).then(({ data }) => {
      setGranted(new Set((data ?? []).map((r) => r.permission as AppPermission)));
      setPermLoading(false);
    });
  }, [user?.id]);

  async function updateField(patch: Partial<Profile>) {
    if (!user) return;
    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("saved"));
  }
  async function changeRole(newRole: AppRole) {
    if (!user) return;
    const { data: existing } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    for (const r of existing ?? []) {
      if (r.role !== newRole) await supabase.from("user_roles").delete().eq("user_id", user.id).eq("role", r.role);
    }
    if (!(existing ?? []).some((r) => r.role === newRole)) {
      await supabase.from("user_roles").insert({ user_id: user.id, role: newRole });
    }
    toast.success(t("saved"));
  }
  async function togglePerm(p: AppPermission, checked: boolean) {
    if (!user) return;
    if (checked) {
      const { error } = await supabase.from("user_permissions").insert({ user_id: user.id, permission: p });
      if (error) { toast.error(error.message); return; }
      setGranted((s) => new Set(s).add(p));
    } else {
      const { error } = await supabase.from("user_permissions").delete().eq("user_id", user.id).eq("permission", p);
      if (error) { toast.error(error.message); return; }
      setGranted((s) => { const n = new Set(s); n.delete(p); return n; });
    }
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
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{pickLangValue(d as any, "name", lang).value || d.name}</SelectItem>)}
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

function DepartmentsTab({ departments, profiles, onChanged }: { departments: Department[]; profiles: Profile[]; onChanged: () => void }) {
  const { t, lang } = useI18n();
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [managerId, setManagerId] = useState<string>("none");

  async function add() {
    const ar = nameAr.trim();
    const en = nameEn.trim();
    if (!ar && !en) return;
    const legacy = ar || en;
    const { error } = await supabase.from("departments").insert({
      name: legacy,
      name_ar: ar || null,
      name_en: en || null,
      manager_id: managerId === "none" ? null : managerId,
    });
    if (error) { toast.error(error.message); return; }
    setNameAr(""); setNameEn(""); setManagerId("none");
    toast.success(t("saved"));
    onChanged();
  }
  async function remove(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    onChanged();
  }
  async function updateManager(id: string, mid: string) {
    await supabase.from("departments").update({ manager_id: mid === "none" ? null : mid }).eq("id", id);
    onChanged();
  }
  async function renameDept(id: string, ar: string, en: string) {
    const legacy = ar.trim() || en.trim();
    if (!legacy) return;
    await supabase.from("departments").update({
      name: legacy,
      name_ar: ar.trim() || null,
      name_en: en.trim() || null,
    }).eq("id", id);
    onChanged();
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 space-y-3">
          <BilingualInputs
            label={t("departmentName")}
            valueAr={nameAr}
            valueEn={nameEn}
            onChangeAr={setNameAr}
            onChangeEn={setNameEn}
            maxLength={120}
          />
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger><SelectValue placeholder={t("departmentManager")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("none")}</SelectItem>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={add}><Plus className="h-4 w-4 me-1" />{t("addDepartment")}</Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-2">
        {departments.map((d) => (
          <Card key={d.id}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="font-medium flex-1">
                  <BilingualText row={d as any} base="name" />
                </div>
                <div className="flex items-center gap-2">
                  <Select value={d.manager_id ?? "none"} onValueChange={(v) => updateManager(d.id, v)}>
                    <SelectTrigger className="h-8 text-xs w-48"><SelectValue placeholder={t("departmentManager")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("none")}</SelectItem>
                      {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => remove(d.id)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                </div>
              </div>
              <BilingualInputs
                valueAr={(d as any).name_ar ?? ""}
                valueEn={(d as any).name_en ?? ""}
                onChangeAr={(v) => renameDept(d.id, v, (d as any).name_en ?? "")}
                onChangeEn={(v) => renameDept(d.id, (d as any).name_ar ?? "", v)}
                maxLength={120}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function JobTitlesTab({ jobTitles, departments, onChanged }: { jobTitles: JobTitle[]; departments: Department[]; onChanged: () => void }) {
  const { t, lang } = useI18n();
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [depId, setDepId] = useState<string>("none");

  async function add() {
    const ar = nameAr.trim();
    const en = nameEn.trim();
    if (!ar && !en) return;
    const legacy = ar || en;
    const { error } = await supabase.from("job_titles").insert({
      name: legacy,
      name_ar: ar || null,
      name_en: en || null,
      department_id: depId === "none" ? null : depId,
    });
    if (error) { toast.error(error.message); return; }
    setNameAr(""); setNameEn(""); setDepId("none");
    toast.success(t("saved"));
    onChanged();
  }
  async function remove(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    const { error } = await supabase.from("job_titles").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    onChanged();
  }
  async function renameJob(id: string, ar: string, en: string) {
    const legacy = ar.trim() || en.trim();
    if (!legacy) return;
    await supabase.from("job_titles").update({
      name: legacy,
      name_ar: ar.trim() || null,
      name_en: en.trim() || null,
    }).eq("id", id);
    onChanged();
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 space-y-3">
          <BilingualInputs
            label={t("jobTitleName")}
            valueAr={nameAr}
            valueEn={nameEn}
            onChangeAr={setNameAr}
            onChangeEn={setNameEn}
            maxLength={120}
          />
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <Select value={depId} onValueChange={setDepId}>
              <SelectTrigger><SelectValue placeholder={t("department")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("none")}</SelectItem>
                {departments.map((d) => <SelectItem key={d.id} value={d.id}>{pickLangValue(d as any, "name", lang).value || d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={add}><Plus className="h-4 w-4 me-1" />{t("addJobTitle")}</Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-2">
        {jobTitles.map((j) => {
          const dept = departments.find((d) => d.id === j.department_id);
          return (
            <Card key={j.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-medium"><BilingualText row={j as any} base="name" /></div>
                    <div className="text-xs text-muted-foreground">
                      {dept ? <BilingualText row={dept as any} base="name" /> : "—"}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove(j.id)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                </div>
                <BilingualInputs
                  valueAr={(j as any).name_ar ?? ""}
                  valueEn={(j as any).name_en ?? ""}
                  onChangeAr={(v) => renameJob(j.id, v, (j as any).name_en ?? "")}
                  onChangeEn={(v) => renameJob(j.id, (j as any).name_ar ?? "", v)}
                  maxLength={120}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

