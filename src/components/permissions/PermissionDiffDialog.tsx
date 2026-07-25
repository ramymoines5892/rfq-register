import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Building2, Briefcase, User, CheckCircle2, XCircle, ExternalLink, ShieldAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getImpact } from "@/lib/permissions/impact";
import { resolvePermission, type EffectiveInput } from "@/lib/permissions/resolve";
import type { AppPermission } from "@/modules/permissions/api";

type Scope = "department" | "job_title" | "user";

export interface DiffPreview {
  perm: AppPermission;
  label: string;
  next: boolean; // grant (true) or revoke (false)
  scope: Scope;
  /** Effective inputs BEFORE this change (used to compute before/after). */
  before: EffectiveInput;
  /** Effective inputs AFTER this change. */
  after: EffectiveInput;
  /** Optional: number of users inheriting from this dept/job. Purely informative. */
  affectedUsers?: number;
}

export function PermissionDiffDialog({
  open, onOpenChange, preview, onConfirm, saving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  preview: DiffPreview | null;
  onConfirm: () => void;
  saving?: boolean;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";

  if (!preview) return null;

  const beforeRes = resolvePermission(preview.perm, preview.before);
  const afterRes = resolvePermission(preview.perm, preview.after);
  const impacts = getImpact(preview.perm);

  const stillGrantedElsewhere =
    preview.next === false && afterRes.allowed && preview.scope === "user"
      ? afterRes.sources.filter((s) => s !== "personal")
      : [];

  const effectiveChanges = beforeRes.allowed !== afterRes.allowed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {preview.next ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            {preview.next
              ? (ar ? "منح صلاحية" : "Grant permission")
              : (ar ? "إلغاء صلاحية" : "Revoke permission")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            <span className="font-mono">{preview.perm}</span>
            {" — "}
            {preview.label}
          </DialogDescription>
        </DialogHeader>

        {/* Before → After */}
        <div className="rounded-lg border p-3 bg-muted/20">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            {ar ? "قبل / بعد" : "Before / After"}
          </div>
          <div className="flex items-center justify-between gap-2">
            <StateBox allowed={beforeRes.allowed} sources={beforeRes.sources} ar={ar} />
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <StateBox allowed={afterRes.allowed} sources={afterRes.sources} ar={ar} />
          </div>
          {!effectiveChanges && (
            <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-500 flex items-start gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0 mt-px" />
              <span>
                {ar
                  ? "لا تغيير فعلي: الصلاحية لا تزال ممنوحة من مصدر آخر."
                  : "No effective change: permission is still granted by another source."}
              </span>
            </div>
          )}
          {stillGrantedElsewhere.length > 0 && (
            <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-500">
              {ar ? "ملاحظة: المستخدم سيحتفظ بالصلاحية من: " : "Note: user retains permission via: "}
              {stillGrantedElsewhere.map((s) => (ar ? sourceAr(s) : s)).join(" + ")}
            </div>
          )}
        </div>

        {/* Impacted pages/actions */}
        <div className="rounded-lg border">
          <div className="px-3 py-2 bg-muted/40 border-b text-xs font-semibold">
            {ar ? "الصفحات والإجراءات المتأثرة" : "Impacted pages & actions"}
            <span className="text-muted-foreground font-normal ms-1.5">({impacts.length})</span>
          </div>
          <ul className="divide-y max-h-[30vh] overflow-auto">
            {impacts.length === 0 && (
              <li className="px-3 py-3 text-xs text-muted-foreground">
                {ar ? "لا توجد صفحات مرتبطة مباشرة." : "No directly linked pages."}
              </li>
            )}
            {impacts.map((i, idx) => (
              <li key={idx} className="px-3 py-2 text-sm flex items-center gap-2">
                <span className="flex-1">{ar ? i.ar : i.en}</span>
                {i.path && (
                  <Badge variant="outline" className="gap-1 text-[10px] font-mono">
                    <ExternalLink className="h-2.5 w-2.5" />{i.path}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </div>

        {typeof preview.affectedUsers === "number" && preview.scope !== "user" && (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            {ar
              ? `سيؤثر هذا التغيير على ~${preview.affectedUsers} مستخدم مرتبط.`
              : `Will affect ~${preview.affectedUsers} linked user(s).`}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={saving}
            variant={preview.next ? "default" : "destructive"}
          >
            {saving
              ? (ar ? "جاري الحفظ..." : "Saving...")
              : preview.next
                ? (ar ? "تأكيد المنح" : "Confirm grant")
                : (ar ? "تأكيد الإلغاء" : "Confirm revoke")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StateBox({ allowed, sources, ar }: { allowed: boolean; sources: string[]; ar: boolean }) {
  return (
    <div className="flex-1 rounded-md border bg-background p-2">
      <div className="flex items-center gap-1.5 text-xs font-medium">
        {allowed ? (
          <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />{ar ? "مسموح" : "Allowed"}</>
        ) : (
          <><XCircle className="h-3.5 w-3.5 text-destructive" />{ar ? "ممنوع" : "Denied"}</>
        )}
      </div>
      <div className="flex flex-wrap gap-1 mt-1.5 min-h-[18px]">
        {sources.map((s) => (
          <Badge key={s} variant="outline" className="gap-1 text-[10px]">
            {s === "department" && <Building2 className="h-2.5 w-2.5" />}
            {s === "job" && <Briefcase className="h-2.5 w-2.5" />}
            {s === "personal" && <User className="h-2.5 w-2.5" />}
            {ar ? sourceAr(s) : s}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function sourceAr(s: string): string {
  return s === "admin" ? "مسؤول"
    : s === "personal" ? "شخصية"
    : s === "job" ? "المسمى"
    : s === "department" ? "الإدارة"
    : s;
}
