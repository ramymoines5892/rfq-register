import { useState } from "react";
import { toast } from "sonner";
import { UserCheck, Building2, Briefcase, Shield } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { pickLangValue } from "@/lib/bilingual";
import { flattenDeptsHierarchy } from "@/lib/orgTree";
import { useApproveUser, useUpdateProfile, useSetUserRole } from "@/modules/hr/queries";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Department = Database["public"]["Tables"]["departments"]["Row"];
type JobTitle = Database["public"]["Tables"]["job_titles"]["Row"];
type AppRole = Database["public"]["Enums"]["app_role"];

export function ApproveRequestDialog({
  user, departments, jobTitles, onClose,
}: {
  user: Profile | null;
  departments: Department[];
  jobTitles: JobTitle[];
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [deptId, setDeptId] = useState<string>("");
  const [jobId, setJobId] = useState<string>("");
  const [role, setRole] = useState<AppRole>("member");

  const updateM = useUpdateProfile();
  const approveM = useApproveUser();
  const setRoleM = useSetUserRole();
  const busy = updateM.isPending || approveM.isPending || setRoleM.isPending;

  const open = !!user;
  const canSubmit = !!deptId && !!jobId;

  async function submit() {
    if (!user || !canSubmit) return;
    try {
      await updateM.mutateAsync({
        userId: user.id,
        patch: { department_id: deptId, job_title_id: jobId },
      });
      await approveM.mutateAsync(user.id);
      if (role !== "member") await setRoleM.mutateAsync({ userId: user.id, role });
      toast.success(ar ? "تم قبول المستخدم وتعيينه" : "User approved and assigned");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            {ar ? "قبول وتعيين المستخدم" : "Approve & Assign User"}
          </DialogTitle>
          <DialogDescription>
            {ar
              ? "يجب تعيين الإدارة والوظيفة قبل تفعيل المستخدم — الصلاحيات ستُشتقّ منهما."
              : "Assign a department and job title before activating. Permissions are inherited from them."}
          </DialogDescription>
        </DialogHeader>

        {user && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="font-medium">{user.full_name || user.email}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <Building2 className="h-3.5 w-3.5" /> {t("department")} <span className="text-destructive">*</span>
            </Label>
            <Select value={deptId} onValueChange={setDeptId}>
              <SelectTrigger className="h-9"><SelectValue placeholder={ar ? "اختر الإدارة" : "Select department"} /></SelectTrigger>
              <SelectContent>
                {flattenDeptsHierarchy(departments).map(({ dept: d, depth }) => (
                  <SelectItem key={d.id} value={d.id}>
                    <span style={{ paddingInlineStart: depth * 14 }}>
                      {depth > 0 ? "└ " : ""}{pickLangValue(d as any, "name", lang).value || d.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <Briefcase className="h-3.5 w-3.5" /> {t("jobTitle")} <span className="text-destructive">*</span>
            </Label>
            <Select value={jobId} onValueChange={setJobId}>
              <SelectTrigger className="h-9"><SelectValue placeholder={ar ? "اختر الوظيفة" : "Select job title"} /></SelectTrigger>
              <SelectContent>
                {jobTitles.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {pickLangValue(j as any, "name", lang).value || j.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <Shield className="h-3.5 w-3.5" /> {t("role")}
            </Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">{t("roleMember")}</SelectItem>
                <SelectItem value="admin">{t("roleAdmin")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {ar
                ? "الصلاحيات التفصيلية تُدار لاحقًا من مصفوفة الصلاحيات للإدارة/الوظيفة."
                : "Fine-grained permissions are managed via the department/job permission matrix."}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>{t("cancel")}</Button>
          <Button onClick={submit} disabled={!canSubmit || busy}>
            <UserCheck className="h-4 w-4 me-1" />
            {ar ? "قبول وتفعيل" : "Approve & Activate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
