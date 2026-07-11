import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Building2, Briefcase, Trash2, UserCheck, Users, Plus, Ban, Play } from "lucide-react";
import { useI18n } from "@/lib/i18n";
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

function HrPage() {
  const { t, lang } = useI18n();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<{ user_id: string; role: AppRole }[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string>("");
  const [permDialog, setPermDialog] = useState<Profile | null>(null);

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
    setLoading(false);
  }

  const pending = useMemo(() => profiles.filter((p) => p.status === "pending"), [profiles]);
  const active = useMemo(() => profiles.filter((p) => p.status !== "pending"), [profiles]);
  const roleOf = (uid: string): AppRole | null =>
    roles.find((r) => r.user_id === uid && r.role === "owner")?.role
    ?? roles.find((r) => r.user_id === uid && r.role === "admin")?.role
    ?? roles.find((r) => r.user_id === uid)?.role
    ?? null;

  async function approve(userId: string) {
    const { error: e1 } = await supabase.from("profiles").update({ status: "active" }).eq("id", userId);
    if (e1) { toast.error(e1.message); return; }
    // Give a default member role
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

  async function changeRole(userId: string, newRole: AppRole) {
    const existing = roles.filter((r) => r.user_id === userId);
    for (const r of existing) {
      if (r.role !== newRole) await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", r.role);
    }
    if (!existing.some((r) => r.role === newRole)) {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
      if (error) { toast.error(error.message); return; }
    }
    toast.success(t("saved"));
    load();
  }

  async function updateProfileField(userId: string, patch: Partial<Profile>) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (error) { toast.error(error.message); return; }
    load();
  }

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
          <Tabs defaultValue={pending.length > 0 ? "pending" : "users"}>
            <TabsList>
              <TabsTrigger value="pending" className="gap-1">
                <UserCheck className="h-4 w-4" /> {t("pendingUsers")}
                {pending.length > 0 && <Badge variant="destructive" className="ms-1">{pending.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-1"><Users className="h-4 w-4" /> {t("activeUsers")}</TabsTrigger>
              <TabsTrigger value="departments" className="gap-1"><Building2 className="h-4 w-4" /> {t("departments")}</TabsTrigger>
              <TabsTrigger value="jobs" className="gap-1"><Briefcase className="h-4 w-4" /> {t("jobTitles")}</TabsTrigger>
            </TabsList>

            {/* Pending users */}
            <TabsContent value="pending" className="mt-4 space-y-2">
              {pending.length === 0 && <Card><CardContent className="py-8 text-center text-muted-foreground">{t("noPendingUsers")}</CardContent></Card>}
              {pending.map((p) => (
                <Card key={p.id}>
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.full_name || p.email}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                    </div>
                    <Button size="sm" onClick={() => approve(p.id)}>
                      <UserCheck className="h-4 w-4 me-1" /> {t("approveUser")}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Active users */}
            <TabsContent value="users" className="mt-4 space-y-2">
              {active.map((p) => {
                const role = roleOf(p.id);
                const isSelf = p.id === me;
                return (
                  <Card key={p.id}>
                    <CardContent className="p-4 grid gap-3 md:grid-cols-6 items-center">
                      <div className="md:col-span-2 min-w-0">
                        <div className="font-medium truncate">{p.full_name || p.email}</div>
                        <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                        <div className="mt-1 flex gap-1 flex-wrap">
                          {role && <Badge variant={role === "owner" ? "default" : "secondary"}>{lang === "ar" ? (role === "owner" ? "المالك" : role === "admin" ? "مسؤول" : "عضو") : role}</Badge>}
                          {p.status === "suspended" && <Badge variant="destructive">Suspended</Badge>}
                        </div>
                      </div>

                      <Select value={p.department_id ?? "none"} onValueChange={(v) => updateProfileField(p.id, { department_id: v === "none" ? null : v })}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={t("department")} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("none")}</SelectItem>
                          {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>

                      <Select value={p.job_title_id ?? "none"} onValueChange={(v) => updateProfileField(p.id, { job_title_id: v === "none" ? null : v })}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={t("jobTitle")} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("none")}</SelectItem>
                          {jobTitles.map((j) => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
                        </SelectContent>
                      </Select>

                      <Select value={p.manager_id ?? "none"} onValueChange={(v) => updateProfileField(p.id, { manager_id: v === "none" ? null : v })}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={t("directManager")} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("none")}</SelectItem>
                          {active.filter((a) => a.id !== p.id).map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>)}
                        </SelectContent>
                      </Select>

                      <div className="flex items-center gap-1 justify-end">
                        {role && role !== "owner" && !isSelf && (
                          <Select value={role} onValueChange={(v) => changeRole(p.id, v as AppRole)}>
                            <SelectTrigger className="h-9 w-24 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">{t("roleAdmin")}</SelectItem>
                              <SelectItem value="member">{t("roleMember")}</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <Button variant="outline" size="sm" onClick={() => setPermDialog(p)}>{t("permissions")}</Button>
                        {!isSelf && role !== "owner" && (
                          p.status === "active"
                            ? <Button variant="ghost" size="icon" title={t("suspendUser")} onClick={() => setStatus(p.id, "suspended")}><Ban className="h-4 w-4 text-rose-600" /></Button>
                            : <Button variant="ghost" size="icon" title={t("activate")} onClick={() => setStatus(p.id, "active")}><Play className="h-4 w-4 text-emerald-600" /></Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            {/* Departments */}
            <TabsContent value="departments" className="mt-4">
              <DepartmentsTab departments={departments} profiles={active} onChanged={load} />
            </TabsContent>

            {/* Job titles */}
            <TabsContent value="jobs" className="mt-4">
              <JobTitlesTab jobTitles={jobTitles} departments={departments} onChanged={load} />
            </TabsContent>
          </Tabs>
        )}
      </main>

      <PermissionsDialog user={permDialog} onClose={() => { setPermDialog(null); load(); }} />
    </div>
  );
}

function DepartmentsTab({ departments, profiles, onChanged }: { departments: Department[]; profiles: Profile[]; onChanged: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [managerId, setManagerId] = useState<string>("none");

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase.from("departments").insert({ name: name.trim(), manager_id: managerId === "none" ? null : managerId });
    if (error) { toast.error(error.message); return; }
    setName(""); setManagerId("none");
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

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <Input placeholder={t("departmentName")} value={name} onChange={(e) => setName(e.target.value)} />
          <Select value={managerId} onValueChange={setManagerId}>
            <SelectTrigger><SelectValue placeholder={t("departmentManager")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("none")}</SelectItem>
              {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={add}><Plus className="h-4 w-4 me-1" />{t("addDepartment")}</Button>
        </CardContent>
      </Card>
      <div className="grid gap-2">
        {departments.map((d) => (
          <Card key={d.id}>
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="font-medium">{d.name}</div>
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function JobTitlesTab({ jobTitles, departments, onChanged }: { jobTitles: JobTitle[]; departments: Department[]; onChanged: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [depId, setDepId] = useState<string>("none");

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase.from("job_titles").insert({ name: name.trim(), department_id: depId === "none" ? null : depId });
    if (error) { toast.error(error.message); return; }
    setName(""); setDepId("none");
    toast.success(t("saved"));
    onChanged();
  }
  async function remove(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    const { error } = await supabase.from("job_titles").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    onChanged();
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <Input placeholder={t("jobTitleName")} value={name} onChange={(e) => setName(e.target.value)} />
          <Select value={depId} onValueChange={setDepId}>
            <SelectTrigger><SelectValue placeholder={t("department")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("none")}</SelectItem>
              {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={add}><Plus className="h-4 w-4 me-1" />{t("addJobTitle")}</Button>
        </CardContent>
      </Card>
      <div className="grid gap-2">
        {jobTitles.map((j) => (
          <Card key={j.id}>
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{j.name}</div>
                <div className="text-xs text-muted-foreground">{departments.find((d) => d.id === j.department_id)?.name ?? "—"}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(j.id)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PermissionsDialog({ user, onClose }: { user: Profile | null; onClose: () => void }) {
  const { t, lang } = useI18n();
  const [granted, setGranted] = useState<Set<AppPermission>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase.from("user_permissions").select("permission").eq("user_id", user.id).then(({ data }) => {
      setGranted(new Set((data ?? []).map((r) => r.permission as AppPermission)));
      setLoading(false);
    });
  }, [user]);

  async function toggle(p: AppPermission, checked: boolean) {
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
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("permissions")} — {user?.full_name || user?.email}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-6 text-center text-muted-foreground">{t("loading")}</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 py-2 max-h-[60vh] overflow-auto">
            {ALL_PERMISSIONS.map((p) => (
              <label key={p} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer text-sm">
                <Checkbox checked={granted.has(p)} onCheckedChange={(c) => toggle(p, !!c)} />
                <span>{lang === "ar" ? permLabelAr[p] : p}</span>
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
