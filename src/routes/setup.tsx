import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hasAnyCompany, uploadCompanyLogo, type CompanyAdvanced, type CompanyFeatures, type CompanyGeneral, type NumberingRow, type SetupDocument } from "@/features/company/api";
import { useCreateCompany } from "@/features/company/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Building2, Sparkles, Settings2, Hash, CheckCircle2, ArrowRight, ArrowLeft, Upload, Loader2, Gem, RotateCcw, AlertCircle, ImagePlus, Mail, Phone, Smartphone, Globe, MapPin, FileText, Receipt, FolderOpen, Plus, Trash2, Paperclip, CalendarDays, Info } from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";
import { COUNTRIES, applyMask, generateCompanyCode, getCountry, validateEmail, validateRule, validateWebsite, type FieldValidation } from "@/lib/countryFormats";
import { DOC_PRESETS, slugifyCode, type DocPreset } from "@/lib/companyDocPresets";

const DRAFT_KEY = "eec.setup.draft.v1";

type PersistedDoc = Omit<SetupDocument, "file"> & { file_name?: string | null };

type Draft = {
  step: Step;
  general: CompanyGeneral;
  advanced: CompanyAdvanced;
  features: CompanyFeatures;
  numbering: NumberingRow[];
  documents: PersistedDoc[];
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

// -------- Weighted completion for the "General" step --------
// Only what the business truly needs on day one.
// Required (bilingual name + country) counts heavier; everything else is
// weighted by usefulness, not by count. Landline / website are tiny weight.
type Weight = { key: string; weight: number; filled: boolean; valid: boolean; required?: boolean };

function computeGeneralWeights(g: CompanyGeneral, country: string): Weight[] {
  const c = getCountry(country);
  const nz = (s?: string | null) => (s ?? "").trim().length > 0;
  const emailV = validateEmail(g.email ?? "");
  const webV = validateWebsite(g.website ?? "");
  const mobileV = validateRule(g.mobile ?? "", c.mobile);
  const phoneV = validateRule(g.phone ?? "", c.phone);
  const taxV = validateRule(g.tax_no ?? "", c.tax);
  const crV = validateRule(g.cr_no ?? "", c.cr);
  return [
    { key: "name",    weight: 20, filled: nz(g.name),       valid: nz(g.name),       required: true },
    { key: "name_ar", weight: 20, filled: nz(g.name_ar),    valid: nz(g.name_ar),    required: true },
    { key: "country", weight: 5,  filled: nz(country),      valid: nz(country),      required: true },
    { key: "logo",    weight: 10, filled: nz(g.logo_url),   valid: nz(g.logo_url) },
    { key: "mobile",  weight: 12, filled: nz(g.mobile),     valid: nz(g.mobile) && mobileV.ok },
    { key: "email",   weight: 8,  filled: nz(g.email),      valid: nz(g.email) && emailV.ok },
    { key: "tax_no",  weight: 8,  filled: nz(g.tax_no),     valid: nz(g.tax_no) && taxV.ok },
    { key: "cr_no",   weight: 5,  filled: nz(g.cr_no),      valid: nz(g.cr_no) && crV.ok },
    { key: "phone",   weight: 4,  filled: nz(g.phone),      valid: nz(g.phone) && phoneV.ok },
    { key: "website", weight: 4,  filled: nz(g.website),    valid: nz(g.website) && webV.ok },
    { key: "short",   weight: 4,  filled: nz(g.short_name), valid: nz(g.short_name) },
  ];
}

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
    country: "EG", city: "", state: "", postal_code: "", address: "",
    default_language: "ar", timezone: "Africa/Cairo", date_format: "DD/MM/YYYY", number_format: "#,##0.00",
    base_currency: "EGP", fiscal_year_start: `${new Date().getFullYear()}-01-01`, fiscal_year_end: `${new Date().getFullYear()}-12-31`,
    gm_name: "", purchasing_manager: "", sales_manager: "", finance_manager: "", notes: "",
  });
  const [features, setFeatures] = useState<CompanyFeatures>(d?.features ?? DEFAULT_FEATURES);
  const [numbering, setNumbering] = useState<NumberingRow[]>(d?.numbering ?? DEFAULT_NUMBERING);
  const [logoUploading, setLogoUploading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (step === "done") return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, general, advanced, features, numbering }));
    } catch { /* ignore */ }
  }, [step, general, advanced, features, numbering]);

  async function resetAll() {
    const ok = await confirm({
      title: lang === "ar" ? "البدء من جديد؟" : "Start over?",
      description: lang === "ar" ? "هيتم مسح كل البيانات اللى دخلتها فى المعالج." : "All data entered in the wizard will be cleared.",
      confirmText: lang === "ar" ? "نعم، ابدأ من جديد" : "Yes, start over",
      variant: "destructive",
    });
    if (!ok) return;
    clearDraft();
    setStep("welcome");
    setShowErrors(false);
    setGeneral({ name: "", name_ar: "", short_name: "", code: "", tax_no: "", cr_no: "", vat_no: "", email: "", phone: "", mobile: "", website: "", logo_url: "" });
    setAdvanced({
      country: "EG", city: "", state: "", postal_code: "", address: "",
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

  const weights = useMemo(
    () => computeGeneralWeights(general, advanced.country ?? "EG"),
    [general, advanced.country],
  );
  const completion = useMemo(() => {
    const total = weights.reduce((a, w) => a + w.weight, 0);
    const done = weights.reduce((a, w) => a + (w.valid ? w.weight : 0), 0);
    return Math.round((done / total) * 100);
  }, [weights]);

  const requiredMissing = weights.filter((w) => w.required && !w.valid);

  function validateStep(s: number): string | null {
    if (s === 1) {
      if (requiredMissing.length > 0) {
        return T("لازم تكمل الحقول المطلوبة (المميزة بنجمة حمراء).", "Please complete the required fields (marked with a red asterisk).");
      }
      // If user entered any optional structured field, it must be valid
      const c = getCountry(advanced.country ?? "EG");
      const checks: Array<[string, FieldValidation]> = [
        ["email", validateEmail(general.email ?? "")],
        ["website", validateWebsite(general.website ?? "")],
        ["mobile", validateRule(general.mobile ?? "", c.mobile)],
        ["phone", validateRule(general.phone ?? "", c.phone)],
        ["tax_no", validateRule(general.tax_no ?? "", c.tax)],
        ["cr_no", validateRule(general.cr_no ?? "", c.cr)],
      ];
      const bad = checks.find(([, r]) => !r.ok);
      if (bad) return isAr ? bad[1].error!.ar : bad[1].error!.en;
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
    setShowErrors(true);
    const err = validateStep(currentIdx);
    if (err) { toast.error(err); return; }
    setShowErrors(false);
    if (currentIdx < 4) setStep((currentIdx + 1) as Step);
  }
  function back() {
    if (currentIdx > 1) setStep((currentIdx - 1) as Step);
    else setStep("welcome");
  }

  async function handleLogo(file: File) {
    if (!file.type.startsWith("image/")) { toast.error(T("لازم تختار صورة", "Please choose an image")); return; }
    if (file.size > 3 * 1024 * 1024) { toast.error(T("الحجم أكبر من 3MB", "File is larger than 3MB")); return; }
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
    setShowErrors(true);
    for (const s of [1, 2, 3, 4]) {
      const err = validateStep(s);
      if (err) { toast.error(err); setStep(s as Step); return; }
    }
    try {
      // Auto-generate company code if user hasn't set one
      const payloadGeneral = { ...general, code: general.code?.trim() || generateCompanyCode(general.name || general.short_name || "") };
      // Auto-align regional settings from country
      const c = getCountry(advanced.country ?? "EG");
      const payloadAdvanced = {
        ...advanced,
        base_currency: advanced.base_currency || c.currency,
        timezone: advanced.timezone || c.timezone,
      };
      await createMut.mutateAsync({ general: payloadGeneral, advanced: payloadAdvanced, features, numbering });
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
              <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur grid place-items-center"><Gem className="h-6 w-6" /></div>
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
            <div className="space-y-2">
              <Button size="lg" className="w-full h-12 text-base" onClick={() => setStep(d ? (typeof d.step === "number" ? d.step : 1) : 1)}>
                {d && typeof d.step === "number" ? T("متابعة الإعداد", "Continue Setup") : T("إنشاء الشركة", "Create Company")}
                {isAr ? <ArrowLeft className="ms-2 h-5 w-5" /> : <ArrowRight className="ms-2 h-5 w-5" />}
              </Button>
              {d && typeof d.step === "number" && (
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={resetAll}>
                  <RotateCcw className="h-3.5 w-3.5 me-1.5" />
                  {T("البدء من جديد", "Start over")}
                </Button>
              )}
            </div>
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
  const staticProgress = typeof step === "number" ? (step / 4) * 100 : 0;
  return (
    <div className="min-h-screen bg-muted/30 py-6 md:py-10 px-3 sm:px-4" dir={dir}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground grid place-items-center"><Gem className="h-5 w-5" /></div>
          <div>
            <div className="font-display font-bold">EEC ERP</div>
            <div className="text-xs text-muted-foreground">{T("معالج إعداد الشركة", "Company Setup Wizard")}</div>
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-card border rounded-2xl p-3 sm:p-4 md:p-5">
          <div className="flex items-center justify-between gap-1 sm:gap-2">
            {tabs.map((t, i) => {
              const active = t.id === currentIdx;
              const done = t.id < currentIdx;
              const Icon = t.icon;
              return (
                <div key={t.id} className="flex-1 flex items-center min-w-0">
                  <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                    <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full grid place-items-center transition-all ${
                      done ? "bg-primary text-primary-foreground" :
                      active ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <div className={`hidden sm:block text-[11px] md:text-xs font-medium truncate text-center max-w-[120px] ${active ? "text-foreground" : "text-muted-foreground"}`}>
                      {t.label}
                    </div>
                  </div>
                  {i < tabs.length - 1 && <div className={`h-0.5 flex-1 mx-1 ${done ? "bg-primary" : "bg-muted"}`} />}
                </div>
              );
            })}
          </div>
          <div className="mt-4 h-1 bg-muted rounded overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${staticProgress}%` }} />
          </div>
        </div>

        <Card>
          <CardContent className="p-4 sm:p-6 md:p-8 space-y-6">
            {step === 1 && (
              <StepGeneral
                general={general} setGeneral={setGeneral}
                country={advanced.country ?? "EG"}
                setCountry={(v) => setAdvanced((a) => {
                  const c = getCountry(v);
                  return { ...a, country: v, base_currency: c.currency, timezone: c.timezone };
                })}
                T={T} isAr={isAr}
                onLogoFile={handleLogo} logoUploading={logoUploading}
                completion={completion} weights={weights}
                showErrors={showErrors}
              />
            )}
            {step === 2 && <StepAdvanced advanced={advanced} setAdvanced={setAdvanced} T={T} />}
            {step === 3 && <StepFeatures features={features} setFeatures={setFeatures} T={T} />}
            {step === 4 && <StepNumbering numbering={numbering} setNumbering={setNumbering} T={T} />}
          </CardContent>
        </Card>

        {/* Nav */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={back} disabled={createMut.isPending}>
              {isAr ? <ArrowRight className="me-2 h-4 w-4" /> : <ArrowLeft className="me-2 h-4 w-4" />}
              {T("رجوع", "Back")}
            </Button>
            <Button variant="ghost" size="sm" onClick={resetAll} disabled={createMut.isPending} className="text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5 me-1.5" />
              {T("البدء من جديد", "Start over")}
            </Button>
          </div>
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

// ---------------- Reusable field with inline validation ----------------

function SmartField({
  label, icon: Icon, required, hint, error, children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span>{label}</span>
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error ? (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
        </div>
      ) : hint ? (
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

// ---------------- STEP 1 — General (CV-like layout, weighted progress) ----------------

function StepGeneral({
  general, setGeneral, country, setCountry, T, isAr, onLogoFile, logoUploading, completion, weights, showErrors,
}: {
  general: CompanyGeneral;
  setGeneral: React.Dispatch<React.SetStateAction<CompanyGeneral>>;
  country: string;
  setCountry: (v: string) => void;
  T: (ar: string, en: string) => string;
  isAr: boolean;
  onLogoFile: (f: File) => void;
  logoUploading: boolean;
  completion: number;
  weights: Weight[];
  showErrors: boolean;
}) {
  const c = getCountry(country);
  const set = <K extends keyof CompanyGeneral>(k: K) => (v: string) => setGeneral((g) => ({ ...g, [k]: v }));

  // Live validations
  const emailV = validateEmail(general.email ?? "");
  const webV = validateWebsite(general.website ?? "");
  const mobileV = validateRule(general.mobile ?? "", c.mobile);
  const phoneV = validateRule(general.phone ?? "", c.phone);
  const taxV = validateRule(general.tax_no ?? "", c.tax);
  const crV = validateRule(general.cr_no ?? "", c.cr);

  const err = (v: FieldValidation, forceShow = false) =>
    (showErrors || forceShow) && !v.ok ? (isAr ? v.error?.ar : v.error?.en) : undefined;
  const reqErr = (val: string | null | undefined, msgAr: string, msgEn: string) =>
    showErrors && !(val ?? "").trim() ? T(msgAr, msgEn) : undefined;

  // Auto-format on change for masked fields
  const onMobile = (v: string) => set("mobile")(c.mobile ? applyMask(v, c.mobile) : v);
  const onPhone = (v: string) => set("phone")(c.phone ? applyMask(v, c.phone) : v);
  const onTax = (v: string) => set("tax_no")(c.tax ? applyMask(v, c.tax) : v);
  const onCr = (v: string) => set("cr_no")(c.cr ? applyMask(v, c.cr) : v);

  return (
    <div className="space-y-6">
      {/* Header + smart progress */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold">{T("بطاقة الشركة", "Company Profile")}</h3>
            <p className="text-sm text-muted-foreground">
              {T("املأ البيانات الأساسية للشركة. المطلوب فقط الاسم (عربى وإنجليزى) والدولة.",
                 "Fill the company's basic profile. Only company name (AR + EN) and country are required.")}
            </p>
          </div>
          <div className="rounded-xl bg-muted/60 border px-3 py-2 min-w-[180px]">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{T("اكتمال البيانات", "Profile completeness")}</span>
              <span className="font-semibold text-foreground">{completion}%</span>
            </div>
            <div className="mt-2 h-1.5 bg-background rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${completion === 100 ? "bg-emerald-500" : completion >= 60 ? "bg-primary" : "bg-amber-500"}`}
                style={{ width: `${completion}%` }}
              />
            </div>
            <div className="mt-1.5 text-[10px] text-muted-foreground">
              {completion === 100
                ? T("ممتاز! كل شى مكتمل", "Excellent — profile is complete")
                : T("الحقول المهمة بتزود النسبة أكتر", "Important fields contribute more")}
            </div>
          </div>
        </div>
      </div>

      {/* CV-style header: logo + names + country */}
      <div className="rounded-2xl border bg-gradient-to-br from-muted/40 to-transparent p-4 sm:p-6">
        <div className="flex flex-col items-center text-center gap-4 sm:gap-5">
          <label className="relative group cursor-pointer">
            <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-background grid place-items-center overflow-hidden group-hover:border-primary/60 transition-colors">
              {logoUploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : general.logo_url ? (
                <img src={general.logo_url} alt="logo" className="h-full w-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <ImagePlus className="h-7 w-7" />
                  <span className="text-[10px] font-medium">{T("اللوجو", "Logo")}</span>
                </div>
              )}
            </div>
            <div className="absolute inset-0 rounded-2xl bg-primary/0 group-hover:bg-primary/5 transition-colors" />
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onLogoFile(e.target.files[0])} />
            <div className="mt-2 text-[11px] text-muted-foreground">{T("انقر للتغيير", "Click to change")}</div>
          </label>

          <div className="w-full max-w-2xl grid sm:grid-cols-2 gap-3 text-start">
            <SmartField
              label={T("الاسم بالإنجليزى", "Company Name (English)")}
              required
              icon={Building2}
              hint={T("هيظهر فى التقارير الإنجليزى", "Used in English reports")}
              error={reqErr(general.name, "الاسم الإنجليزى مطلوب", "English name is required")}
            >
              <Input dir="ltr" value={general.name} onChange={(e) => set("name")(e.target.value)} autoFocus placeholder="Egyptian Europe Company" />
            </SmartField>
            <SmartField
              label={T("الاسم بالعربى", "Company Name (Arabic)")}
              required
              icon={Building2}
              hint={T("هيظهر فى التقارير العربى", "Used in Arabic reports")}
              error={reqErr(general.name_ar, "الاسم العربى مطلوب", "Arabic name is required")}
            >
              <Input dir="rtl" value={general.name_ar ?? ""} onChange={(e) => set("name_ar")(e.target.value)} placeholder="الشركة المصرية الأوروبية" />
            </SmartField>
            <SmartField
              label={T("الدولة", "Country")}
              required
              icon={MapPin}
              hint={T("بتحدد فورمات الأرقام والعملة", "Determines number formats & currency")}
            >
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((cc) => (
                    <SelectItem key={cc.code} value={cc.code}>{isAr ? cc.labelAr : cc.labelEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SmartField>
            <SmartField
              label={T("الاسم المختصر", "Short Name")}
              hint={T("اختيارى — بيظهر فى الشريط الجانبى", "Optional — appears in the sidebar")}
            >
              <Input value={general.short_name ?? ""} onChange={(e) => set("short_name")(e.target.value)} placeholder="EEC" />
            </SmartField>
          </div>
        </div>
      </div>

      {/* Contact block */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{T("بيانات الاتصال", "Contact")}</h4>
        <div className="grid md:grid-cols-2 gap-4">
          <SmartField
            label={T("موبايل", "Mobile")}
            icon={Smartphone}
            hint={c.mobile ? (isAr ? c.mobile.hintAr : c.mobile.hintEn) : undefined}
            error={err(mobileV)}
          >
            <Input
              dir="ltr"
              value={general.mobile ?? ""}
              onChange={(e) => onMobile(e.target.value)}
              placeholder={c.mobile?.example}
              inputMode="tel"
            />
          </SmartField>
          <SmartField
            label={T("البريد الإلكتروني", "Email")}
            icon={Mail}
            hint={T("بريد رسمي للشركة", "Official company email")}
            error={err(emailV)}
          >
            <Input dir="ltr" type="email" value={general.email ?? ""} onChange={(e) => set("email")(e.target.value)} placeholder="info@company.com" />
          </SmartField>
          <SmartField
            label={T("تليفون أرضى", "Landline Phone")}
            icon={Phone}
            hint={c.phone ? (isAr ? c.phone.hintAr : c.phone.hintEn) : T("اختيارى", "Optional")}
            error={err(phoneV)}
          >
            <Input dir="ltr" value={general.phone ?? ""} onChange={(e) => onPhone(e.target.value)} placeholder={c.phone?.example} inputMode="tel" />
          </SmartField>
          <SmartField
            label={T("الموقع الإلكتروني", "Website")}
            icon={Globe}
            hint={T("اختيارى — لازم يكون رابط صحيح", "Optional — must be a valid URL")}
            error={err(webV)}
          >
            <Input dir="ltr" value={general.website ?? ""} onChange={(e) => set("website")(e.target.value)} placeholder="https://company.com" />
          </SmartField>
        </div>
      </div>

      {/* Legal block */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{T("البيانات القانونية", "Legal & Tax")}</h4>
        <div className="grid md:grid-cols-2 gap-4">
          <SmartField
            label={T("الرقم الضريبي", "Tax Registration No.")}
            icon={Receipt}
            hint={c.tax ? (isAr ? c.tax.hintAr : c.tax.hintEn) : T("اختيارى", "Optional")}
            error={err(taxV)}
          >
            <Input dir="ltr" value={general.tax_no ?? ""} onChange={(e) => onTax(e.target.value)} placeholder={c.tax?.example} />
          </SmartField>
          <SmartField
            label={T("السجل التجارى", "Commercial Registration")}
            icon={FileText}
            hint={c.cr ? (isAr ? c.cr.hintAr : c.cr.hintEn) : T("اختيارى", "Optional")}
            error={err(crV)}
          >
            <Input dir="ltr" value={general.cr_no ?? ""} onChange={(e) => onCr(e.target.value)} placeholder={c.cr?.example} />
          </SmartField>
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg p-3 border">
        {T("ملاحظة: كود الشركة هيتولّد تلقائيًا من الاسم — تقدر تعدّله بعد كده من إعدادات الشركة. الكود بيتستخدم كبادئة داخلية للمستندات وسهولة التعريف.",
           "Note: The company code is auto-generated from the name — you can change it later from company settings. The code is used as an internal prefix for documents and quick identification.")}
      </div>
    </div>
  );
}

// ---------------- STEP 2 — Advanced ----------------

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
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
        <p className="text-sm text-muted-foreground">{T("العنوان والإعدادات الإقليمية والمالية (اختيارى — تقدر تكملها بعدين).", "Address, regional and financial settings (optional — you can complete later).")}</p>
      </div>

      <Section title={T("العنوان", "Address")}>
        <Field label={T("المدينة", "City")}><Input value={advanced.city ?? ""} onChange={set("city")} /></Field>
        <Field label={T("المحافظة", "State")}><Input value={advanced.state ?? ""} onChange={set("state")} /></Field>
        <Field label={T("الرمز البريدي", "Postal Code")}><Input value={advanced.postal_code ?? ""} onChange={set("postal_code")} /></Field>
        <div />
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
              <SelectItem value="KWD">KWD - Kuwaiti Dinar</SelectItem>
              <SelectItem value="QAR">QAR - Qatari Riyal</SelectItem>
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
