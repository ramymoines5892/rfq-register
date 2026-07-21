import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hasAnyCompany, pickPrimary, uploadCompanyLogo, type CompanyAdvanced, type CompanyFeatures, type CompanyGeneral, type ContactEntry, type NumberingRow, type SetupDocument } from "@/features/company/api";
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
import { Building2, Sparkles, Settings2, Hash, CheckCircle2, ArrowRight, ArrowLeft, Upload, Loader2, Gem, RotateCcw, AlertCircle, ImagePlus, Mail, Phone, Smartphone, Globe, MapPin, FileText, Receipt, FolderOpen, Plus, Trash2, Paperclip, CalendarDays, Info, Star, Printer, X } from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";
import { COUNTRIES, applyMask, generateCompanyCode, getCountry, validateEmail, validateRule, validateWebsite, type FieldValidation } from "@/lib/countryFormats";
import { DOC_PRESETS, slugifyCode, type DocPreset } from "@/lib/companyDocPresets";
import { filterArabic, filterEnglish } from "@/lib/textFilters";
import { ScriptInput } from "@/components/ScriptInput";


const DRAFT_KEY = "eec.setup.draft.v1";

type PersistedDoc = Omit<SetupDocument, "file"> & { file_name?: string | null };

type Draft = {
  step: Step;
  general: CompanyGeneral;
  advanced: CompanyAdvanced;
  features: CompanyFeatures;
  numbering: NumberingRow[];
  documents: PersistedDoc[];
  logo?: { name: string; type: string; dataUrl: string } | null;
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

function computeGeneralWeights(g: CompanyGeneral, country: string, docsCount: number = 0, hasLogo: boolean = false): Weight[] {
  const c = getCountry(country);
  const nz = (s?: string | null) => (s ?? "").trim().length > 0;
  const primaryEmail = pickPrimary(g.emails) ?? g.email ?? "";
  const primaryMobile = pickPrimary(g.mobiles) ?? g.mobile ?? "";
  const primaryPhone = pickPrimary(g.phones) ?? g.phone ?? "";
  const emailV = validateEmail(primaryEmail);
  const primaryWebsite = pickPrimary(g.websites) ?? g.website ?? "";
  const webV = validateWebsite(primaryWebsite);
  const mobileV = validateRule(primaryMobile, c.mobile);
  const phoneV = validateRule(primaryPhone, c.phone);
  return [
    { key: "name",    weight: 20, filled: nz(g.name),       valid: nz(g.name),       required: true },
    { key: "name_ar", weight: 20, filled: nz(g.name_ar),    valid: nz(g.name_ar),    required: true },
    { key: "country", weight: 5,  filled: nz(country),      valid: nz(country),      required: true },
    { key: "logo",    weight: 10, filled: hasLogo || nz(g.logo_url), valid: hasLogo || nz(g.logo_url) },
    { key: "mobile",  weight: 12, filled: nz(primaryMobile),valid: nz(primaryMobile) && mobileV.ok },
    { key: "email",   weight: 8,  filled: nz(primaryEmail), valid: nz(primaryEmail) && emailV.ok },
    { key: "docs",    weight: 13, filled: docsCount > 0,    valid: docsCount > 0 },
    { key: "phone",   weight: 4,  filled: nz(primaryPhone), valid: nz(primaryPhone) && phoneV.ok },
    { key: "website", weight: 4,  filled: nz(primaryWebsite), valid: nz(primaryWebsite) && webV.ok },
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
    tax_no: "", cr_no: "", vat_no: "",
    email: "", phone: "", mobile: "", fax: "", website: "", logo_url: "",
    emails: [], phones: [], mobiles: [], faxes: [], websites: [],
  });
  const [advanced, setAdvanced] = useState<CompanyAdvanced>(d?.advanced ?? {
    country: "EG", city: "", state: "", postal_code: "", address: "",
    default_language: "ar", timezone: "Africa/Cairo", date_format: "DD/MM/YYYY", number_format: "#,##0.00",
    base_currency: "EGP", fiscal_year_start: `${new Date().getFullYear()}-01-01`, fiscal_year_end: `${new Date().getFullYear()}-12-31`,
    gm_name: "", purchasing_manager: "", sales_manager: "", finance_manager: "", notes: "",
  });
  const [features, setFeatures] = useState<CompanyFeatures>(d?.features ?? DEFAULT_FEATURES);
  const [numbering, setNumbering] = useState<NumberingRow[]>(d?.numbering ?? DEFAULT_NUMBERING);
  const [documents, setDocuments] = useState<SetupDocument[]>(
    (d?.documents ?? []).map((pd) => ({ ...pd, file: null } as SetupDocument)),
  );
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(() => {
    const lg = d?.logo;
    if (!lg?.dataUrl) return null;
    try {
      const [meta, b64] = lg.dataUrl.split(",");
      const mime = /data:(.*?);base64/.exec(meta)?.[1] ?? lg.type;
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new File([arr], lg.name, { type: mime });
    } catch { return null; }
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(d?.logo?.dataUrl ?? null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(d?.logo?.dataUrl ?? null);
  useEffect(() => {
    if (!logoFile) { setLogoPreview(null); setLogoDataUrl(null); return; }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    // Also read as data URL so the pick survives reloads / step navigation persistence.
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") setLogoDataUrl(reader.result); };
    reader.readAsDataURL(logoFile);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (step === "done") return;
    try {
      const persistedDocs: PersistedDoc[] = documents.map((doc) => {
        const { file, ...rest } = doc;
        return { ...rest, file_name: file?.name ?? null };
      });
      const logo = logoFile && logoDataUrl
        ? { name: logoFile.name, type: logoFile.type, dataUrl: logoDataUrl }
        : null;
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ step, general, advanced, features, numbering, documents: persistedDocs, logo }),
      );
    } catch { /* ignore — likely quota exceeded */ }
  }, [step, general, advanced, features, numbering, documents, logoFile, logoDataUrl]);


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
    setGeneral({ name: "", name_ar: "", short_name: "", code: "", tax_no: "", cr_no: "", vat_no: "", email: "", phone: "", mobile: "", fax: "", website: "", logo_url: "", emails: [], phones: [], mobiles: [], faxes: [], websites: [] });
    setAdvanced({
      country: "EG", city: "", state: "", postal_code: "", address: "",
      default_language: "ar", timezone: "Africa/Cairo", date_format: "DD/MM/YYYY", number_format: "#,##0.00",
      base_currency: "EGP", fiscal_year_start: `${new Date().getFullYear()}-01-01`, fiscal_year_end: `${new Date().getFullYear()}-12-31`,
      gm_name: "", purchasing_manager: "", sales_manager: "", finance_manager: "", notes: "",
    });
    setFeatures(DEFAULT_FEATURES);
    setNumbering(DEFAULT_NUMBERING);
    setDocuments([]);
    setLogoFile(null);

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
    () => computeGeneralWeights(general, advanced.country ?? "EG", documents.length, !!logoFile),
    [general, advanced.country, documents.length, logoFile],
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
      const primaryEmail = pickPrimary(general.emails) ?? general.email ?? "";
      const primaryMobile = pickPrimary(general.mobiles) ?? general.mobile ?? "";
      const primaryPhone = pickPrimary(general.phones) ?? general.phone ?? "";
      // Validate every entered contact (not only the primary)
      const allEmails = [primaryEmail, ...(general.emails ?? []).map((e) => e.value)].filter(Boolean);
      const allMobiles = [primaryMobile, ...(general.mobiles ?? []).map((e) => e.value)].filter(Boolean);
      const allPhones = [primaryPhone, ...(general.phones ?? []).map((e) => e.value)].filter(Boolean);
      for (const v of allEmails) {
        const r = validateEmail(v);
        if (!r.ok) return isAr ? r.error!.ar : r.error!.en;
      }
      for (const v of allMobiles) {
        const r = validateRule(v, c.mobile);
        if (!r.ok) return isAr ? r.error!.ar : r.error!.en;
      }
      for (const v of allPhones) {
        const r = validateRule(v, c.phone);
        if (!r.ok) return isAr ? r.error!.ar : r.error!.en;
      }
      const allWebsites = [...(general.websites ?? []).map((e) => e.value), general.website ?? ""].filter(Boolean);
      for (const v of allWebsites) {
        const r = validateWebsite(v);
        if (!r.ok) return isAr ? r.error!.ar : r.error!.en;
      }
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

  function handleLogo(file: File) {
    if (!file.type.startsWith("image/")) { toast.error(T("لازم تختار صورة", "Please choose an image")); return; }
    if (file.size > 3 * 1024 * 1024) { toast.error(T("الحجم أكبر من 3MB", "File is larger than 3MB")); return; }
    setLogoFile(file);
    // Clear any previously uploaded URL — new pick replaces it and we defer upload to save.
    setGeneral((g) => ({ ...g, logo_url: "" }));
  }
  function clearLogo() {
    setLogoFile(null);
    setGeneral((g) => ({ ...g, logo_url: "" }));
  }

  async function submit() {
    setShowErrors(true);
    for (const s of [1, 2, 3, 4]) {
      const err = validateStep(s);
      if (err) { toast.error(err); setStep(s as Step); return; }
    }
    try {
      // Upload logo now (deferred from the wizard) if a new file was picked.
      let logoUrl = general.logo_url ?? "";
      if (logoFile) {
        setLogoUploading(true);
        try {
          logoUrl = await uploadCompanyLogo(logoFile);
        } catch (e: any) {
          toast.error(e?.message ?? T("فشل رفع اللوجو", "Failed to upload logo"));
          setLogoUploading(false);
          return;
        }
        setLogoUploading(false);
      }
      // Auto-generate company code if user hasn't set one
      const payloadGeneral = { ...general, logo_url: logoUrl, code: general.code?.trim() || generateCompanyCode(general.name || general.short_name || "") };
      // Auto-align regional settings from country
      const c = getCountry(advanced.country ?? "EG");
      const payloadAdvanced = {
        ...advanced,
        base_currency: advanced.base_currency || c.currency,
        timezone: advanced.timezone || c.timezone,
      };
      await createMut.mutateAsync({ general: payloadGeneral, advanced: payloadAdvanced, features, numbering, documents });
      clearDraft();
      // Sign the bootstrap user out so they log in fresh into the newly-created company.
      await supabase.auth.signOut().catch(() => {});
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
              {T("تم إعداد شركتك بنجاح. سجّل الدخول بالإيميل وكلمة المرور للدخول إلى النظام.",
                 "Your company was created successfully. Sign in with your email and password to enter the system.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" className="w-full h-12" onClick={() => navigate({ to: "/auth" })}>
              {T("الانتقال إلى تسجيل الدخول", "Go to Sign In")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stepErr = validateStep(currentIdx);
  const canProceed = !stepErr;
  const currentTab = tabs.find((t) => t.id === currentIdx);
  const staticProgress = typeof step === "number" ? (step / 4) * 100 : 0;

  return (
    <div className="min-h-screen bg-muted/30" dir={dir}>
      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center shrink-0">
            <Gem className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display font-bold text-sm sm:text-base leading-tight">EEC ERP</div>
            <div className="text-[11px] text-muted-foreground truncate">{T("معالج إعداد الشركة", "Company Setup Wizard")}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setLang(isAr ? "en" : "ar")} className="shrink-0">
            {isAr ? "EN" : "AR"}
          </Button>
        </div>
        {/* Slim progress line */}
        <div className="h-1 bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${staticProgress}%` }} />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-5 md:py-8 space-y-5 md:space-y-6">
        {/* Stepper */}
        <nav aria-label={T("خطوات الإعداد", "Setup steps")} className="bg-card border rounded-2xl p-3 sm:p-4">
          <ol className="flex items-center gap-1 sm:gap-2">
            {tabs.map((t, i) => {
              const active = t.id === currentIdx;
              const done = t.id < currentIdx;
              const Icon = t.icon;
              return (
                <li key={t.id} className="flex-1 flex items-center min-w-0">
                  <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                    <div className={`h-9 w-9 sm:h-11 sm:w-11 rounded-full grid place-items-center transition-all shrink-0 ${
                      done ? "bg-primary text-primary-foreground shadow-sm" :
                      active ? "bg-primary text-primary-foreground ring-4 ring-primary/15 scale-110" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <div className={`hidden sm:block text-[11px] md:text-xs font-medium truncate text-center max-w-[130px] ${active ? "text-foreground" : "text-muted-foreground"}`}>
                      {t.label}
                    </div>
                  </div>
                  {i < tabs.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 rounded-full transition-colors ${done ? "bg-primary" : "bg-muted"}`} />
                  )}
                </li>
              );
            })}
          </ol>
          {/* Mobile-only current step label */}
          <div className="sm:hidden mt-3 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{T("الخطوة", "Step")} {currentIdx}/4</span>
            <span className="font-semibold text-foreground truncate ms-2">{currentTab?.label}</span>
          </div>
        </nav>

        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-4 sm:p-6 md:p-8 lg:p-10 space-y-6 md:space-y-8">
            {step === 1 && (
              <StepGeneral
                general={general} setGeneral={setGeneral}
                country={advanced.country ?? "EG"}
                setCountry={(v) => setAdvanced((a) => {
                  const c = getCountry(v);
                  return { ...a, country: v, base_currency: c.currency, timezone: c.timezone };
                })}
                T={T} isAr={isAr}
                onLogoFile={handleLogo} logoUploading={logoUploading} logoPreview={logoPreview} clearLogo={clearLogo}
                completion={completion} weights={weights}
                showErrors={showErrors}
                documents={documents} setDocuments={setDocuments}
              />
            )}
            {step === 2 && <StepAdvanced advanced={advanced} setAdvanced={setAdvanced} T={T} />}
            {step === 3 && <StepFeatures features={features} setFeatures={setFeatures} T={T} />}
            {step === 4 && <StepNumbering numbering={numbering} setNumbering={setNumbering} T={T} />}
          </CardContent>
        </Card>

        {/* Nav */}
        <div className="sticky bottom-0 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 py-3 bg-background/85 backdrop-blur-md border-t">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={back} disabled={createMut.isPending} className="h-10">
                {isAr ? <ArrowRight className="me-2 h-4 w-4" /> : <ArrowLeft className="me-2 h-4 w-4" />}
                {T("رجوع", "Back")}
              </Button>
              <Button variant="ghost" size="sm" onClick={resetAll} disabled={createMut.isPending} className="text-muted-foreground hidden sm:inline-flex">
                <RotateCcw className="h-3.5 w-3.5 me-1.5" />
                {T("البدء من جديد", "Start over")}
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {stepErr && showErrors && (
                <div className="text-[11px] text-destructive flex items-center gap-1 max-w-[220px] truncate">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{stepErr}</span>
                </div>
              )}
              {currentIdx < 4 ? (
                <Button onClick={next} className="h-10 min-w-[110px]" disabled={createMut.isPending}>
                  {T("التالي", "Next")}
                  {isAr ? <ArrowLeft className="ms-2 h-4 w-4" /> : <ArrowRight className="ms-2 h-4 w-4" />}
                </Button>
              ) : (
                <Button onClick={submit} disabled={createMut.isPending || !canProceed} className="h-10 min-w-[140px]">
                  {createMut.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  {T("إنشاء الشركة", "Create Company")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Reusable field with inline validation ----------------

function SectionHeader({
  n, title, T, right,
}: {
  n: number;
  title: string;
  T: (ar: string, en: string) => string;
  right?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-bold grid place-items-center shrink-0 tabular-nums">
          {n}
        </div>
        <h4 className="text-sm sm:text-base font-semibold tracking-tight truncate">{title}</h4>
      </div>
      {right}
    </div>
  );
}

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

// ---------------- Multi-contact editor (email / phone / mobile / fax) ----------------

function MultiContactField({
  label, icon: Icon, values, onChange, placeholder, hint, format, validate, isAr, T, showErrors,
  type, inputMode,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  values: ContactEntry[];
  onChange: (list: ContactEntry[]) => void;
  placeholder?: string;
  hint?: string;
  format?: (v: string) => string;
  validate?: (v: string) => FieldValidation;
  isAr: boolean;
  T: (ar: string, en: string) => string;
  showErrors?: boolean;
  type?: "text" | "email";
  inputMode?: "tel" | "text" | "email";
}) {
  const list = values.length ? values : [{ value: "", label: "", is_primary: true }];
  const update = (idx: number, patch: Partial<ContactEntry>) => {
    const next = list.map((e, i) => (i === idx ? { ...e, ...patch } : e));
    onChange(next.filter((_, i) => i < next.length));
  };
  const setPrimary = (idx: number) => {
    onChange(list.map((e, i) => ({ ...e, is_primary: i === idx })));
  };
  const add = () => {
    const next = [...list, { value: "", label: "", is_primary: false }];
    if (!next.some((e) => e.is_primary)) next[0].is_primary = true;
    onChange(next);
  };
  // Blocked when any existing entry is empty or fails validation.
  const anyInvalid = list.some((e) => {
    const v = (e.value ?? "").trim();
    if (!v) return true;
    if (!validate) return false;
    return !validate(v).ok;
  });
  const remove = (idx: number) => {
    const next = list.filter((_, i) => i !== idx);
    if (next.length && !next.some((e) => e.is_primary)) next[0].is_primary = true;
    onChange(next);
  };
  return (
    <div className="space-y-1.5">
      <Label className="text-sm flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{label}</span>
      </Label>
      <div className="space-y-2">
        {list.map((entry, idx) => {
          const trimmed = (entry.value ?? "").trim();
          const v = trimmed ? validate?.(trimmed) : undefined;
          // Show empty-error when there's more than one entry — prevents the
          // cheat: fill first → add another → clear the first.
          let error: string | undefined;
          if (!trimmed && list.length > 1) {
            error = T("لازم تملأ ده أو تحذفه", "Fill this or remove it");
          } else if (v && !v.ok && (trimmed || showErrors)) {
            error = isAr ? v.error?.ar : v.error?.en;
          }
          return (
            <div key={idx} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPrimary(idx)}
                  title={T("تعيين كأساسى", "Set as primary")}
                  className={`shrink-0 h-9 w-9 grid place-items-center rounded-md border transition-colors ${
                    entry.is_primary ? "bg-primary/10 border-primary text-primary" : "border-input text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Star className={`h-4 w-4 ${entry.is_primary ? "fill-current" : ""}`} />
                </button>
                <Input
                  dir="ltr"
                  type={type ?? "text"}
                  inputMode={inputMode}
                  value={entry.value}
                  onChange={(e) => update(idx, { value: format ? format(e.target.value) : e.target.value })}
                  placeholder={placeholder}
                  className={`flex-1 ${error ? "border-destructive focus-visible:ring-destructive/40" : ""}`}
                />


                <button
                  type="button"
                  onClick={() => remove(idx)}
                  disabled={list.length <= 1 && !entry.value}
                  title={T("حذف", "Remove")}
                  className="shrink-0 h-9 w-9 grid place-items-center rounded-md border border-input text-muted-foreground hover:text-destructive hover:border-destructive disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {error && (
                <div className="ps-11 flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={add}
          disabled={anyInvalid}
          title={anyInvalid ? T("املأ القيمة السابقة أولاً", "Fill the previous entry first") : undefined}
          className="text-xs text-primary hover:underline flex items-center gap-1 disabled:text-muted-foreground disabled:hover:no-underline disabled:cursor-not-allowed"
        >
          <Plus className="h-3.5 w-3.5" />
          {T("إضافة", "Add another")}
        </button>
      </div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}


// ---------------- STEP 1 — General (CV-like layout, weighted progress) ----------------

function StepGeneral({
  general, setGeneral, country, setCountry, T, isAr, onLogoFile, logoUploading, logoPreview, clearLogo, completion, weights, showErrors,
  documents, setDocuments,
}: {
  general: CompanyGeneral;
  setGeneral: React.Dispatch<React.SetStateAction<CompanyGeneral>>;
  country: string;
  setCountry: (v: string) => void;
  T: (ar: string, en: string) => string;
  isAr: boolean;
  onLogoFile: (f: File) => void;
  logoUploading: boolean;
  logoPreview: string | null;
  clearLogo: () => void;
  completion: number;
  weights: Weight[];
  showErrors: boolean;
  documents: SetupDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<SetupDocument[]>>;
}) {
  const c = getCountry(country);
  const set = <K extends keyof CompanyGeneral>(k: K) => (v: CompanyGeneral[K]) => setGeneral((g) => ({ ...g, [k]: v }));

  // Live validations
  

  const err = (v: FieldValidation, forceShow = false) =>
    (showErrors || forceShow) && !v.ok ? (isAr ? v.error?.ar : v.error?.en) : undefined;
  const reqErr = (val: string | null | undefined, msgAr: string, msgEn: string) =>
    showErrors && !(val ?? "").trim() ? T(msgAr, msgEn) : undefined;

  // Detect scroll to collapse the completion header into a slim floating bar
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 140);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);


  const barColor = completion === 100 ? "bg-emerald-500" : completion >= 60 ? "bg-primary" : "bg-amber-500";

  return (
    <div className="space-y-8 md:space-y-10">
      {/* Sticky completion tracker — expanded at top, collapses to slim bar on scroll */}
      <div className="sticky top-[56px] z-20 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8">
        {scrolled ? (
          <div className="bg-background/95 backdrop-blur-md border rounded-full shadow-md px-4 py-2 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <span className="text-[11px] text-muted-foreground shrink-0">{T("الاكتمال", "Completeness")}</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[80px]">
              <div className={`h-full transition-all duration-500 ${barColor}`} style={{ width: `${completion}%` }} />
            </div>
            <span className="text-xs font-bold tabular-nums shrink-0">{completion}%</span>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between bg-background/60 backdrop-blur-sm rounded-xl py-2">
            <div className="min-w-0">
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight">{T("بطاقة الشركة", "Company Profile")}</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                {T("املأ البيانات الأساسية للشركة. الحقول المُميّزة بنجمة حمراء مطلوبة للانتقال للخطوة التالية.",
                   "Fill in the company profile. Fields marked with a red asterisk are required to continue.")}
              </p>
            </div>
            <div className="rounded-xl bg-muted/60 border px-3 py-2 min-w-[170px] shrink-0">
              <div className="flex items-center justify-between text-xs text-muted-foreground gap-3">
                <span>{T("الاكتمال", "Completeness")}</span>
                <span className="font-semibold text-foreground tabular-nums">{completion}%</span>
              </div>
              <div className="mt-2 h-1.5 bg-background rounded-full overflow-hidden">
                <div className={`h-full transition-all ${barColor}`} style={{ width: `${completion}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>


      {/* Section 1 — Identity */}
      <section className="space-y-4">
        <SectionHeader n={1} title={T("الهوية والعلامة", "Identity & Branding")} T={T} />
        <div className="rounded-2xl border bg-gradient-to-br from-muted/40 to-transparent p-4 sm:p-6 md:p-8">
          <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-8 items-start">
            <div className="relative justify-self-center md:justify-self-start">
              <label className="relative group cursor-pointer block">
                <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-background grid place-items-center overflow-hidden group-hover:border-primary/60 transition-colors">
                  {logoUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : (logoPreview || general.logo_url) ? (
                    <img src={logoPreview || general.logo_url!} alt="logo" className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <ImagePlus className="h-7 w-7" />
                      <span className="text-[10px] font-medium">{T("اللوجو", "Logo")}</span>
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 rounded-2xl bg-primary/0 group-hover:bg-primary/5 transition-colors pointer-events-none" />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onLogoFile(e.target.files[0])} />
                <div className="mt-2 text-[11px] text-muted-foreground text-center">
                  {(logoPreview || general.logo_url) ? T("انقر للتغيير", "Click to change") : T("انقر للرفع", "Click to upload")}
                </div>
              </label>
              {(logoPreview || general.logo_url) && !logoUploading && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearLogo(); }}
                  aria-label={T("حذف اللوجو", "Remove logo")}
                  className="absolute -top-2 -end-2 h-7 w-7 rounded-full bg-destructive text-destructive-foreground shadow-lg grid place-items-center hover:scale-110 transition-transform"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 min-w-0">
              <SmartField
                label={T("الاسم بالإنجليزى", "Company Name (English)")}
                required icon={Building2}
                hint={T("هيظهر فى التقارير الإنجليزى — إنجليزى فقط", "Used in English reports — English only")}
                error={reqErr(general.name, "الاسم الإنجليزى مطلوب", "English name is required")}
              >
                <ScriptInput script="en" isAr={isAr} className="h-11" value={general.name} onChange={set("name")} autoFocus placeholder="Egyptian Europe Company" />
              </SmartField>
              <SmartField
                label={T("الاسم بالعربى", "Company Name (Arabic)")}
                required icon={Building2}
                hint={T("هيظهر فى التقارير العربى — عربى فقط", "Used in Arabic reports — Arabic only")}
                error={reqErr(general.name_ar, "الاسم العربى مطلوب", "Arabic name is required")}
              >
                <ScriptInput script="ar" isAr={isAr} className="h-11" value={general.name_ar ?? ""} onChange={set("name_ar")} placeholder="الشركة المصرية الأوروبية" />
              </SmartField>
              <SmartField
                label={T("الدولة", "Country")} required icon={MapPin}
                hint={T("بتحدد فورمات الأرقام والعملة", "Determines number formats & currency")}
              >
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((cc) => (
                      <SelectItem key={cc.code} value={cc.code}>{isAr ? cc.labelAr : cc.labelEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SmartField>
              <SmartField
                label={T("الاسم المختصر (إنجليزى)", "Short Name (English)")}
                hint={T("اختيارى — بيظهر فى الشريط الجانبى — إنجليزى فقط", "Optional — appears in the sidebar — English only")}
              >
                <ScriptInput script="en" isAr={isAr} className="h-11" value={general.short_name ?? ""} onChange={set("short_name")} placeholder="EEC" />
              </SmartField>
            </div>

          </div>
        </div>
      </section>

      {/* Section 2 — Contact */}
      <section className="space-y-4">
        <SectionHeader
          n={2} title={T("بيانات الاتصال", "Contact Details")} T={T}
          right={
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Star className="h-3 w-3 fill-primary text-primary" />
              {T("النجمة = الأساسى", "Star = primary")}
            </div>
          }
        />

        {/* Card A — Phone numbers */}
        <div className="rounded-2xl border bg-gradient-to-br from-muted/40 to-transparent p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/60">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
              <Phone className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold">{T("أرقام الاتصال", "Phone Numbers")}</h4>
              <p className="text-[11px] text-muted-foreground">
                {T("الموبايل، الأرضى، والفاكس", "Mobile, landline, and fax")}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:gap-5 md:grid-cols-3">
            <MultiContactField
              label={T("موبايل", "Mobile")} icon={Smartphone}
              values={general.mobiles ?? []} onChange={(list) => set("mobiles")(list)}
              placeholder={c.mobile?.example}
              hint={c.mobile ? (isAr ? c.mobile.hintAr : c.mobile.hintEn) : undefined}
              format={(v) => (c.mobile ? applyMask(v, c.mobile) : v)}
              validate={(v) => validateRule(v, c.mobile)}
              isAr={isAr} T={T} showErrors={showErrors} inputMode="tel"
            />
            <MultiContactField
              label={T("تليفون أرضى", "Landline")} icon={Phone}
              values={general.phones ?? []} onChange={(list) => set("phones")(list)}
              placeholder={c.phone?.example}
              hint={c.phone ? (isAr ? c.phone.hintAr : c.phone.hintEn) : undefined}
              format={(v) => (c.phone ? applyMask(v, c.phone) : v)}
              validate={(v) => validateRule(v, c.phone)}
              isAr={isAr} T={T} showErrors={showErrors} inputMode="tel"
            />
            <MultiContactField
              label={T("فاكس", "Fax")} icon={Printer}
              values={general.faxes ?? []} onChange={(list) => set("faxes")(list)}
              placeholder={c.phone?.example}
              format={(v) => (c.phone ? applyMask(v, c.phone) : v)}
              isAr={isAr} T={T} showErrors={showErrors} inputMode="tel"
            />
          </div>
        </div>

        {/* Card B — Digital presence */}
        <div className="rounded-2xl border bg-gradient-to-br from-muted/40 to-transparent p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/60">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
              <Globe className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold">{T("التواجد الرقمى", "Digital Presence")}</h4>
              <p className="text-[11px] text-muted-foreground">
                {T("البريد الإلكترونى والموقع", "Email and website")}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:gap-5 md:grid-cols-2">
            <MultiContactField
              label={T("البريد الإلكتروني", "Email")} icon={Mail}
              values={general.emails ?? []} onChange={(list) => set("emails")(list)}
              placeholder="info@company.com"
              hint={T("الأساسى منه يُستخدم لإرسال الإشعارات", "Primary is used for outbound mail")}
              validate={validateEmail}
              isAr={isAr} T={T} showErrors={showErrors} type="email"
            />
            <MultiContactField
              label={T("الموقع الإلكتروني", "Website")} icon={Globe}
              values={general.websites ?? []} onChange={(list) => set("websites")(list)}
              placeholder="https://company.com"
              validate={validateWebsite}
              isAr={isAr} T={T} showErrors={showErrors}
            />
          </div>
        </div>


      </section>

      {/* Section 3 — Documents */}
      <section className="space-y-4">
        <SectionHeader n={3} title={T("المستندات القانونية", "Legal Documents")} T={T} />
        <CompanyDocumentsSection
          documents={documents}
          setDocuments={setDocuments}
          T={T}
          isAr={isAr}
        />
      </section>

      <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg p-3 border flex items-start gap-2">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          {T("كود الشركة هيتولّد تلقائيًا من الاسم — تقدر تعدّله بعد كده من إعدادات الشركة.",
             "The company code is auto-generated from the name — you can change it later from company settings.")}
        </span>
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

// ---------------- Company Documents (Step 1 sub-section) ----------------

function CompanyDocumentsSection({
  documents, setDocuments, T, isAr,
}: {
  documents: SetupDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<SetupDocument[]>>;
  T: (ar: string, en: string) => string;
  isAr: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  function openAdd() { setEditIndex(null); setOpen(true); }
  function openEdit(i: number) { setEditIndex(i); setOpen(true); }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            {T("مستندات الشركة", "Company Documents")}
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            {T("السجل التجارى، البطاقة الضريبية، شهادات الاستيراد… وأى مستند رسمى للشركة.",
               "Commercial registration, tax card, import/export licenses… any official company document.")}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={openAdd}>
          <FolderOpen className="me-2 h-4 w-4" />
          {documents.length > 0
            ? T(`إدارة المستندات (${documents.length})`, `Manage documents (${documents.length})`)
            : T("إضافة مستندات الشركة", "Add company documents")}
        </Button>
      </div>

      {documents.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(113px,1fr))] gap-3">
          {documents.map((d, i) => {
            const label = isAr ? d.name_ar : d.name_en;
            const details = [d.doc_number, d.expiry_date && T(`ينتهى ${d.expiry_date}`, `exp ${d.expiry_date}`)]
              .filter(Boolean).join(" • ") || T("بدون تفاصيل", "no details");
            return (
              <button
                type="button"
                key={i}
                title={`${label}\n${details}${d.file ? `\n${d.file.name}` : ""}`}
                onClick={() => openEdit(i)}
                className="group relative w-[113px] h-[113px] rounded-xl border bg-card hover:border-primary/60 hover:shadow-md transition text-start flex flex-col items-center justify-center gap-1.5 p-2"
              >
                <div className="relative">
                  <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary grid place-items-center">
                    <FileText className="h-5 w-5" />
                  </div>
                  {d.file && (
                    <span className="absolute -bottom-1 -end-1 h-4 w-4 rounded-full bg-emerald-500 text-white grid place-items-center ring-2 ring-card">
                      <Paperclip className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>
                <div className="text-[11px] leading-tight text-center font-medium line-clamp-2 w-full px-1 text-foreground">
                  {label}
                </div>
                {d.expiry_date && (
                  <div className="text-[9px] text-muted-foreground truncate w-full text-center px-1">
                    {T(`ينتهى ${d.expiry_date}`, `exp ${d.expiry_date}`)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg p-3 border">
          {T("اختيارى — تقدر تضيف مستندات الشركة الأساسية دلوقتى، أو تسيبها لحد ما تخلص الإعداد وتضيفها من صفحة «مستندات الشركة».",
             "Optional — you can add core company documents now, or leave them for later from the Company Documents page.")}
        </div>
      )}

      <DocumentsDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditIndex(null); }}
        documents={documents}
        setDocuments={setDocuments}
        T={T}
        isAr={isAr}
        initialEditIndex={editIndex}
      />
    </div>
  );
}


function DocumentsDialog({
  open, onOpenChange, documents, setDocuments, T, isAr, initialEditIndex,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documents: SetupDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<SetupDocument[]>>;
  T: (ar: string, en: string) => string;
  isAr: boolean;
  initialEditIndex?: number | null;
}) {
  // Form state for adding / editing one document at a time
  const emptyForm: SetupDocument = {
    code: "",
    name_ar: "",
    name_en: "",
    doc_number: "",
    issue_date: "",
    expiry_date: "",
    notes: "",
    file: null,
  };
  const [form, setForm] = useState<SetupDocument>(emptyForm);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // When opened with a specific index, jump straight into edit mode
  useEffect(() => {
    if (!open) return;
    if (initialEditIndex != null && documents[initialEditIndex]) {
      setEditingIndex(initialEditIndex);
      setForm({ ...documents[initialEditIndex] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialEditIndex]);

  // Auto-focus the first field (document type) whenever the dialog opens
  // or after a document is added/edited so the user can chain entries fast.
  const firstInputRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => firstInputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open, editingIndex]);


  function resetForm() {
    setForm(emptyForm);
    setEditingIndex(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function pickPreset(code: string) {
    const preset = DOC_PRESETS.find((p) => p.code === code);
    if (!preset) return;
    setForm((f) => ({
      ...f,
      code: preset.code,
      name_ar: preset.name_ar,
      name_en: preset.name_en,
      notify_days_before: preset.notify_days_before,
      notify_repeat: preset.notify_repeat,
    }));
  }

  function clearFile() {
    setForm((f) => ({ ...f, file: null }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function addOrUpdate() {
    if (!form.code || !form.name_ar || !form.name_en) {
      toast.error(T("اختر نوع المستند", "Choose a document type"));
      return;
    }
    const existingFile =
      editingIndex !== null ? documents[editingIndex]?.file ?? null : null;
    const effectiveFile = form.file ?? existingFile;
    if (!effectiveFile) {
      toast.error(T("لازم ترفع ملف المستند", "You must upload the document file"));
      return;
    }


    const entry: SetupDocument = {
      code: form.code,
      name_ar: form.name_ar,
      name_en: form.name_en,
      notify_days_before: form.notify_days_before,
      notify_repeat: form.notify_repeat,
      doc_number: form.doc_number?.trim() || null,
      issue_date: form.issue_date || null,
      expiry_date: form.expiry_date || null,
      notes: form.notes?.trim() || null,
      file: effectiveFile,
    };

    setDocuments((prev) => {
      if (editingIndex !== null) {
        const copy = [...prev];
        copy[editingIndex] = entry;
        return copy;
      }
      return [...prev, entry];
    });
    resetForm();
    toast.success(editingIndex !== null
      ? T("تم تحديث المستند", "Document updated")
      : T("تم إضافة المستند للسته", "Document added to list"));
  }

  function edit(i: number) {
    const d = documents[i];
    setEditingIndex(i);
    setForm({ ...d });
  }

  function remove(i: number) {
    setDocuments((prev) => prev.filter((_, idx) => idx !== i));
    if (editingIndex === i) resetForm();
  }

  const usedCodes = new Set(
    documents.map((d, idx) => (editingIndex === idx ? "__self__" : d.code)),
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] p-0 flex flex-col gap-0"
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* Sticky header + actions — always reachable regardless of scroll */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-5 pt-5 pb-3 space-y-3">
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              {T("مستندات الشركة", "Company Documents")}
            </DialogTitle>
            <DialogDescription>
              {T("اختر نوع المستند وأدخل بياناته. الملفات هيتم رفعها بس لما تحفظ الإعداد النهائى.",
                 "Choose a document type and enter its details. Files upload only when you finish the setup wizard.")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2">
            {editingIndex !== null && (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                {T("إلغاء التعديل", "Cancel edit")}
              </Button>
            )}
            <Button type="button" size="sm" onClick={addOrUpdate}>
              <Plus className="me-2 h-4 w-4" />
              {editingIndex !== null ? T("حفظ التعديل", "Save changes") : T("إضافة للسته", "Add to list")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
              {T("تم", "Done")}
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {/* Existing list */}
          {documents.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {T("المستندات المضافة", "Added documents")}
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-2">
                {documents.map((d, i) => {
                  const label = isAr ? d.name_ar : d.name_en;
                  const details = [d.doc_number, d.issue_date, d.expiry_date && T(`ينتهى ${d.expiry_date}`, `exp ${d.expiry_date}`)]
                    .filter(Boolean).join(" • ") || T("بدون تفاصيل", "no details");
                  return (
                    <div
                      key={i}
                      title={`${label}\n${details}${d.file ? `\n${d.file.name}` : ""}`}
                      className={`group relative w-[76px] h-[76px] rounded-lg border bg-card hover:border-primary/60 hover:shadow-sm transition cursor-pointer flex flex-col items-center justify-center gap-1 p-1.5 ${editingIndex === i ? "border-primary ring-2 ring-primary/20 bg-primary/5" : ""}`}
                      onClick={() => edit(i)}
                    >
                      <div className="relative">
                        <div className="h-8 w-8 rounded-md bg-primary/10 text-primary grid place-items-center">
                          <FileText className="h-4 w-4" />
                        </div>
                        {d.file && (
                          <span className="absolute -bottom-1 -end-1 h-3.5 w-3.5 rounded-full bg-emerald-500 text-white grid place-items-center ring-2 ring-card">
                            <Paperclip className="h-2 w-2" />
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] leading-tight text-center line-clamp-2 w-full px-0.5 text-foreground">
                        {label}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); remove(i); }}
                        className="absolute -top-1.5 -end-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground grid place-items-center opacity-0 group-hover:opacity-100 transition shadow"
                        aria-label={T("حذف", "Remove")}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add / edit form */}
          <div className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {editingIndex !== null ? T("تعديل مستند", "Edit document") : T("إضافة مستند جديد", "Add a new document")}
            </div>

            {/* Type selector */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                {T("نوع المستند", "Document type")} <span className="text-destructive">*</span>
              </Label>
              <Select value={form.code || undefined} onValueChange={pickPreset}>
                <SelectTrigger ref={firstInputRef}>
                  <SelectValue placeholder={T("اختر نوع", "Choose type")} />
                </SelectTrigger>
                <SelectContent>
                  {DOC_PRESETS.map((p) => (
                    <SelectItem key={p.code} value={p.code} disabled={usedCodes.has(p.code)}>
                      {isAr ? p.name_ar : p.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Row 1 — number + dates side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">{T("رقم المستند", "Document number")}</Label>
                <Input
                  dir="ltr"
                  value={form.doc_number ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, doc_number: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />{T("تاريخ الإصدار", "Issue date")}
                </Label>
                <Input
                  type="date"
                  value={form.issue_date ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />{T("تاريخ الانتهاء", "Expiry date")}
                </Label>
                <Input
                  type="date"
                  value={form.expiry_date ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
                />
              </div>
            </div>

            {/* Row 2 — file + notes side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1">
                  <Paperclip className="h-3.5 w-3.5" />
                  {T("رفع المستند", "Upload file")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setForm((prev) => ({ ...prev, file: f }));
                  }}
                />
                {form.file ? (
                  <div className="text-[11px] text-muted-foreground flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 min-w-0 truncate">
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <span className="truncate">{form.file.name}</span>
                      <span className="shrink-0">· {(form.file.size / 1024).toFixed(1)} KB</span>
                    </span>
                    <Button
                      type="button" variant="ghost" size="sm"
                      className="h-7 px-2 text-destructive" onClick={clearFile}
                    >
                      <X className="h-3.5 w-3.5 me-1" />{T("إزالة", "Remove")}
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">{T("ملاحظات", "Notes")}</Label>
                <Textarea
                  rows={3}
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

