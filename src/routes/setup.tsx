import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hasAnyCompany, uploadCompanyLogo, type CompanyAdvanced, type CompanyFeatures, type CompanyGeneral, type NumberingRow } from "@/features/company/api";
import { useCreateCompany } from "@/features/company/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Building2, Sparkles, Settings2, Hash, CheckCircle2, ArrowRight, ArrowLeft, Upload, Loader2, Gem, RotateCcw } from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";

const DRAFT_KEY = "eec.setup.draft.v1";

type Draft = {
  step: Step;
  general: CompanyGeneral;
  advanced: CompanyAdvanced;
  features: CompanyFeatures;
  numbering: NumberingRow[];
};

function loadDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Draft;
  } catch { return null; }
}
function clearDraft() {
  if (typeof window !== "undefined") localStorage.removeItem(DRAFT_KEY);
}

export const Route = createFileRoute("/setup")({
  beforeLoad: async () => {
    // Must be signed in to bootstrap; RLS will still enforce
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const exists = await hasAnyCompany().catch(() => false);
    if (exists) throw redirect({ to: "/" });
  },
  component: SetupPage,
  head: () => ({ meta: [{ title: "First-Time Setup | EEC ERP" }] }),
});

type Step = "welcome" | 1 | 2 | 3 | 4 | "done";

const DEFAULT_FEATURES: CompanyFeatures = {
  multi_branch: true, multi_warehouse: true, multi_currency: true,
  approval_workflow: true, audit_log: true, inventory: true,
  procurement: true, sales: true, finance: true, quality: true,
  traceability: true, heat_number: true, lot_number: true,
  batch_control: true, attachments: true, e_signatures: true,
};

const DEFAULT_NUMBERING: NumberingRow[] = [
  { doc_type: "RFQ", prefix: "RFQ", year_segment: true, padding: 6, next_seq: 1 },
  { doc_type: "PO",  prefix: "PO",  year_segment: true, padding: 6, next_seq: 1 },
  { doc_type: "QT",  prefix: "QT",  year_segment: true, padding: 6, next_seq: 1 },
  { doc_type: "SO",  prefix: "SO",  year_segment: true, padding: 6, next_seq: 1 },
  { doc_type: "INV", prefix: "INV", year_segment: true, padding: 6, next_seq: 1 },
  { doc_type: "GRN", prefix: "GRN", year_segment: true, padding: 6, next_seq: 1 },
];

