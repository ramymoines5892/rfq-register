import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { ScriptInput } from "@/components/ScriptInput";
import { useI18n } from "@/lib/i18n";
import { useUpsertPartner } from "@/modules/partners/queries";
import type { PartnerRole } from "@/modules/partners/api";

/**
 * inFlow-style quick create: only a name is required.
 * Everything else (code, status, roles, financials) is defaulted or filled later
 * on the partner detail page.
 */
export function QuickCreatePartner({
  open, onClose, role, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  role: PartnerRole;
  onCreated: (id: string) => void;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const upsert = useUpsertPartner();
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (open) { setNameAr(""); setNameEn(""); setMobile(""); setEmail(""); }
  }, [open]);

  const name = (ar ? nameAr : nameEn).trim() || nameAr.trim() || nameEn.trim();
  const emailOk = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSave = name.length > 0 && name.length <= 200 && emailOk && !upsert.isPending;

  async function save(openDetail: boolean) {
    if (!canSave) return;
    try {
      const saved = await upsert.mutateAsync({
        name_ar: nameAr.trim() || null,
        name_en: nameEn.trim() || null,
        mobile: mobile.trim() || null,
        email: email.trim() || null,
        status: "active",
        currency: "EGP",
        roles: [role],
      } as any);
      toast.success(ar ? "تم الإنشاء" : "Created");
      if (openDetail) onCreated(saved.id);
      else onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  const title = role === "supplier"
    ? (ar ? "مورد جديد" : "New Supplier")
    : (ar ? "عميل جديد" : "New Customer");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {ar
              ? "الاسم فقط مطلوب — باقي البيانات تقدر تكملها بعدين."
              : "Only a name is required — you can fill in the rest later."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{ar ? "الاسم (عربي)" : "Name (Arabic)"} *</Label>
            <ScriptInput script="ar" value={nameAr} onValueChange={setNameAr} maxLength={200} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>{ar ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
            <ScriptInput script="en" value={nameEn} onValueChange={setNameEn} maxLength={200} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{ar ? "موبايل" : "Mobile"}</Label>
              <Input value={mobile} onChange={(e) => setMobile(e.target.value)} maxLength={30} inputMode="tel" />
            </div>
            <div className="space-y-1.5">
              <Label>{ar ? "بريد إلكتروني" : "Email"}</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                type="email"
                aria-invalid={!emailOk}
              />
              {!emailOk && (
                <p className="text-xs text-destructive">{ar ? "بريد غير صالح" : "Invalid email"}</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="ghost" onClick={onClose}>{ar ? "إلغاء" : "Cancel"}</Button>
          <Button variant="outline" disabled={!canSave} onClick={() => save(false)}>
            {ar ? "حفظ" : "Save"}
          </Button>
          <Button disabled={!canSave} onClick={() => save(true)}>
            {ar ? "حفظ وفتح التفاصيل" : "Save & open details"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
