import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Building2, Briefcase, User, Shield, Search, History, PlusCircle, MinusCircle, Loader2, Check, RefreshCw } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { usePermissionAudit } from "@/modules/permissions/audit";
import {
  ALL_PERMISSIONS, PERMISSION_GROUPS, groupOf,
  grantDeptPermission, revokeDeptPermission,
  grantJobPermission, revokeJobPermission,
  type AppPermission,
} from "@/modules/permissions/api";
import { useQueryClient } from "@tanstack/react-query";
import {
  useDeptPermissions, useJobPermissions, useEffectivePermissions,
} from "@/modules/permissions/queries";
import { grantUserPermission as _u1, revokeUserPermission as _u2 } from "@/modules/hr/api";
import { PermissionDiffDialog, type DiffPreview } from "./PermissionDiffDialog";

/** Permission labels — mirrors the master list in hr.tsx */
const LABELS_AR: Partial<Record<AppPermission, string>> = {
  "customers.view": "عرض العملاء", "customers.create": "إضافة العملاء", "customers.edit": "تعديل العملاء",
  "customers.delete": "حذف العملاء", "customers.manage": "إدارة العملاء", "customers.view_payment_info": "بيانات الدفع",
  "quotes.view_own": "عروضي", "quotes.view_team": "عروض الفريق", "quotes.view_all": "كل العروض", "quotes.view": "عرض العروض",
  "quotes.create": "إنشاء عرض", "quotes.edit": "تعديل عرض", "quotes.delete": "حذف عرض", "quotes.assign": "إسناد عرض",
  "quotes.manage": "إدارة العروض", "quotes.approve": "اعتماد العروض",
  "workflows.view": "عرض التدفقات", "workflows.manage": "إدارة التدفقات",
  "hr.view": "عرض الموارد البشرية", "hr.manage": "إدارة الموارد البشرية",
  "warehouses.view": "عرض المخازن", "warehouses.manage": "إدارة المخازن", "bins.manage": "إدارة المواقع",
  "inventory.view": "عرض المخزون", "inventory.manage": "إدارة المخزون", "inventory.transfer": "تحويل المخزون",
  "inventory.transfer.create": "إنشاء تحويل", "inventory.transfer.post": "ترحيل تحويل", "inventory.transfer.cancel": "إلغاء تحويل",
  "inventory.adjust.create": "تسوية مخزون", "inventory.adjust.approve": "اعتماد التسوية",
  "approvals.view": "عرض الاعتمادات", "approvals.decide": "البت في الاعتمادات",
  "team.view": "عرض الفريق", "team.manage": "إدارة الفريق",
  "users.manage_roles": "إدارة الأدوار", "templates.manage": "إدارة القوالب",
  "notifications.view": "الإشعارات", "reports.view": "التقارير",
  "manage_customer_fields": "حقول العملاء", "manage_form_fields": "حقول النماذج",
};

type Scope =
  | { kind: "department"; id: string; name: string }
  | { kind: "job_title"; id: string; name: string }
  | { kind: "user"; id: string; name: string };