function SetupPage() {
  const { lang, setLang, dir } = useI18n();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const createMut = useCreateCompany();

  const draftRef = useRef<Draft | null>(typeof window !== "undefined" ? loadDraft() : null);
  const d = draftRef.current;

  const [step, setStep] = useState<Step>(d?.step ?? "welcome");
  const [general, setGeneral] = useState<CompanyGeneral>(d?.general ?? {
    name: "", name_ar: "", short_name: "", code: "",
    tax_no: "", cr_no: "", vat_no: "", email: "", phone: "", mobile: "", website: "", logo_url: "",
  });
  const [advanced, setAdvanced] = useState<CompanyAdvanced>(d?.advanced ?? {
    country: "Egypt", city: "", state: "", postal_code: "", address: "",
    default_language: "ar", timezone: "Africa/Cairo", date_format: "DD/MM/YYYY", number_format: "#,##0.00",
    base_currency: "EGP", fiscal_year_start: `${new Date().getFullYear()}-01-01`, fiscal_year_end: `${new Date().getFullYear()}-12-31`,
    gm_name: "", purchasing_manager: "", sales_manager: "", finance_manager: "", notes: "",
  });
  const [features, setFeatures] = useState<CompanyFeatures>(d?.features ?? DEFAULT_FEATURES);
  const [numbering, setNumbering] = useState<NumberingRow[]>(d?.numbering ?? DEFAULT_NUMBERING);
  const [logoUploading, setLogoUploading] = useState(false);

  // Persist every change so a refresh/close returns to the exact same place.
  useEffect(() => {
    if (step === "done") return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, general, advanced, features, numbering }));
    } catch { /* ignore quota errors */ }
  }, [step, general, advanced, features, numbering]);

  async function resetAll() {
    const ok = await confirm({
      title: lang === "ar" ? "البدء من جديد؟" : "Start over?",
      description: lang === "ar"
        ? "هيتم مسح كل البيانات اللى دخلتها فى المعالج."
        : "All data entered in the wizard will be cleared.",
      confirmText: lang === "ar" ? "نعم، ابدأ من جديد" : "Yes, start over",
      variant: "destructive",
    });
    if (!ok) return;
    clearDraft();
    setStep("welcome");
    setGeneral({ name: "", name_ar: "", short_name: "", code: "", tax_no: "", cr_no: "", vat_no: "", email: "", phone: "", mobile: "", website: "", logo_url: "" });
    setAdvanced({
      country: "Egypt", city: "", state: "", postal_code: "", address: "",
      default_language: "ar", timezone: "Africa/Cairo", date_format: "DD/MM/YYYY", number_format: "#,##0.00",
      base_currency: "EGP", fiscal_year_start: `${new Date().getFullYear()}-01-01`, fiscal_year_end: `${new Date().getFullYear()}-12-31`,
      gm_name: "", purchasing_manager: "", sales_manager: "", finance_manager: "", notes: "",
    });
    setFeatures(DEFAULT_FEATURES);
    setNumbering(DEFAULT_NUMBERING);
  }



  const isAr = lang === "ar";
  const T = (ar: string, en: string) => (isAr ? ar : en);

  const tabs = [
    { id: 1 as const, label: T("البيانات الأساسية", "General"), icon: Building2 },
    { id: 2 as const, label: T("البيانات المتقدمة", "Advanced"), icon: Sparkles },
    { id: 3 as const, label: T("مميزات النظام", "Features"), icon: Settings2 },
    { id: 4 as const, label: T("ترقيم المستندات", "Numbering"), icon: Hash },
  ];

  const currentIdx = typeof step === "number" ? step : 0;
  const progress = typeof step === "number" ? (step / 4) * 100 : 0;

  function validateStep(s: number): string | null {
    if (s === 1) {
      if (!general.name.trim()) return T("اسم الشركة مطلوب", "Company name is required");
      if (!general.code.trim()) return T("كود الشركة مطلوب", "Company code is required");
      if (general.email && !/^\S+@\S+\.\S+$/.test(general.email)) return T("بريد إلكتروني غير صحيح", "Invalid email");
    }
    if (s === 4) {
      const seen = new Set<string>();
      for (const row of numbering) {
        if (!row.prefix.trim()) return T("كل مستند لازم يكون له بادئة", "Each doc needs a prefix");
        if (seen.has(row.doc_type)) return T("نوع مستند مكرر", "Duplicate doc type");
        seen.add(row.doc_type);
      }
    }
    return null;
  }

  function next() {
    const err = validateStep(currentIdx);
    if (err) { toast.error(err); return; }
    if (currentIdx < 4) setStep((currentIdx + 1) as Step);
  }
  function back() {
    if (currentIdx > 1) setStep((currentIdx - 1) as Step);
    else setStep("welcome");
  }

  async function handleLogo(file: File) {
    setLogoUploading(true);
    try {
      const url = await uploadCompanyLogo(file);
      setGeneral((g) => ({ ...g, logo_url: url }));
      toast.success(T("تم رفع اللوجو", "Logo uploaded"));
    } catch (e: any) {
      toast.error(e?.message ?? T("فشل رفع اللوجو", "Upload failed"));
    } finally {
      setLogoUploading(false);
    }
  }

  async function submit() {
    for (const s of [1, 2, 3, 4]) {
      const err = validateStep(s);
      if (err) { toast.error(err); setStep(s as Step); return; }
    }
    try {
      await createMut.mutateAsync({ general, advanced, features, numbering });
      clearDraft();
      setStep("done");
    } catch (e: any) {
      toast.error(e?.message ?? T("فشل إنشاء الشركة", "Failed to create company"));
    }
  }

  // ----------- WELCOME -----------
  if (step === "welcome") {
    return (
      <div className="min-h-screen grid md:grid-cols-2 bg-background" dir={dir}>
        <div className="hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground relative overflow-hidden">
          <div className="absolute -top-24 -end-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 -start-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur grid place-items-center">
                <Gem className="h-6 w-6" />
              </div>
              <div className="font-display text-2xl font-bold">EEC ERP</div>
            </div>
          </div>
          <div className="relative space-y-4">
            <h2 className="text-4xl font-bold leading-tight">{T("نظام موارد المؤسسة", "Enterprise Resource Planning")}</h2>
            <p className="text-primary-foreground/80 text-lg leading-relaxed max-w-sm">
              {T("منظومة متكاملة لإدارة المشتريات والمبيعات والمخزون والمالية.", "One integrated platform for procurement, sales, inventory and finance.")}
            </p>
          </div>
          <div className="relative text-xs text-primary-foreground/60">© Egyptian Europe</div>
        </div>
        <div className="flex items-center justify-center p-8 md:p-16">
          <div className="w-full max-w-md space-y-8">
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setLang(isAr ? "en" : "ar")}>{isAr ? "EN" : "AR"}</Button>
            </div>
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                {T("الإعداد الأول", "First-Time Setup")}
              </div>
              <h1 className="text-4xl font-bold tracking-tight">{T("مرحبًا بك في EEC ERP", "Welcome to EEC ERP")}</h1>
              <p className="text-muted-foreground leading-relaxed">
                {T("مفيش شركة معدّة لحد دلوقتي. قبل ما تبدأ استخدام النظام، لازم تنشئ أول شركة.",
                   "No company has been configured yet. Before using the ERP system, create your first company.")}
              </p>
            </div>
            <Button size="lg" className="w-full h-12 text-base" onClick={() => setStep(1)}>
              {T("إنشاء الشركة", "Create Company")}
              {isAr ? <ArrowLeft className="ms-2 h-5 w-5" /> : <ArrowRight className="ms-2 h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ----------- DONE -----------
  if (step === "done") {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-8" dir={dir}>
        <Card className="max-w-lg w-full text-center">
          <CardHeader>
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 grid place-items-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-3xl">{T("مبروك!", "Congratulations!")}</CardTitle>
            <CardDescription className="text-base mt-2">
              {T("تم إعداد نظام ERP الخاص بك بنجاح.", "Your ERP system has been configured successfully.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" className="w-full h-12" onClick={() => navigate({ to: "/" })}>
              {T("انتقل إلى لوحة التحكم", "Go to Dashboard")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ----------- WIZARD -----------
  return (
    <div className="min-h-screen bg-muted/30 py-6 md:py-10 px-4" dir={dir}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground grid place-items-center"><Gem className="h-5 w-5" /></div>
          <div>
            <div className="font-display font-bold">EEC ERP</div>
            <div className="text-xs text-muted-foreground">{T("معالج إعداد الشركة", "Company Setup Wizard")}</div>
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-card border rounded-2xl p-4 md:p-5">
          <div className="flex items-center justify-between gap-2">
            {tabs.map((t, i) => {
              const active = t.id === currentIdx;
              const done = t.id < currentIdx;
              const Icon = t.icon;
              return (
                <div key={t.id} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                    <div className={`h-10 w-10 rounded-full grid place-items-center transition-all ${
                      done ? "bg-primary text-primary-foreground" :
                      active ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <div className={`text-[11px] md:text-xs font-medium truncate text-center max-w-[120px] ${active ? "text-foreground" : "text-muted-foreground"}`}>
                      {t.label}
                    </div>
                  </div>
                  {i < tabs.length - 1 && <div className={`h-0.5 flex-1 mx-1 ${done ? "bg-primary" : "bg-muted"}`} />}
                </div>
              );
            })}
          </div>
          <div className="mt-4 h-1 bg-muted rounded overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <Card>
          <CardContent className="p-6 md:p-8 space-y-6">
            {step === 1 && (
              <StepGeneral general={general} setGeneral={setGeneral} T={T} onLogoFile={handleLogo} logoUploading={logoUploading} />
            )}
            {step === 2 && <StepAdvanced advanced={advanced} setAdvanced={setAdvanced} T={T} />}
            {step === 3 && <StepFeatures features={features} setFeatures={setFeatures} T={T} />}
            {step === 4 && <StepNumbering numbering={numbering} setNumbering={setNumbering} T={T} />}
          </CardContent>
        </Card>

        {/* Nav */}
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" onClick={back} disabled={createMut.isPending}>
            {isAr ? <ArrowRight className="me-2 h-4 w-4" /> : <ArrowLeft className="me-2 h-4 w-4" />}
            {T("رجوع", "Back")}
          </Button>
          {currentIdx < 4 ? (
            <Button onClick={next}>
              {T("التالي", "Next")}
              {isAr ? <ArrowLeft className="ms-2 h-4 w-4" /> : <ArrowRight className="ms-2 h-4 w-4" />}
            </Button>
          ) : (
            <Button onClick={submit} disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {T("إنشاء الشركة", "Create Company")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- STEPS ----------------

function Field({ label, children, required, hint }: { label: string; children: React.ReactNode; required?: boolean; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}{required && <span className="text-destructive ms-1">*</span>}</Label>
      {children}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function StepGeneral({ general, setGeneral, T, onLogoFile, logoUploading }: any) {
  const set = (k: keyof CompanyGeneral) => (e: any) => setGeneral((g: any) => ({ ...g, [k]: e.target.value }));
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{T("البيانات الأساسية", "General Information")}</h3>
        <p className="text-sm text-muted-foreground">{T("أدخل البيانات الأساسية للشركة.", "Basic company information.")}</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label={T("اسم الشركة", "Company Name")} required>
          <Input value={general.name} onChange={set("name")} autoFocus />
        </Field>
        <Field label={T("الاسم بالعربي", "Arabic Company Name")}>
          <Input value={general.name_ar ?? ""} onChange={set("name_ar")} dir="rtl" />
        </Field>
        <Field label={T("الاسم المختصر", "Short Name")}>
          <Input value={general.short_name ?? ""} onChange={set("short_name")} />
        </Field>
        <Field label={T("كود الشركة", "Company Code")} required>
          <Input value={general.code} onChange={set("code")} placeholder="EEC-001" />
        </Field>
        <Field label={T("الرقم الضريبي", "Tax Registration Number")}>
          <Input value={general.tax_no ?? ""} onChange={set("tax_no")} />
        </Field>
        <Field label={T("السجل التجاري", "Commercial Registration Number")}>
          <Input value={general.cr_no ?? ""} onChange={set("cr_no")} />
        </Field>
        <Field label={T("رقم القيمة المضافة", "VAT Number")}>
          <Input value={general.vat_no ?? ""} onChange={set("vat_no")} />
        </Field>
        <Field label={T("البريد الإلكتروني", "Email")}>
          <Input type="email" value={general.email ?? ""} onChange={set("email")} />
        </Field>
        <Field label={T("تليفون أرضي", "Phone")}>
          <Input value={general.phone ?? ""} onChange={set("phone")} />
        </Field>
        <Field label={T("موبايل", "Mobile")}>
          <Input value={general.mobile ?? ""} onChange={set("mobile")} />
        </Field>
        <Field label={T("الموقع الإلكتروني", "Website")}>
          <Input value={general.website ?? ""} onChange={set("website")} placeholder="https://..." />
        </Field>
        <Field label={T("لوجو الشركة", "Company Logo")}>
          <div className="flex items-center gap-3">
            <label className="flex-1 cursor-pointer">
              <div className="border border-dashed rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 flex items-center gap-2">
                {logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <span className="truncate">{general.logo_url ? T("تم رفع اللوجو", "Logo uploaded") : T("اختر ملف صورة", "Choose an image")}</span>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onLogoFile(e.target.files[0])} />
            </label>
            {general.logo_url && <img src={general.logo_url} alt="logo" className="h-10 w-10 rounded object-contain border" />}
          </div>
        </Field>
      </div>
    </div>
  );
}

function StepAdvanced({ advanced, setAdvanced, T }: any) {
  const set = (k: keyof CompanyAdvanced) => (e: any) => setAdvanced((a: any) => ({ ...a, [k]: e?.target ? e.target.value : e }));
  const Section = ({ title, children }: any) => (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">{title}</h4>
      <div className="grid md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold">{T("البيانات المتقدمة", "Advanced Information")}</h3>
        <p className="text-sm text-muted-foreground">{T("العنوان والإعدادات الإقليمية والمالية.", "Address, regional and financial settings.")}</p>
      </div>

      <Section title={T("العنوان", "Address")}>
        <Field label={T("الدولة", "Country")}><Input value={advanced.country ?? ""} onChange={set("country")} autoFocus /></Field>
        <Field label={T("المدينة", "City")}><Input value={advanced.city ?? ""} onChange={set("city")} /></Field>
        <Field label={T("المحافظة", "State")}><Input value={advanced.state ?? ""} onChange={set("state")} /></Field>
        <Field label={T("الرمز البريدي", "Postal Code")}><Input value={advanced.postal_code ?? ""} onChange={set("postal_code")} /></Field>
        <div className="md:col-span-2">
          <Field label={T("العنوان الكامل", "Full Address")}><Textarea rows={2} value={advanced.address ?? ""} onChange={set("address")} /></Field>
        </div>
      </Section>

      <Section title={T("الإعدادات الإقليمية", "Regional Settings")}>
        <Field label={T("اللغة الافتراضية", "Default Language")}>
          <Select value={advanced.default_language ?? "ar"} onValueChange={(v) => set("default_language")(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ar">العربية</SelectItem><SelectItem value="en">English</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label={T("المنطقة الزمنية", "Time Zone")}>
          <Select value={advanced.timezone ?? "Africa/Cairo"} onValueChange={(v) => set("timezone")(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Africa/Cairo">Africa/Cairo</SelectItem>
              <SelectItem value="Europe/London">Europe/London</SelectItem>
              <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
              <SelectItem value="Asia/Riyadh">Asia/Riyadh</SelectItem>
              <SelectItem value="Asia/Dubai">Asia/Dubai</SelectItem>
              <SelectItem value="UTC">UTC</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={T("صيغة التاريخ", "Date Format")}>
          <Select value={advanced.date_format ?? "DD/MM/YYYY"} onValueChange={(v) => set("date_format")(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
              <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
              <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={T("صيغة الأرقام", "Number Format")}>
          <Select value={advanced.number_format ?? "#,##0.00"} onValueChange={(v) => set("number_format")(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="#,##0.00">1,234.56</SelectItem>
              <SelectItem value="#.##0,00">1.234,56</SelectItem>
              <SelectItem value="# ##0.00">1 234.56</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Section>

      <Section title={T("الإعدادات المالية", "Financial Settings")}>
        <Field label={T("العملة الأساسية", "Base Currency")}>
          <Select value={advanced.base_currency ?? "EGP"} onValueChange={(v) => set("base_currency")(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="EGP">EGP - جنيه مصري</SelectItem>
              <SelectItem value="USD">USD - US Dollar</SelectItem>
              <SelectItem value="EUR">EUR - Euro</SelectItem>
              <SelectItem value="GBP">GBP - British Pound</SelectItem>
              <SelectItem value="SAR">SAR - Saudi Riyal</SelectItem>
              <SelectItem value="AED">AED - UAE Dirham</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div />
        <Field label={T("بداية السنة المالية", "Fiscal Year Start")}>
          <Input type="date" value={advanced.fiscal_year_start ?? ""} onChange={set("fiscal_year_start")} />
        </Field>
        <Field label={T("نهاية السنة المالية", "Fiscal Year End")}>
          <Input type="date" value={advanced.fiscal_year_end ?? ""} onChange={set("fiscal_year_end")} />
        </Field>
      </Section>

      <Section title={T("جهات اتصال الشركة", "Company Contacts")}>
        <Field label={T("المدير العام", "General Manager")}><Input value={advanced.gm_name ?? ""} onChange={set("gm_name")} /></Field>
        <Field label={T("مدير المشتريات", "Purchasing Manager")}><Input value={advanced.purchasing_manager ?? ""} onChange={set("purchasing_manager")} /></Field>
        <Field label={T("مدير المبيعات", "Sales Manager")}><Input value={advanced.sales_manager ?? ""} onChange={set("sales_manager")} /></Field>
        <Field label={T("مدير المالية", "Finance Manager")}><Input value={advanced.finance_manager ?? ""} onChange={set("finance_manager")} /></Field>
      </Section>

      <Section title={T("ملاحظات إضافية", "Additional Notes")}>
        <div className="md:col-span-2">
          <Field label={T("ملاحظات داخلية", "Internal Notes")}><Textarea rows={3} value={advanced.notes ?? ""} onChange={set("notes")} /></Field>
        </div>
      </Section>
    </div>
  );
}

const FEATURE_META: { key: keyof CompanyFeatures; ar: string; en: string; desc_ar: string; desc_en: string }[] = [
  { key: "multi_branch", ar: "تعدد الفروع", en: "Multi Branch", desc_ar: "إدارة فروع متعددة", desc_en: "Manage multiple branches" },
  { key: "multi_warehouse", ar: "تعدد المخازن", en: "Multi Warehouse", desc_ar: "مخازن متعددة لكل فرع", desc_en: "Multiple warehouses per branch" },
  { key: "multi_currency", ar: "تعدد العملات", en: "Multi Currency", desc_ar: "دعم عملات متعددة", desc_en: "Multiple currency support" },
  { key: "approval_workflow", ar: "دورة اعتماد", en: "Approval Workflow", desc_ar: "مسارات اعتماد للمستندات", desc_en: "Document approval flows" },
  { key: "audit_log", ar: "سجل التدقيق", en: "Audit Log", desc_ar: "تسجيل كل العمليات", desc_en: "Log every operation" },
  { key: "inventory", ar: "إدارة المخزون", en: "Inventory", desc_ar: "متابعة الأصناف والحركات", desc_en: "Items and stock movements" },
  { key: "procurement", ar: "المشتريات", en: "Procurement", desc_ar: "أوامر شراء وموردين", desc_en: "POs and suppliers" },
  { key: "sales", ar: "المبيعات", en: "Sales", desc_ar: "عملاء وأوامر بيع", desc_en: "Customers and sales orders" },
  { key: "finance", ar: "المالية", en: "Finance", desc_ar: "قيود وحسابات", desc_en: "Ledger and accounts" },
  { key: "quality", ar: "الجودة", en: "Quality", desc_ar: "شهادات ومطابقة", desc_en: "Certificates and compliance" },
  { key: "traceability", ar: "التتبع", en: "Traceability", desc_ar: "تتبع كامل للأصناف", desc_en: "Full item traceability" },
  { key: "heat_number", ar: "أرقام الصهر", en: "Heat Number", desc_ar: "تتبع أرقام Heat", desc_en: "Heat number tracking" },
  { key: "lot_number", ar: "أرقام التشغيلة", en: "Lot Number", desc_ar: "تتبع Lot", desc_en: "Lot tracking" },
  { key: "batch_control", ar: "التحكم بالدُفعات", en: "Batch Control", desc_ar: "Batches", desc_en: "Batches" },
  { key: "attachments", ar: "المرفقات", en: "Attachments", desc_ar: "رفع ملفات للمستندات", desc_en: "Attach documents" },
  { key: "e_signatures", ar: "التوقيع الإلكتروني", en: "E-Signatures", desc_ar: "توقيعات رقمية", desc_en: "Digital signatures" },
];

function StepFeatures({ features, setFeatures, T }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{T("مميزات النظام", "System Features")}</h3>
        <p className="text-sm text-muted-foreground">{T("فعّل أو عطّل الموديولات حسب حاجتك.", "Enable or disable modules to match your needs.")}</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {FEATURE_META.map((f) => {
          const val = features[f.key] as boolean;
          return (
            <label key={f.key} className={`border rounded-xl p-4 cursor-pointer transition-all ${val ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm">{T(f.ar, f.en)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{T(f.desc_ar, f.desc_en)}</div>
                </div>
                <Switch checked={val} onCheckedChange={(c) => setFeatures((prev: any) => ({ ...prev, [f.key]: c }))} />
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function StepNumbering({ numbering, setNumbering, T }: any) {
  const year = new Date().getFullYear();
  const preview = (r: NumberingRow) =>
    `${r.prefix}${r.year_segment ? `-${year}` : ""}-${String(r.next_seq).padStart(r.padding, "0")}`;
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{T("ترقيم المستندات", "Document Numbering")}</h3>
        <p className="text-sm text-muted-foreground">{T("خصّص صيغة ترقيم كل نوع مستند.", "Customize numbering format for each document type.")}</p>
      </div>
      <div className="space-y-3">
        {numbering.map((row: NumberingRow, i: number) => {
          const upd = (patch: Partial<NumberingRow>) =>
            setNumbering((prev: NumberingRow[]) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
          return (
            <div key={row.doc_type} className="border rounded-xl p-4 grid md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-2">
                <Label className="text-xs text-muted-foreground">{T("النوع", "Type")}</Label>
                <div className="mt-1 h-9 grid place-items-center bg-muted rounded-md font-mono text-sm font-medium">{row.doc_type}</div>
              </div>
              <div className="md:col-span-2">
                <Field label={T("البادئة", "Prefix")}><Input value={row.prefix} onChange={(e) => upd({ prefix: e.target.value.toUpperCase() })} /></Field>
              </div>
              <div className="md:col-span-2">
                <Field label={T("خانات الرقم", "Padding")}>
                  <Input type="number" min={1} max={12} value={row.padding} onChange={(e) => upd({ padding: Math.max(1, Number(e.target.value) || 1) })} />
                </Field>
              </div>
              <div className="md:col-span-2 flex items-center gap-2 h-9 mt-6">
                <Switch checked={row.year_segment} onCheckedChange={(c) => upd({ year_segment: c })} />
                <span className="text-sm">{T("إظهار السنة", "Include year")}</span>
              </div>
              <div className="md:col-span-4">
                <Label className="text-xs text-muted-foreground">{T("معاينة", "Preview")}</Label>
                <div className="mt-1 h-9 px-3 grid items-center bg-primary/5 border border-primary/20 rounded-md font-mono text-sm text-primary">
                  {preview(row)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

