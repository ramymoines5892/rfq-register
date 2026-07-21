import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCurrentCompany, useUpdateCompany } from "@/features/company/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Building2, Save, Loader2, Image as ImageIcon, FolderArchive, ToggleRight, Hash, Settings, ExternalLink } from "lucide-react";
import { uploadCompanyLogo } from "@/features/company/api";
import { ScriptInput } from "@/components/ScriptInput";

export const Route = createFileRoute("/_authenticated/settings/company")({
  component: SettingsCompanyPage,
  head: () => ({ meta: [{ title: "بيانات الشركة | Company Data" }] }),
});

function SettingsCompanyPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const { data: company, isLoading } = useCurrentCompany();
  const update = useUpdateCompany();

  const [form, setForm] = useState<any>({});
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    if (company) setForm(company);
  }, [company]);

  if (isLoading || !company) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground" dir={dir}>
        <Loader2 className="h-5 w-5 animate-spin me-2" />
        {ar ? "جاري التحميل..." : "Loading..."}
      </div>
    );
  }

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async (fields: string[]) => {
    const patch: any = {};
    for (const k of fields) patch[k] = form[k] ?? null;
    try {
      await update.mutateAsync({ id: company.id, patch });
      toast.success(ar ? "تم الحفظ" : "Saved");
    } catch (e: any) {
      toast.error(e?.message || (ar ? "فشل الحفظ" : "Save failed"));
    }
  };

  const handleLogo = async (file: File) => {
    setLogoUploading(true);
    try {
      const { url } = await uploadCompanyLogo(file);
      await update.mutateAsync({ id: company.id, patch: { logo_url: url } });
      setForm((f: any) => ({ ...f, logo_url: url }));
      toast.success(ar ? "تم تحديث الشعار" : "Logo updated");
    } catch (e: any) {
      toast.error(e?.message || (ar ? "فشل الرفع" : "Upload failed"));
    } finally {
      setLogoUploading(false);
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
            {form.logo_url
              ? <img src={form.logo_url} alt="" className="h-full w-full object-cover" />
              : <Building2 className="h-5 w-5 text-primary" />}
          </div>
          <div>
            <h2 className="text-xl font-bold">{ar ? "بيانات الشركة" : "Company Data"}</h2>
            <p className="text-xs text-muted-foreground">
              {ar ? "المعلومات الأساسية والمتقدمة والمميزات وترقيم المستندات." : "Basic, advanced, features and document numbering."}
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/setup"><ExternalLink className="h-3.5 w-3.5 me-1" /> {ar ? "فتح معالج الإعداد" : "Open Setup Wizard"}</Link>
        </Button>
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-muted/60">
          <TabsTrigger value="basic"><Building2 className="h-3.5 w-3.5 me-1" />{ar ? "الأساسي" : "Basic"}</TabsTrigger>
          <TabsTrigger value="contact"><Settings className="h-3.5 w-3.5 me-1" />{ar ? "التواصل" : "Contact"}</TabsTrigger>
          <TabsTrigger value="advanced"><Settings className="h-3.5 w-3.5 me-1" />{ar ? "متقدم" : "Advanced"}</TabsTrigger>
          <TabsTrigger value="managers"><Building2 className="h-3.5 w-3.5 me-1" />{ar ? "المسؤولون" : "Managers"}</TabsTrigger>
          <TabsTrigger value="documents"><FolderArchive className="h-3.5 w-3.5 me-1" />{ar ? "المستندات" : "Documents"}</TabsTrigger>
        </TabsList>


        {/* Basic */}
        <TabsContent value="basic" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{ar ? "الهوية" : "Identity"}</CardTitle>
              <CardDescription className="text-xs">
                {ar ? "الاسم والشعار — يظهر في الرأس والقائمة الجانبية." : "Name and logo — appear in the header and sidebar."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center overflow-hidden border">
                  {form.logo_url
                    ? <img src={form.logo_url} alt="" className="h-full w-full object-cover" />
                    : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div className="space-y-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="file" accept="image/*" className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleLogo(e.target.files[0])}
                    />
                    <Button asChild size="sm" variant="outline" disabled={logoUploading}>
                      <span>{logoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                        <span className="ms-1">{ar ? "تغيير الشعار" : "Change logo"}</span></span>
                    </Button>
                  </label>
                  {form.logo_url && (
                    <Button size="sm" variant="ghost" onClick={() => { set("logo_url", null); save(["logo_url"]); }}>
                      {ar ? "إزالة" : "Remove"}
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs">{ar ? "الاسم بالعربية" : "Arabic Name"}</Label>
                  <ScriptInput script="ar" value={form.name_ar ?? ""} onChange={(v) => set("name_ar", v)} />
                </div>
                <div>
                  <Label className="text-xs">{ar ? "الاسم بالإنجليزية" : "English Name"}</Label>
                  <ScriptInput script="en" value={form.name ?? ""} onChange={(v) => set("name", v)} />
                </div>
                <div>
                  <Label className="text-xs">{ar ? "الاسم المختصر" : "Short Name"}</Label>
                  <Input value={form.short_name ?? ""} onChange={(e) => set("short_name", e.target.value)} placeholder={ar ? "يظهر في القائمة الجانبية" : "Shown in the sidebar"} />
                </div>
                <div>
                  <Label className="text-xs">{ar ? "الكود" : "Code"}</Label>
                  <Input value={form.code ?? ""} onChange={(e) => set("code", e.target.value.toUpperCase())} />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <Label className="text-xs">{ar ? "السجل التجاري" : "Commercial Reg."}</Label>
                  <Input value={form.cr_no ?? ""} onChange={(e) => set("cr_no", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">{ar ? "الرقم الضريبي" : "Tax No."}</Label>
                  <Input value={form.tax_no ?? ""} onChange={(e) => set("tax_no", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">{ar ? "رقم القيمة المضافة" : "VAT No."}</Label>
                  <Input value={form.vat_no ?? ""} onChange={(e) => set("vat_no", e.target.value)} />
                </div>
              </div>

              <div className="flex justify-end">
                <Button size="sm" onClick={() => save(["name", "name_ar", "short_name", "code", "cr_no", "tax_no", "vat_no"])} disabled={update.isPending}>
                  {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span className="ms-1">{ar ? "حفظ" : "Save"}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact */}
        <TabsContent value="contact" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{ar ? "معلومات التواصل" : "Contact Info"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs">{ar ? "البريد الإلكتروني" : "Email"}</Label>
                  <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">{ar ? "الموقع الإلكتروني" : "Website"}</Label>
                  <Input value={form.website ?? ""} onChange={(e) => set("website", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">{ar ? "الموبايل" : "Mobile"}</Label>
                  <Input value={form.mobile ?? ""} onChange={(e) => set("mobile", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">{ar ? "الأرضي" : "Phone"}</Label>
                  <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">{ar ? "الفاكس" : "Fax"}</Label>
                  <Input value={form.fax ?? ""} onChange={(e) => set("fax", e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">{ar ? "العنوان" : "Address"}</Label>
                <Textarea rows={2} value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <Label className="text-xs">{ar ? "الدولة" : "Country"}</Label>
                  <Input value={form.country ?? ""} onChange={(e) => set("country", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">{ar ? "المدينة" : "City"}</Label>
                  <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">{ar ? "الرمز البريدي" : "Postal Code"}</Label>
                  <Input value={form.postal_code ?? ""} onChange={(e) => set("postal_code", e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={() => save(["email", "website", "mobile", "phone", "fax", "address", "country", "city", "state", "postal_code"])} disabled={update.isPending}>
                  {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span className="ms-1">{ar ? "حفظ" : "Save"}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced */}
        <TabsContent value="advanced" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{ar ? "الإعدادات المتقدمة" : "Advanced Settings"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs">{ar ? "المنطقة الزمنية" : "Timezone"}</Label>
                  <Input value={form.timezone ?? ""} onChange={(e) => set("timezone", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">{ar ? "العملة" : "Base Currency"}</Label>
                  <Input value={form.base_currency ?? ""} onChange={(e) => set("base_currency", e.target.value.toUpperCase())} />
                </div>
                <div>
                  <Label className="text-xs">{ar ? "تنسيق التاريخ" : "Date Format"}</Label>
                  <Input value={form.date_format ?? ""} onChange={(e) => set("date_format", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">{ar ? "تنسيق الأرقام" : "Number Format"}</Label>
                  <Input value={form.number_format ?? ""} onChange={(e) => set("number_format", e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">{ar ? "ملاحظات" : "Notes"}</Label>
                <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={() => save(["timezone", "base_currency", "date_format", "number_format", "default_language", "notes"])} disabled={update.isPending}>
                  {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span className="ms-1">{ar ? "حفظ" : "Save"}</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-3">
            <Link to="/settings/features" className="group">
              <Card className="hover:border-primary/60 transition-colors">
                <CardContent className="p-4 flex items-center gap-3">
                  <ToggleRight className="h-5 w-5 text-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{ar ? "مميزات النظام" : "System Features"}</div>
                    <div className="text-xs text-muted-foreground">{ar ? "تفعيل/تعطيل الوحدات" : "Enable/disable modules"}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link to="/settings/document-types" className="group">
              <Card className="hover:border-primary/60 transition-colors">
                <CardContent className="p-4 flex items-center gap-3">
                  <FolderArchive className="h-5 w-5 text-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{ar ? "مستندات الشركة" : "Company Documents"}</div>
                    <div className="text-xs text-muted-foreground">{ar ? "أنواع وقوالب المستندات" : "Types and templates"}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link to="/setup" className="group">
              <Card className="hover:border-primary/60 transition-colors">
                <CardContent className="p-4 flex items-center gap-3">
                  <Hash className="h-5 w-5 text-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{ar ? "ترقيم المستندات" : "Document Numbering"}</div>
                    <div className="text-xs text-muted-foreground">{ar ? "بادئات وتنسيق الأرقام" : "Prefixes and format"}</div>
                  </div>
                  <Badge variant="secondary" className="text-[9px]">{ar ? "المعالج" : "Wizard"}</Badge>
                </CardContent>
              </Card>
            </Link>
          </div>
        </TabsContent>

        {/* Managers */}
        <TabsContent value="managers" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{ar ? "المسؤولون الرئيسيون" : "Key Managers"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs">{ar ? "المدير العام" : "General Manager"}</Label>
                  <Input value={form.gm_name ?? ""} onChange={(e) => set("gm_name", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">{ar ? "مدير المشتريات" : "Procurement Manager"}</Label>
                  <Input value={form.purchasing_manager ?? ""} onChange={(e) => set("purchasing_manager", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">{ar ? "مدير المبيعات" : "Sales Manager"}</Label>
                  <Input value={form.sales_manager ?? ""} onChange={(e) => set("sales_manager", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">{ar ? "المدير المالي" : "Finance Manager"}</Label>
                  <Input value={form.finance_manager ?? ""} onChange={(e) => set("finance_manager", e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={() => save(["gm_name", "purchasing_manager", "sales_manager", "finance_manager"])} disabled={update.isPending}>
                  {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span className="ms-1">{ar ? "حفظ" : "Save"}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