export function PermissionMatrix({
  open, onOpenChange, scope,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  scope: Scope | null;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState<AppPermission | null>(null);
  const [preview, setPreview] = useState<DiffPreview | null>(null);

  const isDept = scope?.kind === "department";
  const isJob = scope?.kind === "job_title";
  const isUser = scope?.kind === "user";

  const deptQ = useDeptPermissions(isDept ? scope!.id : null);
  const jobQ  = useJobPermissions(isJob ? scope!.id : null);
  const effQ  = useEffectivePermissions(isUser ? scope!.id : null);

  const ownSet = useMemo(() => {
    if (isDept) return new Set(deptQ.data ?? []);
    if (isJob)  return new Set(jobQ.data ?? []);
    if (isUser) return effQ.data?.own ?? new Set<AppPermission>();
    return new Set<AppPermission>();
  }, [isDept, isJob, isUser, deptQ.data, jobQ.data, effQ.data]);

  const inheritedDept = isUser ? (effQ.data?.fromDept ?? new Set<AppPermission>()) : new Set<AppPermission>();
  const inheritedJob  = isUser ? (effQ.data?.fromJob  ?? new Set<AppPermission>()) : new Set<AppPermission>();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ALL_PERMISSIONS.filter((p) => {
      if (!needle) return true;
      return p.toLowerCase().includes(needle) || (LABELS_AR[p] ?? "").toLowerCase().includes(needle);
    });
  }, [q]);

  const groups = useMemo(() => {
    const map = new Map<string, AppPermission[]>();
    filtered.forEach((p) => {
      const g = groupOf(p);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(p);
    });
    return PERMISSION_GROUPS.filter((g) => map.has(g.key)).map((g) => ({ ...g, perms: map.get(g.key)! }));
  }, [filtered]);

  function requestToggle(perm: AppPermission, next: boolean) {
    if (!scope) return;
    // Build before/after effective inputs based on scope kind.
    const personalBefore = isUser ? [...(effQ.data?.own ?? [])] : [];
    const jobBefore = isUser ? [...(effQ.data?.fromJob ?? [])] : [];
    const deptBefore = isUser ? [...(effQ.data?.fromDept ?? [])] : [];

    let before, after;
    if (scope.kind === "user") {
      const pNext = next
        ? Array.from(new Set([...personalBefore, perm]))
        : personalBefore.filter((p) => p !== perm);
      before = { personal: personalBefore, job: jobBefore, department: deptBefore };
      after  = { personal: pNext,          job: jobBefore, department: deptBefore };
    } else if (scope.kind === "department") {
      const dBefore = [...(deptQ.data ?? [])];
      const dAfter = next
        ? Array.from(new Set([...dBefore, perm]))
        : dBefore.filter((p) => p !== perm);
      before = { department: dBefore };
      after  = { department: dAfter };
    } else {
      const jBefore = [...(jobQ.data ?? [])];
      const jAfter = next
        ? Array.from(new Set([...jBefore, perm]))
        : jBefore.filter((p) => p !== perm);
      before = { job: jBefore };
      after  = { job: jAfter };
    }

    setPreview({
      perm,
      label: (ar ? (LABELS_AR[perm] || perm) : perm) as string,
      next,
      scope: scope.kind,
      before,
      after,
    });
  }

  async function confirmToggle() {
    if (!scope || !preview) return;
    const perm = preview.perm;
    const next = preview.next;
    setSaving(perm);
    try {
      if (scope.kind === "department") {
        if (next) await grantDeptPermission(scope.id, perm);
        else await revokeDeptPermission(scope.id, perm);
        qc.invalidateQueries({ queryKey: ["perms", "dept", scope.id] });
      } else if (scope.kind === "job_title") {
        if (next) await grantJobPermission(scope.id, perm);
        else await revokeJobPermission(scope.id, perm);
        qc.invalidateQueries({ queryKey: ["perms", "job", scope.id] });
      } else {
        if (next) await _u1(scope.id, perm);
        else await _u2(scope.id, perm);
        qc.invalidateQueries({ queryKey: ["perms", "effective", scope.id] });
        qc.invalidateQueries({ queryKey: ["hr"] });
      }
      qc.invalidateQueries({ queryKey: ["perm-audit", scope.kind, scope.id] });
      setPreview(null);
    } catch (e: any) {
      toast.error(ar ? "تعذر الحفظ" : "Failed", { description: e?.message });
    } finally {
      setSaving(null);
    }
  }

  if (!scope) return null;
  const ScopeIcon = scope.kind === "department" ? Building2 : scope.kind === "job_title" ? Briefcase : User;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScopeIcon className="h-5 w-5 text-primary" />
            {ar ? "الصلاحيات" : "Permissions"} — {scope.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isUser
              ? (ar
                  ? "الصلاحيات النهائية = صلاحيات الإدارة + صلاحيات المسمى الوظيفي + الصلاحيات الشخصية."
                  : "Effective permissions = Department + Job Title + Personal overrides.")
              : (ar
                  ? "أي مستخدم مرتبط بهذا العنصر سيرث الصلاحيات المفعّلة هنا."
                  : "Any user linked to this element inherits enabled permissions from here.")}
          </DialogDescription>
        </DialogHeader>

        {isUser && (
          <div className="flex flex-wrap gap-2 text-xs -mt-1">
            {effQ.data?.deptName && (
              <Badge variant="outline" className="gap-1"><Building2 className="h-3 w-3" />{effQ.data.deptName}</Badge>
            )}
            {effQ.data?.jobName && (
              <Badge variant="outline" className="gap-1"><Briefcase className="h-3 w-3" />{effQ.data.jobName}</Badge>
            )}
            {!effQ.data?.deptName && !effQ.data?.jobName && (
              <span className="text-muted-foreground">
                {ar ? "لا توجد إدارة أو مسمى وظيفي مربوط بهذا المستخدم." : "No department or job title linked to this user."}
              </span>
            )}
          </div>
        )}

        <Tabs defaultValue="perms" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="perms" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" />{ar ? "الصلاحيات" : "Permissions"}
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5">
              <History className="h-3.5 w-3.5" />{ar ? "سجل التغييرات" : "Audit log"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="perms" className="flex-1 flex flex-col min-h-0 mt-3 space-y-3">
            <div className="relative">
              <Search className="absolute start-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder={ar ? "بحث عن صلاحية..." : "Search permissions..."}
                className="ps-8 h-9"
              />
            </div>
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 py-2">
                {groups.map((g) => (
                  <div key={g.key} className="rounded-lg border">
                    <div className="px-3 py-2 bg-muted/40 border-b flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-primary" />
                      <div className="text-sm font-semibold">{ar ? g.ar : g.en}</div>
                      <Badge variant="secondary" className="ms-auto text-[10px]">{g.perms.length}</Badge>
                    </div>
                    <div className="divide-y">
                      {g.perms.map((p) => {
                        const fromDept = inheritedDept.has(p);
                        const fromJob  = inheritedJob.has(p);
                        const own = ownSet.has(p);
                        const effective = own || fromDept || fromJob;
                        return (
                          <label
                            key={p}
                            className={`flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer ${saving === p ? "opacity-50" : ""}`}
                          >
                            <Checkbox
                              checked={own}
                              disabled={saving === p}
                              onCheckedChange={(v) => requestToggle(p, Boolean(v))}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm">{ar ? (LABELS_AR[p] || p) : p}</div>
                              <div className="text-[10px] font-mono text-muted-foreground truncate">{p}</div>
                            </div>
                            <div className="flex items-center gap-1 flex-wrap justify-end">
                              {isUser && fromDept && (
                                <Badge variant="outline" className="gap-1 text-[10px]">
                                  <Building2 className="h-2.5 w-2.5" />{ar ? "من الإدارة" : "Dept"}
                                </Badge>
                              )}
                              {isUser && fromJob && (
                                <Badge variant="outline" className="gap-1 text-[10px]">
                                  <Briefcase className="h-2.5 w-2.5" />{ar ? "من المسمى" : "Job"}
                                </Badge>
                              )}
                              {isUser && own && (
                                <Badge className="gap-1 text-[10px]">
                                  <User className="h-2.5 w-2.5" />{ar ? "شخصية" : "Personal"}
                                </Badge>
                              )}
                              {isUser && effective && !own && !fromDept && !fromJob && (
                                <Badge variant="secondary" className="text-[10px]">{ar ? "فعّالة" : "Effective"}</Badge>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {groups.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    {ar ? "لا توجد نتائج" : "No matches"}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="audit" className="flex-1 min-h-0 mt-3">
            <AuditPanel scope={scope.kind} targetId={scope.id} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {ar ? "إغلاق" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
      <PermissionDiffDialog
        open={!!preview}
        onOpenChange={(o) => { if (!o) setPreview(null); }}
        preview={preview}
        onConfirm={confirmToggle}
        saving={!!saving}
      />
    </Dialog>
  );
}

/* ─── Audit log panel ───────────────────────────────────────────── */

function AuditPanel({
  scope, targetId,
}: { scope: "department" | "job_title" | "user"; targetId: string }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const q = usePermissionAudit(scope, targetId);
  const fmt = new Intl.DateTimeFormat(ar ? "ar-EG" : "en-US", {
    dateStyle: "medium", timeStyle: "short",
  });

  if (q.isLoading) {
    return <div className="py-6 text-center text-sm text-muted-foreground">{ar ? "جاري التحميل..." : "Loading..."}</div>;
  }
  if (q.error) {
    return (
      <div className="py-6 text-center text-sm text-destructive">
        {ar ? "تعذر تحميل السجل (تحتاج صلاحية مسؤول)." : "Cannot load audit log (admin permission required)."}
      </div>
    );
  }
  const entries = q.data ?? [];
  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        {ar ? "لا توجد تغييرات مسجلة بعد." : "No changes recorded yet."}
      </div>
    );
  }

  return (
    <ScrollArea className="h-[55vh] -mx-6 px-6">
      <ul className="divide-y">
        {entries.map((e) => (
          <li key={e.id} className="py-2.5 flex items-start gap-3">
            {e.action === "grant" ? (
              <PlusCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <MinusCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[11px] rounded bg-muted px-1.5 py-0.5">{e.permission}</span>
                <span className="text-muted-foreground">
                  {e.action === "grant" ? (ar ? "تم منح" : "granted") : (ar ? "تم إلغاء" : "revoked")}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {ar ? "بواسطة" : "by"} {" "}
                <span className="font-medium">{e.actor_name || e.actor_email || (ar ? "نظام" : "system")}</span>
                {" · "}
                {fmt.format(new Date(e.created_at))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}
