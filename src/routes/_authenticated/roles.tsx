import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useRoles, useCreateRole, useUpdateRole, useDeleteRole,
  useRolePermissions, useSetRolePermissions,
  useRoleAssignments, useAddAssignment, useRemoveAssignment,
} from "@/modules/roles/queries";
import type { CustomRole, RoleScope } from "@/modules/roles/api";
import { ALL_PERMISSIONS, PERMISSION_GROUPS, groupOf, type AppPermission } from "@/modules/permissions/api";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Shield, Plus, Search, Trash2, Building2, Briefcase, User as UserIcon, MapPin, X, ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/roles")({
  component: RolesPage,
  head: () => ({ meta: [{ title: "الأدوار والصلاحيات | Roles & Permissions" }] }),
});

const SCOPE_META: Record<RoleScope, { ar: string; en: string; icon: typeof Building2 }> = {
  department: { ar: "إدارة", en: "Department", icon: Building2 },
  job_title: { ar: "وظيفة", en: "Job Title", icon: Briefcase },
  branch: { ar: "فرع", en: "Branch", icon: MapPin },
  user: { ar: "مستخدم", en: "User", icon: UserIcon },
};

function RolesPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const rolesQ = useRoles();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<CustomRole | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const list = rolesQ.data ?? [];
    if (!q.trim()) return list;
    const s = q.toLowerCase();
    return list.filter((r) =>
      (r.name_ar ?? "").toLowerCase().includes(s) ||
      (r.name_en ?? "").toLowerCase().includes(s) ||
      (r.code ?? "").toLowerCase().includes(s),
    );
  }, [rolesQ.data, q]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/hr"><ArrowLeft className="w-4 h-4 me-1" />{ar ? "المستخدمون" : "Users"}</Link>
        </Button>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-xl md:text-2xl font-bold">{ar ? "الأدوار والصلاحيات" : "Roles & Permissions"}</h1>
        </div>
        <div className="ms-auto flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute inset-y-0 my-auto start-2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={ar ? "بحث..." : "Search..."}
              className="ps-8 h-9 w-56"
            />
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 me-1" />{ar ? "دور جديد" : "New Role"}
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {ar
          ? "أنشئ أدوارًا (باقات صلاحيات) وأسندها لإدارة، وظيفة، فرع، أو مستخدم مباشرة."
          : "Create roles (permission bundles) and assign them to a department, job title, branch, or user."}
      </p>

      {rolesQ.isLoading ? (
        <div className="text-center py-12 text-muted-foreground">{ar ? "جارٍ التحميل..." : "Loading..."}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
          {ar ? "لا توجد أدوار بعد. أنشئ أول دور." : "No roles yet. Create your first role."}
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((role) => (
            <RoleCard key={role.id} role={role} onOpen={() => setSelected(role)} />
          ))}
        </div>
      )}

      <RoleCreateDialog open={createOpen} onOpenChange={setCreateOpen} />

      <RoleEditor role={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}

