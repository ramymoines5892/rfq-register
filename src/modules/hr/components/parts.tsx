import { useMemo } from "react";
import { toast } from "sonner";
import {
  Building2, Briefcase, User as UserIcon, Shield, MoreHorizontal, KeyRound, Copy,
  ChevronRight, PlusCircle, MinusCircle, Ban, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import { pickLangValue } from "@/lib/bilingual";
import { flattenDeptsHierarchy } from "@/lib/orgTree";
import { PERMISSION_GROUPS, groupOf, type AppPermission } from "@/modules/permissions/api";
import { useGlobalPermissionAudit } from "@/modules/permissions/queries";
import { useUpdateProfile, useSetUserRole } from "@/modules/hr/queries";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Department = Database["public"]["Tables"]["departments"]["Row"];
type JobTitle = Database["public"]["Tables"]["job_titles"]["Row"];
type AppRole = Database["public"]["Enums"]["app_role"];

const TONE: Record<string, string> = {
  muted: "bg-muted/50 text-muted-foreground",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
};

export function KpiCard({ icon, label, value, tone, onClick }: {
  icon: React.ReactNode; label: string; value: number; tone: keyof typeof TONE; onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <Card className={clickable ? "cursor-pointer hover:shadow-md transition-shadow" : ""} onClick={onClick}>
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

export function EffectiveBadges({ eff, onOpen, isOwner }: {
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
  const counts = new Map<string, number>();
  eff.forEach((p) => { const g = groupOf(p); counts.set(g, (counts.get(g) ?? 0) + 1); });
  const groupsShown = PERMISSION_GROUPS.filter((g) => counts.has(g.key)).slice(0, 3);
  const extra = Math.max(0, counts.size - groupsShown.length);
  return (
    <button onClick={onOpen} className="flex flex-wrap items-center gap-1 hover:opacity-80" title={ar ? "إدارة الصلاحيات" : "Manage"}>
      <Badge variant="secondary" className="gap-1 text-[10px]"><Shield className="h-3 w-3" />{eff.size}</Badge>
      {groupsShown.map((g) => (
        <Badge key={g.key} variant="outline" className="text-[10px]">
          {ar ? g.ar : g.en} · {counts.get(g.key)}
        </Badge>
      ))}
      {extra > 0 && <Badge variant="outline" className="text-[10px]">+{extra}</Badge>}
    </button>
  );
}

export function RowMenu({
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

export function GlobalAuditPanel() {
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

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-2">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div>{children}</div>
    </div>
  );
}

export function UserDrawer({
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
    effective.forEach((p) => { const g = groupOf(p); m.set(g, (m.get(g) ?? 0) + 1); });
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
