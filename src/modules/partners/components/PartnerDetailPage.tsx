import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowLeft, Save, Trash2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScriptInput } from "@/components/ScriptInput";
import { useI18n } from "@/lib/i18n";
import { useConfirm } from "@/hooks/useConfirm";
import { usePartner, useUpsertPartner, useDeletePartner } from "@/modules/partners/queries";
import type { BusinessPartner, PartnerRole } from "@/modules/partners/api";
import { requiredFieldsFor, validatePartner } from "@/modules/partners/rules";
import {
  RField, ContactsPanel, AddressesPanel, BanksPanel, DocsPanel, AuditPanel,
} from "@/modules/partners/components/PartnerSheet";

export function PartnerDetailPage({
  id, role, basePath, backAr, backEn,
}: {
  id: string;
  role: PartnerRole;
  basePath: string;
  backAr: string;
  backEn: string;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const confirm = useConfirm();
  const { data: partner, isLoading } = usePartner(id);
  const upsert = useUpsertPartner();
  const del = useDeletePartner();
  const [form, setForm] = useState<Partial<BusinessPartner>>({});

  useEffect(() => { setForm({}); }, [id]);

  const merged = { ...(partner ?? {}), ...form } as BusinessPartner;
  const errors = useMemo(() => (partner ? validatePartner(merged, ar) : []), [merged, partner, ar]);
  const errorMap = useMemo(() => Object.fromEntries(errors.map((e) => [e.field, e.message])), [errors]);
  const requiredSet = useMemo(
    () => new Set(requiredFieldsFor((merged.roles ?? []) as PartnerRole[]).map((r) => String(r.field))),
    [merged.roles],
  );
  const dirty = Object.keys(form).length > 0;

  function set<K extends keyof BusinessPartner>(k: K, v: BusinessPartner[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    if (errors.length > 0) {
      toast.error(ar ? `يوجد ${errors.length} حقل مطلوب` : `${errors.length} required field(s)`);
      return;
    }
    try {
      await upsert.mutateAsync({ ...form, id });
      setForm({});
      toast.success(ar ? "تم الحفظ" : "Saved");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  async function remove() {
    const ok = await confirm({
      title: ar ? "حذف السجل؟" : "Delete record?",
      description: ar ? "لن يمكن التراجع عن هذا الإجراء." : "This action cannot be undone.",
      confirmText: ar ? "حذف" : "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await del.mutateAsync(id);
      toast.success(ar ? "تم الحذف" : "Deleted");
      window.location.href = basePath;
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">…</div>;
  if (!partner) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-muted-foreground">{ar ? "السجل غير موجود." : "Record not found."}</p>
        <Button asChild variant="outline"><Link to={basePath}>{ar ? backAr : backEn}</Link></Button>
      </div>
    );
  }

  const displayName = (ar ? merged.name_ar || merged.name_en : merged.name_en || merged.name_ar) || "—";
  const statusLabel = ar
    ? ({ active: "نشط", inactive: "متوقّف", blocked: "محظور" } as any)[merged.status ?? "active"] ?? merged.status
    : merged.status;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Button asChild variant="ghost" size="icon" className="mt-0.5">
              <Link to={basePath} aria-label={ar ? backAr : backEn}>
                {ar ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
              </Link>
            </Button>
            <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold truncate">{displayName}</h1>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                {merged.code && <Badge variant="outline" className="text-[10px]">{merged.code}</Badge>}
                <Badge variant={merged.status === "blocked" ? "destructive" : "secondary"} className="text-[10px]">{statusLabel}</Badge>
                {(merged.roles ?? []).map((r) => (
                  <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                ))}
                {errors.length > 0 && (
                  <Badge variant="destructive" className="text-[10px]">
                    {errors.length} {ar ? "تنبيه" : "issues"}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={remove}>
              <Trash2 className="h-4 w-4 me-1 text-destructive" />{ar ? "حذف" : "Delete"}
            </Button>
            <Button size="sm" onClick={save} disabled={!dirty || upsert.isPending}>
              <Save className="h-4 w-4 me-1" />{ar ? "حفظ" : "Save"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="general">
          <TabsList className="w-full grid grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="general">{ar ? "البيانات وجهات الاتصال" : "General & Contacts"}</TabsTrigger>
            <TabsTrigger value="addresses">{ar ? "العناوين والشحن" : "Addresses & Shipping"}</TabsTrigger>
            <TabsTrigger value="financial">{ar ? "الشروط المالية" : "Financial Terms"}</TabsTrigger>
            <TabsTrigger value="activity">{ar ? "المعاملات والسجل" : "Transactions & Log"}</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-4 space-y-4">
            <Card><CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <RField label={ar ? "كود" : "Code"} name="code" errorMap={errorMap} requiredSet={requiredSet}>
                <Input value={merged.code ?? ""} onChange={(e) => set("code", e.target.value)} />
              </RField>
              <RField label={ar ? "الحالة" : "Status"} name="status" errorMap={errorMap} requiredSet={requiredSet}>
                <Select value={merged.status ?? "active"} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{ar ? "نشط" : "Active"}</SelectItem>
                    <SelectItem value="inactive">{ar ? "متوقّف" : "Inactive"}</SelectItem>
                    <SelectItem value="blocked">{ar ? "محظور" : "Blocked"}</SelectItem>
                  </SelectContent>
                </Select>
              </RField>
              <RField label={ar ? "الصناعة" : "Industry"} name="industry" errorMap={errorMap} requiredSet={requiredSet}>
                <Input value={merged.industry ?? ""} onChange={(e) => set("industry", e.target.value)} />
              </RField>
              <RField label={ar ? "الاسم (عربي)" : "Name (Arabic)"} name="name_ar" errorMap={errorMap} requiredSet={requiredSet}>
                <ScriptInput script="ar" value={merged.name_ar ?? ""} onChange={(v) => set("name_ar", v)} />
              </RField>
              <RField label={ar ? "الاسم (إنجليزي)" : "Name (English)"} name="name_en" errorMap={errorMap} requiredSet={requiredSet}>
                <ScriptInput script="en" value={merged.name_en ?? ""} onChange={(v) => set("name_en", v)} />
              </RField>
              <RField label={ar ? "الاسم القانوني" : "Legal Name"} name="legal_name" errorMap={errorMap} requiredSet={requiredSet}>
                <Input value={merged.legal_name ?? ""} onChange={(e) => set("legal_name", e.target.value)} />
              </RField>
              <RField label={ar ? "الرقم الضريبي" : "Tax ID"} name="tax_id" errorMap={errorMap} requiredSet={requiredSet}>
                <Input value={merged.tax_id ?? ""} onChange={(e) => set("tax_id", e.target.value)} />
              </RField>
              <RField label={ar ? "السجل التجاري" : "Commercial Reg."} name="commercial_reg" errorMap={errorMap} requiredSet={requiredSet}>
                <Input value={merged.commercial_reg ?? ""} onChange={(e) => set("commercial_reg", e.target.value)} />
              </RField>
              <RField label={ar ? "الموقع" : "Website"} name="website" errorMap={errorMap} requiredSet={requiredSet}>
                <Input value={merged.website ?? ""} onChange={(e) => set("website", e.target.value)} />
              </RField>
              <RField label={ar ? "البريد" : "Email"} name="email" errorMap={errorMap} requiredSet={requiredSet}>
                <Input type="email" value={merged.email ?? ""} onChange={(e) => set("email", e.target.value)} />
              </RField>
              <RField label={ar ? "الموبايل" : "Mobile"} name="mobile" errorMap={errorMap} requiredSet={requiredSet}>
                <Input value={merged.mobile ?? ""} onChange={(e) => set("mobile", e.target.value)} />
              </RField>
              <RField label={ar ? "أرضي" : "Phone"} name="phone" errorMap={errorMap} requiredSet={requiredSet}>
                <Input value={merged.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
              </RField>
              <RField label={ar ? "ملاحظات" : "Notes"} name="notes" className="sm:col-span-2 lg:col-span-3" errorMap={errorMap} requiredSet={requiredSet}>
                <Textarea rows={3} value={merged.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
              </RField>
            </CardContent></Card>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-semibold">{ar ? "جهات الاتصال" : "Contacts"}</h2>
                <Separator className="flex-1" />
              </div>
              <ContactsPanel partnerId={partner.id} ar={ar} />
            </div>
          </TabsContent>

          <TabsContent value="addresses" className="mt-4 space-y-4">
            <Card><CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <RField label={ar ? "البلد" : "Country"} name="country" errorMap={errorMap} requiredSet={requiredSet}>
                <Input value={merged.country ?? ""} onChange={(e) => set("country", e.target.value)} />
              </RField>
              <RField label={ar ? "المحافظة" : "State"} name="state" errorMap={errorMap} requiredSet={requiredSet}>
                <Input value={merged.state ?? ""} onChange={(e) => set("state", e.target.value)} />
              </RField>
              <RField label={ar ? "المدينة" : "City"} name="city" errorMap={errorMap} requiredSet={requiredSet}>
                <Input value={merged.city ?? ""} onChange={(e) => set("city", e.target.value)} />
              </RField>
              <RField label="Incoterm" name="incoterm" errorMap={errorMap} requiredSet={requiredSet}>
                <Input value={merged.incoterm ?? ""} onChange={(e) => set("incoterm", e.target.value)} />
              </RField>
              <RField label={ar ? "العنوان الأساسي" : "Primary Address"} name="address" className="sm:col-span-2 lg:col-span-4" errorMap={errorMap} requiredSet={requiredSet}>
                <Input value={merged.address ?? ""} onChange={(e) => set("address", e.target.value)} />
              </RField>
            </CardContent></Card>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-semibold">{ar ? "عناوين الفوترة والشحن" : "Billing & Shipping Addresses"}</h2>
                <Separator className="flex-1" />
              </div>
              <AddressesPanel partnerId={partner.id} ar={ar} />
            </div>
          </TabsContent>

          <TabsContent value="financial" className="mt-4 space-y-4">
            <Card><CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <RField label={ar ? "العملة" : "Currency"} name="currency" errorMap={errorMap} requiredSet={requiredSet}>
                <Input value={merged.currency ?? "EGP"} onChange={(e) => set("currency", e.target.value)} />
              </RField>
              <RField label={ar ? "شروط الدفع" : "Payment Terms"} name="payment_terms" errorMap={errorMap} requiredSet={requiredSet}>
                <Input value={merged.payment_terms ?? ""} onChange={(e) => set("payment_terms", e.target.value)} />
              </RField>
              <RField label={ar ? "حد الائتمان" : "Credit Limit"} name="credit_limit" errorMap={errorMap} requiredSet={requiredSet}>
                <Input type="number" value={merged.credit_limit ?? 0} onChange={(e) => set("credit_limit", Number(e.target.value))} />
              </RField>
              <RField label={ar ? "قائمة الأسعار" : "Price List"} name="price_list" errorMap={errorMap} requiredSet={requiredSet}>
                <Input value={merged.price_list ?? ""} onChange={(e) => set("price_list", e.target.value)} />
              </RField>
            </CardContent></Card>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-semibold">{ar ? "الحسابات البنكية" : "Bank Accounts"}</h2>
                <Separator className="flex-1" />
              </div>
              <BanksPanel partnerId={partner.id} ar={ar} />
            </div>
          </TabsContent>

          <TabsContent value="activity" className="mt-4 space-y-4">
            <DocsPanel partner={partner} ar={ar} />
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-semibold">{ar ? "سجل التغييرات" : "Change Log"}</h2>
                <Separator className="flex-1" />
              </div>
              <AuditPanel partnerId={partner.id} ar={ar} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