function RoleCard({ role, onOpen }: { role: CustomRole; onOpen: () => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const permsQ = useRolePermissions(role.id);
  const assignsQ = useRoleAssignments(role.id);
  const counts = useMemo(() => {
    const map = new Map<RoleScope, number>();
    (assignsQ.data ?? []).forEach((a) => map.set(a.scope, (map.get(a.scope) ?? 0) + 1));
    return map;
  }, [assignsQ.data]);

  return (
    <Card className="hover:border-primary cursor-pointer transition" onClick={onOpen}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
            style={{ background: role.color ?? "hsl(var(--primary))" }}
          >
            <Shield className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate">{ar ? role.name_ar : (role.name_en || role.name_ar)}</div>
            {role.code && <div className="text-xs text-muted-foreground">{role.code}</div>}
          </div>
        </div>
        {role.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{role.description}</p>
        )}
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Badge variant="secondary">{permsQ.data?.length ?? 0} {ar ? "صلاحية" : "perms"}</Badge>
          {(["department", "job_title", "branch", "user"] as RoleScope[]).map((s) => {
            const n = counts.get(s) ?? 0;
            if (!n) return null;
            const Icon = SCOPE_META[s].icon;
            return (
              <Badge key={s} variant="outline" className="gap-1">
                <Icon className="w-3 h-3" />{n}
              </Badge>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Create dialog ─── */
function RoleCreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const create = useCreateRole();
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [code, setCode] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [desc, setDesc] = useState("");

  function submit() {
    if (!nameAr.trim()) { toast.error(ar ? "الاسم بالعربية مطلوب" : "Arabic name required"); return; }
    create.mutate(
      { name_ar: nameAr.trim(), name_en: nameEn.trim() || null, code: code.trim() || null, color, description: desc.trim() || null },
      {
        onSuccess: () => {
          toast.success(ar ? "تم إنشاء الدور" : "Role created");
          setNameAr(""); setNameEn(""); setCode(""); setDesc(""); setColor("#3b82f6");
          onOpenChange(false);
        },
        onError: (e: unknown) => toast.error((e as Error).message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{ar ? "دور جديد" : "New Role"}</DialogTitle>
          <DialogDescription>
            {ar ? "أنشئ دورًا ثم حدّد صلاحياته وإسناداته." : "Create a role, then set its permissions and assignments."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{ar ? "الاسم (عربي) *" : "Name (Arabic) *"}</Label>
              <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} autoFocus />
            </div>
            <div>
              <Label>{ar ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
              <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            </div>
            <div>
              <Label>{ar ? "الكود" : "Code"}</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="SALES_MGR" />
            </div>
            <div>
              <Label>{ar ? "اللون" : "Color"}</Label>
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 p-1" />
            </div>
          </div>
          <div>
            <Label>{ar ? "الوصف" : "Description"}</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{ar ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={submit} disabled={create.isPending}>
            {ar ? "حفظ" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Editor sheet ─── */
function RoleEditor({ role, onOpenChange }: { role: CustomRole | null; onOpenChange: (o: boolean) => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const del = useDeleteRole();
  const update = useUpdateRole();

  if (!role) return null;

  return (
    <Sheet open={!!role} onOpenChange={onOpenChange}>
      <SheetContent side={ar ? "left" : "right"} className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center text-white"
              style={{ background: role.color ?? "hsl(var(--primary))" }}
            >
              <Shield className="w-4 h-4" />
            </div>
            {ar ? role.name_ar : (role.name_en || role.name_ar)}
          </SheetTitle>
          <SheetDescription>
            {ar ? "حرّر بيانات الدور، صلاحياته، وأين يُطبَّق." : "Edit role details, permissions, and where it applies."}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="perms" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="perms" className="flex-1">{ar ? "الصلاحيات" : "Permissions"}</TabsTrigger>
            <TabsTrigger value="assign" className="flex-1">{ar ? "الإسناد" : "Assignments"}</TabsTrigger>
            <TabsTrigger value="info" className="flex-1">{ar ? "البيانات" : "Details"}</TabsTrigger>
          </TabsList>

          <TabsContent value="perms" className="mt-4">
            <RolePermissionsEditor roleId={role.id} />
          </TabsContent>
          <TabsContent value="assign" className="mt-4">
            <RoleAssignmentsEditor roleId={role.id} />
          </TabsContent>
          <TabsContent value="info" className="mt-4">
            <RoleInfoEditor role={role} onSave={(patch) => update.mutate({ id: role.id, patch })} />
          </TabsContent>
        </Tabs>

        <SheetFooter className="mt-6 sm:justify-between">
          <Button
            variant="destructive"
            onClick={() => {
              if (!confirm(ar ? "حذف الدور نهائيًا؟" : "Delete this role?")) return;
              del.mutate(role.id, {
                onSuccess: () => { toast.success(ar ? "تم الحذف" : "Deleted"); onOpenChange(false); },
                onError: (e: unknown) => toast.error((e as Error).message),
              });
            }}
          >
            <Trash2 className="w-4 h-4 me-1" />{ar ? "حذف" : "Delete"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{ar ? "إغلاق" : "Close"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function RoleInfoEditor({ role, onSave }: { role: CustomRole; onSave: (p: Partial<CustomRole>) => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [nameAr, setNameAr] = useState(role.name_ar);
  const [nameEn, setNameEn] = useState(role.name_en ?? "");
  const [code, setCode] = useState(role.code ?? "");
  const [color, setColor] = useState(role.color ?? "#3b82f6");
  const [desc, setDesc] = useState(role.description ?? "");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>{ar ? "الاسم (عربي)" : "Name (AR)"}</Label><Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} /></div>
        <div><Label>{ar ? "الاسم (إنجليزي)" : "Name (EN)"}</Label><Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} /></div>
        <div><Label>{ar ? "الكود" : "Code"}</Label><Input value={code} onChange={(e) => setCode(e.target.value)} /></div>
        <div><Label>{ar ? "اللون" : "Color"}</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 p-1" /></div>
      </div>
      <div><Label>{ar ? "الوصف" : "Description"}</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} /></div>
      <Button
        onClick={() => {
          onSave({ name_ar: nameAr, name_en: nameEn || null, code: code || null, color, description: desc || null });
          toast.success(ar ? "تم الحفظ" : "Saved");
        }}
      >
        {ar ? "حفظ التغييرات" : "Save changes"}
      </Button>
    </div>
  );
}

/* ─── Permissions editor ─── */
function RolePermissionsEditor({ roleId }: { roleId: string }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const permsQ = useRolePermissions(roleId);
  const setPerms = useSetRolePermissions();
  const current = new Set(permsQ.data ?? []);
  const [dirty, setDirty] = useState<Set<AppPermission> | null>(null);
  const active = dirty ?? current;

  const grouped = useMemo(() => {
    const out = new Map<string, AppPermission[]>();
    ALL_PERMISSIONS.forEach((p) => {
      const g = groupOf(p);
      if (!out.has(g)) out.set(g, []);
      out.get(g)!.push(p);
    });
    return out;
  }, []);

  function toggle(p: AppPermission) {
    const next = new Set(active);
    if (next.has(p)) next.delete(p); else next.add(p);
    setDirty(next);
  }

  function toggleGroup(perms: AppPermission[]) {
    const next = new Set(active);
    const allSet = perms.every((p) => next.has(p));
    perms.forEach((p) => { if (allSet) next.delete(p); else next.add(p); });
    setDirty(next);
  }

  function save() {
    setPerms.mutate(
      { roleId, perms: Array.from(active) },
      {
        onSuccess: () => { toast.success(ar ? "تم حفظ الصلاحيات" : "Permissions saved"); setDirty(null); },
        onError: (e: unknown) => toast.error((e as Error).message),
      },
    );
  }

  const isDirty = dirty !== null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {active.size} {ar ? "صلاحية محددة" : "selected"}
        </div>
        <Button size="sm" disabled={!isDirty || setPerms.isPending} onClick={save}>
          {ar ? "حفظ" : "Save"}
        </Button>
      </div>
      <ScrollArea className="h-[50vh] pr-2">
        <div className="space-y-4">
          {PERMISSION_GROUPS.map((g) => {
            const perms = grouped.get(g.key) ?? [];
            if (!perms.length) return null;
            const allSet = perms.every((p) => active.has(p));
            const someSet = perms.some((p) => active.has(p));
            return (
              <div key={g.key} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm">{ar ? g.ar : g.en}</div>
                  <Button size="sm" variant="ghost" onClick={() => toggleGroup(perms)}>
                    {allSet ? (ar ? "إلغاء الكل" : "Clear all") : someSet ? (ar ? "تحديد الكل" : "Select all") : (ar ? "تحديد الكل" : "Select all")}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {perms.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-muted/50 cursor-pointer">
                      <Checkbox checked={active.has(p)} onCheckedChange={() => toggle(p)} />
                      <span className="font-mono">{p}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ─── Assignments editor ─── */
function RoleAssignmentsEditor({ roleId }: { roleId: string }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const assignsQ = useRoleAssignments(roleId);
  const add = useAddAssignment();
  const remove = useRemoveAssignment();
  const [scope, setScope] = useState<RoleScope>("department");
  const [targetId, setTargetId] = useState<string>("");

  const targetsQ = useQuery({
    queryKey: ["role-scope-targets", scope],
    queryFn: async () => {
      if (scope === "department") {
        const { data } = await supabase.from("departments").select("id, name, name_ar, name_en").is("deleted_at", null).order("name");
        return (data ?? []).map((r) => ({ id: r.id, label: ar ? (r.name_ar || r.name) : (r.name_en || r.name) }));
      }
      if (scope === "job_title") {
        const { data } = await supabase.from("job_titles").select("id, name, name_ar, name_en").is("deleted_at", null).order("name");
        return (data ?? []).map((r) => ({ id: r.id, label: ar ? (r.name_ar || r.name) : (r.name_en || r.name) }));
      }
      if (scope === "branch") {
        const { data } = await supabase.from("branches").select("id, name, name_ar").eq("is_active", true).order("name");
        return (data ?? []).map((r) => ({ id: r.id, label: ar ? (r.name_ar || r.name) : r.name }));
      }
      const { data } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      return (data ?? []).map((r) => ({ id: r.id, label: r.full_name ? `${r.full_name} · ${r.email}` : r.email }));
    },
  });

  const targetMap = useMemo(() => {
    const m = new Map<string, string>();
    (targetsQ.data ?? []).forEach((t) => m.set(t.id, t.label));
    return m;
  }, [targetsQ.data]);

  // Combined map for showing labels of existing assignments (different scopes).
  const labelsAll = useQuery({
    queryKey: ["role-assign-labels", roleId, assignsQ.data?.length ?? 0],
    enabled: !!assignsQ.data?.length,
    queryFn: async () => {
      const scopes = { department: [] as string[], job_title: [] as string[], branch: [] as string[], user: [] as string[] };
      (assignsQ.data ?? []).forEach((a) => scopes[a.scope].push(a.target_id));
      const map = new Map<string, string>();
      if (scopes.department.length) {
        const { data } = await supabase.from("departments").select("id, name, name_ar").in("id", scopes.department);
        (data ?? []).forEach((r) => map.set(`department:${r.id}`, ar ? (r.name_ar || r.name) : r.name));
      }
      if (scopes.job_title.length) {
        const { data } = await supabase.from("job_titles").select("id, name, name_ar").in("id", scopes.job_title);
        (data ?? []).forEach((r) => map.set(`job_title:${r.id}`, ar ? (r.name_ar || r.name) : r.name));
      }
      if (scopes.branch.length) {
        const { data } = await supabase.from("branches").select("id, name, name_ar").in("id", scopes.branch);
        (data ?? []).forEach((r) => map.set(`branch:${r.id}`, ar ? (r.name_ar || r.name) : r.name));
      }
      if (scopes.user.length) {
        const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", scopes.user);
        (data ?? []).forEach((r) => map.set(`user:${r.id}`, r.full_name || r.email));
      }
      return map;
    },
  });

  function submit() {
    if (!targetId) { toast.error(ar ? "اختر الهدف" : "Pick a target"); return; }
    add.mutate({ roleId, scope, targetId }, {
      onSuccess: () => { toast.success(ar ? "تمت الإضافة" : "Added"); setTargetId(""); },
      onError: (e: unknown) => toast.error((e as Error).message),
    });
  }

  const assigns = assignsQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">{ar ? "النطاق" : "Scope"}</Label>
            <Select value={scope} onValueChange={(v) => { setScope(v as RoleScope); setTargetId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SCOPE_META) as RoleScope[]).map((s) => (
                  <SelectItem key={s} value={s}>{ar ? SCOPE_META[s].ar : SCOPE_META[s].en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">{ar ? "الهدف" : "Target"}</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger><SelectValue placeholder={ar ? "اختر..." : "Choose..."} /></SelectTrigger>
              <SelectContent>
                {(targetsQ.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button size="sm" onClick={submit} disabled={add.isPending || !targetId} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 me-1" />{ar ? "إضافة إسناد" : "Add assignment"}
        </Button>
      </div>

      {assigns.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          {ar ? "لا يوجد إسناد بعد." : "No assignments yet."}
        </div>
      ) : (
        <div className="space-y-1.5">
          {assigns.map((a) => {
            const Icon = SCOPE_META[a.scope].icon;
            const label = labelsAll.data?.get(`${a.scope}:${a.target_id}`) ?? a.target_id;
            return (
              <div key={a.id} className="flex items-center gap-2 p-2 border rounded-md">
                <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Badge variant="secondary" className="flex-shrink-0">{ar ? SCOPE_META[a.scope].ar : SCOPE_META[a.scope].en}</Badge>
                <div className="flex-1 min-w-0 truncate text-sm">{label}</div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove.mutate({ id: a.id, roleId })}
                  aria-label="remove"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
