import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  hasAnyCompany, pickPrimary, uploadCompanyLogo, deleteCompanyLogo,
  uploadCompanyDocumentDraft, deleteCompanyDocumentDraft, getCompanyDocumentSignedUrl,
  type CompanyAdvanced, type CompanyFeatures, type CompanyGeneral, type ContactEntry, type NumberingRow, type SetupDocument,
} from "@/features/company/api";
import { useCreateCompany } from "@/features/company/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Building2, Sparkles, Settings2, Hash, CheckCircle2, ArrowRight, ArrowLeft, Upload, Loader2, Gem, RotateCcw, AlertCircle, ImagePlus, Mail, Phone, Smartphone, Globe, MapPin, FileText, Receipt, FolderOpen, Plus, Trash2, Paperclip, CalendarDays, Info, Star, Printer, X } from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";
import { COUNTRIES, applyMask, generateCompanyCode, getCountry, validateEmail, validateRule, validateWebsite, type FieldValidation } from "@/lib/countryFormats";
import { DOC_PRESETS, slugifyCode, type DocPreset } from "@/lib/companyDocPresets";
import { filterArabic, filterEnglish } from "@/lib/textFilters";
import { ScriptInput } from "@/components/ScriptInput";
import { getStates, getCities, hasGeo } from "@/lib/geoData";
import { FEATURE_REGISTRY, CATEGORY_LABELS, FEATURE_MAP, defaultFeatures, type FeatureCategory, type FeatureDef } from "@/lib/features/registry";


const DRAFT_KEY = "eec.setup.draft.v1";

type PersistedDoc = Omit<SetupDocument, "file"> & {
  file_name?: string | null;
  file_type?: string | null;
  file_data_url?: string | null; // legacy — no longer written, still read for migration
  has_file?: boolean;
};

type Draft = {
  step: Step;
  general: CompanyGeneral;
  advanced: CompanyAdvanced;
  features: CompanyFeatures;
  numbering: NumberingRow[];
  documents: PersistedDoc[];
  // Path in the company-logos bucket of the currently staged logo (survives refresh).
  logo_path?: string | null;
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

function fileFromDataUrl(dataUrl: string, name: string, fallbackType?: string | null): File | null {
  try {
    const [meta, b64] = dataUrl.split(",");
    const mime = /data:(.*?);base64/.exec(meta)?.[1] ?? fallbackType ?? "application/octet-stream";
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
    return new File([arr], name, { type: mime });
  } catch { return null; }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Invalid file data"));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
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

const DEFAULT_FEATURES: CompanyFeatures = defaultFeatures() as CompanyFeatures;

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

// Weighted completion for the remaining steps — used to drive the per-step
// progress indicator on every page (stepper icons + sticky bar).
function computeStep2Weights(a: CompanyAdvanced): Weight[] {
  const nz = (s?: string | null) => (s ?? "").trim().length > 0;
  return [
    { key: "state",    weight: 25, filled: nz(a.state),             valid: nz(a.state) },
    { key: "city",     weight: 20, filled: nz(a.city),              valid: nz(a.city) },
    { key: "address",  weight: 20, filled: nz(a.address),           valid: nz(a.address) },
    { key: "postal",   weight: 5,  filled: nz(a.postal_code),       valid: nz(a.postal_code) },
    { key: "currency", weight: 5,  filled: nz(a.base_currency),     valid: nz(a.base_currency) },
    { key: "timezone", weight: 5,  filled: nz(a.timezone),          valid: nz(a.timezone) },
    { key: "fy_start", weight: 5,  filled: nz(a.fiscal_year_start), valid: nz(a.fiscal_year_start) },
    { key: "fy_end",   weight: 5,  filled: nz(a.fiscal_year_end),   valid: nz(a.fiscal_year_end) },
    { key: "notes",    weight: 10, filled: nz(a.notes),             valid: nz(a.notes) },
  ];
}
function pctFromWeights(w: Weight[]): number {
  const total = w.reduce((a, x) => a + x.weight, 0);
  const done = w.reduce((a, x) => a + (x.valid ? x.weight : 0), 0);
  return total ? Math.round((done / total) * 100) : 0;
}
function featuresPct(f: CompanyFeatures): number {
  const vals = Object.values(f);
  return vals.length ? Math.round((vals.filter(Boolean).length / vals.length) * 100) : 0;
}
function numberingPct(rows: NumberingRow[]): number {
  // Target ~6 configured doc types = 100%; more still shows as 100%.
  return Math.min(100, Math.round((rows.length / 6) * 100));
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
    base_currency: "EGP", fiscal_year_start: "2000-01-01", fiscal_year_end: "2000-12-31",
    notes: "",
  });
  const [features, setFeatures] = useState<CompanyFeatures>(d?.features ?? DEFAULT_FEATURES);
  const [numbering, setNumbering] = useState<NumberingRow[]>(d?.numbering ?? DEFAULT_NUMBERING);
  const [documents, setDocuments] = useState<SetupDocument[]>(
    (d?.documents ?? []).map((pd) => {
      const has = !!pd.storage_path || !!pd.has_file || (!!pd.file_data_url && !!pd.file_name);
      return { ...pd, file: null, has_file: has } as SetupDocument;
    }),
  );
  const [logoUploading, setLogoUploading] = useState(false);
  // Immediately-uploaded logo (path in storage + a signed URL for preview live in general.logo_url).
  const [logoPath, setLogoPath] = useState<string | null>(d?.logo_path ?? null);

  // Re-sign the doc preview URLs on mount so previously-uploaded drafts show a valid link.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const staged = documents.filter((doc) => doc.storage_path);
      if (!staged.length) return;
      const updated = await Promise.all(staged.map(async (doc) => {
        const url = await getCompanyDocumentSignedUrl(doc.storage_path!).catch(() => null);
        return { code: doc.code, url };
      }));
      if (cancelled) return;
      setDocuments((prev) => prev.map((doc) => {
        const hit = updated.find((u) => u.code === doc.code);
        return hit?.url ? ({ ...doc, file_data_url: hit.url } as SetupDocument) : doc;
      }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (step === "done") return;
    try {
      const persistedDocs: PersistedDoc[] = documents.map((doc) => {
        const { file, file_data_url, ...rest } = doc;
        return {
          ...rest,
          file_name: doc.file_name ?? null,
          file_type: doc.file_type ?? null,
          file_size: doc.file_size ?? null,
          storage_path: doc.storage_path ?? null,
          // preview URL is signed and expires; don't persist it.
          file_data_url: null,
          has_file: !!doc.storage_path || !!doc.has_file,
        };
      });
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ step, general, advanced, features, numbering, documents: persistedDocs, logo_path: logoPath }),
      );
    } catch { /* ignore — likely quota exceeded */ }
  }, [step, general, advanced, features, numbering, documents, logoPath]);


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
      base_currency: "EGP", fiscal_year_start: "2000-01-01", fiscal_year_end: "2000-12-31",
      notes: "",
    });
    setFeatures(DEFAULT_FEATURES);
    setNumbering(DEFAULT_NUMBERING);
    // Delete any staged files from storage so we don't leave orphans behind.
    if (logoPath) { void deleteCompanyLogo(logoPath); }
    for (const doc of documents) {
      if (doc.storage_path) void deleteCompanyDocumentDraft(doc.storage_path);
    }
    setDocuments([]);
    setLogoPath(null);
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
    () => computeGeneralWeights(general, advanced.country ?? "EG", documents.length, !!general.logo_url),
    [general, advanced.country, documents.length, general.logo_url],
  );
  const completion = useMemo(() => {
    const total = weights.reduce((a, w) => a + w.weight, 0);
    const done = weights.reduce((a, w) => a + (w.valid ? w.weight : 0), 0);
    return Math.round((done / total) * 100);
  }, [weights]);

  const requiredMissing = weights.filter((w) => w.required && !w.valid);

  // Per-step completion percentages (drive stepper icons + sticky bar).
  const stepPct = useMemo(() => ({
    1: completion,
    2: pctFromWeights(computeStep2Weights(advanced)),
    3: featuresPct(features),
    4: numberingPct(numbering),
  }), [completion, advanced, features, numbering]);

  // Sticky progress bar collapses to a slim floating pill on scroll
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 120);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);



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
      const seenType = new Set<string>();
      const seenPrefix = new Set<string>();
      for (const row of numbering) {
        const type = row.doc_type.trim().toUpperCase();
        const prefix = row.prefix.trim().toUpperCase();
        if (!type) return T("النوع مطلوب", "Type code is required");
        if (!/^[A-Z0-9_-]+$/.test(type)) return T("النوع لازم يكون إنجليزى", "Type code must be English letters/numbers");
        if (!prefix) return T("كل مستند لازم يكون له بادئة", "Each doc needs a prefix");
        if (!/^[A-Z0-9_-]+$/.test(prefix)) return T("البادئة لازم تكون إنجليزى", "Prefix must be English letters/numbers");
        if (seenType.has(type)) return T(`نوع مستند مكرر: ${type}`, `Duplicate doc type: ${type}`);
        if (seenPrefix.has(prefix)) return T(`بادئة مكررة: ${prefix}`, `Duplicate prefix: ${prefix}`);
        if (row.padding < 1 || row.padding > 12) return T("خانات الرقم بين 1 و 12", "Padding must be 1–12");
        seenType.add(type);
        seenPrefix.add(prefix);
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
  // Jump to a specific step. Going back or to the current step is always
  // allowed; jumping forward requires every intermediate step to be valid.
  function goToStep(target: 1 | 2 | 3 | 4) {
    if (target <= currentIdx) { setStep(target); return; }
    for (let s = currentIdx; s < target; s += 1) {
      const err = validateStep(s);
      if (err) { setShowErrors(true); setStep(s as Step); toast.error(err); return; }
    }
    setShowErrors(false);
    setStep(target);
  }

  async function handleLogo(file: File) {
    if (!file.type.startsWith("image/")) { toast.error(T("لازم تختار صورة", "Please choose an image")); return; }
    if (file.size > 3 * 1024 * 1024) { toast.error(T("الحجم أكبر من 3MB", "File is larger than 3MB")); return; }
    setLogoUploading(true);
    try {
      const oldPath = logoPath;
      const { path, url } = await uploadCompanyLogo(file);
      setLogoPath(path);
      setGeneral((g) => ({ ...g, logo_url: url }));
      if (oldPath) void deleteCompanyLogo(oldPath);
    } catch (e: any) {
      toast.error(e?.message ?? T("فشل رفع اللوجو", "Failed to upload logo"));
    } finally {
      setLogoUploading(false);
    }
  }
  function clearLogo() {
    const p = logoPath;
    setLogoPath(null);
    setGeneral((g) => ({ ...g, logo_url: "" }));
    if (p) void deleteCompanyLogo(p);
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
  // The "Create Company" button is only enabled when EVERY step is valid,
  // so the user can't sneak in with missing required data by skipping tabs.
  const allStepsValid = useMemo(
    () => [1, 2, 3, 4].every((s) => validateStep(s) === null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [general, advanced, features, numbering, documents, requiredMissing.length],
  );
  const submitBlockError = useMemo(
    () => [1, 2, 3, 4].map((s) => ({ s, err: validateStep(s) })).find((x) => x.err),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [general, advanced, features, numbering, documents, requiredMissing.length],
  );
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
                  <button
                    type="button"
                    onClick={() => goToStep(t.id)}
                    disabled={createMut.isPending}
                    aria-current={active ? "step" : undefined}
                    aria-label={`${T("الخطوة", "Step")} ${t.id}: ${t.label}`}
                    className="flex flex-col items-center gap-1.5 flex-1 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg py-1 group disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <div className={`h-9 w-9 sm:h-11 sm:w-11 rounded-full grid place-items-center transition-all shrink-0 text-xs font-bold tabular-nums ${
                      (stepPct[t.id as 1 | 2 | 3 | 4] ?? 0) >= 100 ? "bg-emerald-500 text-white shadow-sm group-hover:brightness-110" :
                      active ? "bg-primary text-primary-foreground ring-4 ring-primary/15 scale-110" :
                      "bg-muted text-muted-foreground group-hover:bg-muted-foreground/15 group-hover:text-foreground"
                    }`}>
                      {(stepPct[t.id as 1 | 2 | 3 | 4] ?? 0) >= 100
                        ? <CheckCircle2 className="h-5 w-5" />
                        : <span className="text-[10px] sm:text-[11px]">{stepPct[t.id as 1 | 2 | 3 | 4] ?? 0}%</span>}
                    </div>
                    <div className={`hidden sm:block text-[11px] md:text-xs font-medium truncate text-center max-w-[130px] ${active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
                      {t.label}
                    </div>
                  </button>
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

        {/* Per-step title + completion bar — sticky on every step, collapses on scroll */}
        {typeof step === "number" && (() => {
          const pct = stepPct[step as 1 | 2 | 3 | 4] ?? 0;
          const tone = pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-primary" : "bg-amber-500";
          const TabIcon = currentTab?.icon;
          return (
            <div className="sticky top-2 z-30 -mx-3 sm:-mx-4 px-3 sm:px-4">
              {scrolled ? (
                <div className="bg-background/95 backdrop-blur-md border rounded-full shadow-lg px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  {TabIcon && (
                    <div className={`h-7 w-7 rounded-full grid place-items-center shrink-0 ${pct >= 100 ? "bg-emerald-500/15 text-emerald-600" : "bg-primary/15 text-primary"}`}>
                      <TabIcon className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <span className="text-xs font-semibold truncate min-w-0 flex-1">{currentTab?.label}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[60px] max-w-[180px]">
                    <div className={`h-full transition-all duration-500 ${tone}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-bold tabular-nums shrink-0">{pct}%</span>
                </div>
              ) : (
                <div className="bg-card border rounded-2xl px-4 sm:px-5 py-3 sm:py-4 flex items-center gap-3 sm:gap-4 flex-wrap shadow-sm">
                  {TabIcon && (
                    <div className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${pct >= 100 ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary"}`}>
                      <TabIcon className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {T("الخطوة", "Step")} {currentIdx}/4
                    </div>
                    <div className="text-sm sm:text-base font-semibold truncate">{currentTab?.label}</div>
                  </div>
                  <div className="min-w-[140px] sm:min-w-[200px] shrink-0">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">{T("الاكتمال", "Completeness")}</span>
                      <span className="font-semibold tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-500 ${tone}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}


        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-4 sm:p-6 md:p-8 lg:p-10 space-y-6 md:space-y-8">
            {step === 1 && (
              <StepGeneral
                general={general} setGeneral={setGeneral}
                country={advanced.country ?? "EG"}
                setCountry={(v) => setAdvanced((a) => {
                  const c = getCountry(v);
                  return { ...a, country: v, state: "", city: "", base_currency: c.currency, timezone: c.timezone };
                })}
                T={T} isAr={isAr}
                onLogoFile={handleLogo} logoUploading={logoUploading} logoPreview={general.logo_url ?? null} clearLogo={clearLogo}
                completion={completion} weights={weights}
                showErrors={showErrors}
                documents={documents} setDocuments={setDocuments}
              />
            )}
            {step === 2 && <StepAdvanced advanced={advanced} setAdvanced={setAdvanced} T={T} />}
            {step === 3 && <StepFeatures features={features} setFeatures={setFeatures} T={T} />}
            {step === 4 && <StepNumbering numbering={numbering} setNumbering={setNumbering} T={T} isAr={isAr} />}
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
              {currentIdx === 4 && !stepErr && submitBlockError && (
                <button
                  type="button"
                  onClick={() => goToStep(submitBlockError.s as 1 | 2 | 3 | 4)}
                  className="text-[11px] text-destructive flex items-center gap-1 max-w-[260px] truncate hover:underline"
                  title={submitBlockError.err ?? undefined}
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {T(`الخطوة ${submitBlockError.s}: `, `Step ${submitBlockError.s}: `)}{submitBlockError.err}
                  </span>
                </button>
              )}
              {currentIdx < 4 ? (
                <Button onClick={next} className="h-10 min-w-[110px]" disabled={createMut.isPending}>
                  {T("التالي", "Next")}
                  {isAr ? <ArrowLeft className="ms-2 h-4 w-4" /> : <ArrowRight className="ms-2 h-4 w-4" />}
                </Button>
              ) : (
                <Button onClick={submit} disabled={createMut.isPending || !allStepsValid} className="h-10 min-w-[140px]">
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

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="min-w-0">
        <h3 className="text-xl sm:text-2xl font-bold tracking-tight">{T("بطاقة الشركة", "Company Profile")}</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl">
          {T("املأ البيانات الأساسية للشركة. الحقول المُميّزة بنجمة حمراء مطلوبة للانتقال للخطوة التالية.",
             "Fill in the company profile. Fields marked with a red asterisk are required to continue.")}
        </p>
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
                <SearchableSelect
                  value={country} onValueChange={setCountry}
                  className="h-11" dir={isAr ? "rtl" : "ltr"}
                  searchPlaceholder={T("ابحث…", "Search…")}
                  emptyText={T("لا توجد نتائج", "No results")}
                  options={COUNTRIES.map((cc): SearchableSelectOption => ({
                    value: cc.code,
                    label: isAr ? cc.labelAr : cc.labelEn,
                    keywords: `${cc.labelAr} ${cc.labelEn} ${cc.code}`,
                  }))}
                />
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

function AdvSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">{title}</h4>
      <div className="grid md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function StepAdvanced({ advanced, setAdvanced, T }: any) {
  const set = (k: keyof CompanyAdvanced) => (e: any) => setAdvanced((a: any) => ({ ...a, [k]: e?.target ? e.target.value : e }));
  const Section = AdvSection;

  const country: string = advanced.country ?? "EG";
  const hasGeoData = hasGeo(country);
  const states = hasGeoData ? getStates(country) : [];
  const cities = hasGeoData ? getCities(country, advanced.state ?? "") : [];

  // Fiscal year — day + month only (year-agnostic). Stored as "2000-MM-DD".
  const parseMD = (v?: string | null): { m: string; d: string } => {
    if (!v) return { m: "", d: "" };
    const parts = v.split("-");
    if (parts.length !== 3) return { m: "", d: "" };
    return { m: parts[1] ?? "", d: parts[2] ?? "" };
  };
  const composeMD = (m: string, d: string): string | null => {
    if (!m || !d) return null;
    return `2000-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  };
  const daysInMonth = (m: string): number => {
    if (!m) return 31;
    const mi = parseInt(m, 10);
    if (mi === 2) return 29;
    if ([4, 6, 9, 11].includes(mi)) return 30;
    return 31;
  };
  const fs = parseMD(advanced.fiscal_year_start);
  const fe = parseMD(advanced.fiscal_year_end);
  const months = [
    ["01", "يناير", "January"], ["02", "فبراير", "February"], ["03", "مارس", "March"],
    ["04", "أبريل", "April"], ["05", "مايو", "May"], ["06", "يونيو", "June"],
    ["07", "يوليو", "July"], ["08", "أغسطس", "August"], ["09", "سبتمبر", "September"],
    ["10", "أكتوبر", "October"], ["11", "نوفمبر", "November"], ["12", "ديسمبر", "December"],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold">{T("البيانات المتقدمة", "Advanced Information")}</h3>
        <p className="text-sm text-muted-foreground">{T("العنوان والإعدادات الإقليمية والمالية (اختيارى — تقدر تكملها بعدين).", "Address, regional and financial settings (optional — you can complete later).")}</p>
      </div>

      <Section title={T("العنوان", "Address")}>
        <Field label={T("المحافظة / المنطقة", "State / Governorate")}>
          {hasGeoData ? (
            <SearchableSelect
              value={advanced.state ?? ""}
              onValueChange={(v) => setAdvanced((a: any) => ({ ...a, state: v, city: "" }))}
              placeholder={T("اختر المحافظة", "Select governorate")}
              searchPlaceholder={T("ابحث…", "Search…")}
              emptyText={T("لا توجد نتائج", "No results")}
              options={states.map((s): SearchableSelectOption => ({
                value: s.key,
                label: T(s.ar, s.en),
                keywords: `${s.ar} ${s.en} ${s.key}`,
              }))}
            />
          ) : (
            <Input value={advanced.state ?? ""} onChange={set("state")} placeholder={T("اكتب اسم المحافظة", "Type state name")} />
          )}
        </Field>
        <Field label={T("المدينة", "City")}>
          {hasGeoData ? (
            <SearchableSelect
              value={advanced.city ?? ""}
              onValueChange={(v) => set("city")(v)}
              disabled={!advanced.state}
              placeholder={advanced.state ? T("اختر المدينة", "Select city") : T("اختر المحافظة أولاً", "Pick governorate first")}
              searchPlaceholder={T("ابحث…", "Search…")}
              emptyText={T("لا توجد نتائج", "No results")}
              options={cities.map((ct): SearchableSelectOption => ({
                value: ct.en,
                label: T(ct.ar, ct.en),
                keywords: `${ct.ar} ${ct.en}`,
              }))}
            />
          ) : (
            <Input value={advanced.city ?? ""} onChange={set("city")} placeholder={T("اكتب اسم المدينة", "Type city name")} />
          )}
        </Field>
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
          <SearchableSelect
            value={advanced.timezone ?? "Africa/Cairo"} onValueChange={(v) => set("timezone")(v)}
            searchPlaceholder={T("ابحث…", "Search…")}
            emptyText={T("لا توجد نتائج", "No results")}
            options={[
              { value: "Africa/Cairo", label: "Africa/Cairo" },
              { value: "Europe/London", label: "Europe/London" },
              { value: "Europe/Berlin", label: "Europe/Berlin" },
              { value: "Asia/Riyadh", label: "Asia/Riyadh" },
              { value: "Asia/Dubai", label: "Asia/Dubai" },
              { value: "UTC", label: "UTC" },
            ]}
          />
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
          <SearchableSelect
            value={advanced.base_currency ?? "EGP"} onValueChange={(v) => set("base_currency")(v)}
            searchPlaceholder={T("ابحث…", "Search…")}
            emptyText={T("لا توجد نتائج", "No results")}
            options={[
              { value: "EGP", label: "EGP - جنيه مصري", keywords: "egyptian pound" },
              { value: "USD", label: "USD - US Dollar", keywords: "dollar" },
              { value: "EUR", label: "EUR - Euro", keywords: "euro" },
              { value: "GBP", label: "GBP - British Pound", keywords: "sterling" },
              { value: "SAR", label: "SAR - Saudi Riyal", keywords: "ريال سعودي" },
              { value: "AED", label: "AED - UAE Dirham", keywords: "درهم إماراتي" },
              { value: "KWD", label: "KWD - Kuwaiti Dinar", keywords: "دينار كويتي" },
              { value: "QAR", label: "QAR - Qatari Riyal", keywords: "ريال قطري" },
            ]}
          />
        </Field>
        <div />
        <Field label={T("بداية السنة المالية (يوم/شهر)", "Fiscal Year Start (day/month)")}>
          <div className="grid grid-cols-2 gap-2">
            <Select value={fs.d} onValueChange={(v) => setAdvanced((a: any) => ({ ...a, fiscal_year_start: composeMD(fs.m || "01", v) }))}>
              <SelectTrigger><SelectValue placeholder={T("يوم", "Day")} /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: daysInMonth(fs.m) }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fs.m} onValueChange={(v) => setAdvanced((a: any) => ({ ...a, fiscal_year_start: composeMD(v, fs.d || "01") }))}>
              <SelectTrigger><SelectValue placeholder={T("شهر", "Month")} /></SelectTrigger>
              <SelectContent>
                {months.map(([val, ar, en]) => <SelectItem key={val} value={val}>{T(ar, en)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </Field>
        <Field label={T("نهاية السنة المالية (يوم/شهر)", "Fiscal Year End (day/month)")}>
          <div className="grid grid-cols-2 gap-2">
            <Select value={fe.d} onValueChange={(v) => setAdvanced((a: any) => ({ ...a, fiscal_year_end: composeMD(fe.m || "12", v) }))}>
              <SelectTrigger><SelectValue placeholder={T("يوم", "Day")} /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: daysInMonth(fe.m) }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fe.m} onValueChange={(v) => setAdvanced((a: any) => ({ ...a, fiscal_year_end: composeMD(v, fe.d || "31") }))}>
              <SelectTrigger><SelectValue placeholder={T("شهر", "Month")} /></SelectTrigger>
              <SelectContent>
                {months.map(([val, ar, en]) => <SelectItem key={val} value={val}>{T(ar, en)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </Field>
      </Section>

      <Section title={T("ملاحظات إضافية", "Additional Notes")}>
        <div className="md:col-span-2">
          <Field label={T("ملاحظات داخلية", "Internal Notes")}><Textarea rows={3} value={advanced.notes ?? ""} onChange={set("notes")} /></Field>
        </div>
      </Section>
    </div>
  );
}

function StepFeatures({ features, setFeatures, T }: any) {
  const { lang } = useI18n();
  const ar = lang === "ar";

  const grouped = useMemo(() => {
    const g: Record<FeatureCategory, FeatureDef[]> = {
      core: [], operations: [], traceability: [], finance: [], compliance: [],
    };
    for (const f of FEATURE_REGISTRY) g[f.category].push(f);
    return g;
  }, []);

  function toggle(key: string, v: boolean) {
    setFeatures((prev: any) => {
      const next = { ...prev, [key]: v };
      if (!v) {
        for (const f of FEATURE_REGISTRY) {
          if (f.depends_on?.includes(key)) next[f.key] = false;
        }
      } else {
        const def = FEATURE_MAP[key];
        for (const dep of def?.depends_on ?? []) next[dep] = true;
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{T("مميزات النظام", "System Features")}</h3>
        <p className="text-sm text-muted-foreground">
          {T(
            "فعّل الموديولات اللى محتاجها. تقدر تغيّرها فى أى وقت من الإعدادات > مميزات النظام.",
            "Enable the modules you need. You can change these anytime from Settings > System Features.",
          )}
        </p>
      </div>

      {(Object.keys(grouped) as FeatureCategory[]).map((cat) => {
        const items = grouped[cat];
        if (!items.length) return null;
        return (
          <div key={cat} className="space-y-2">
            <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
              {ar ? CATEGORY_LABELS[cat].ar : CATEGORY_LABELS[cat].en}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((f) => {
                const val = !!features[f.key];
                const Icon = f.icon;
                return (
                  <label
                    key={f.key}
                    className={`border rounded-xl p-4 transition-all ${
                      f.implemented ? "cursor-pointer" : "cursor-not-allowed opacity-70"
                    } ${val ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`h-9 w-9 rounded-lg grid place-items-center shrink-0 ${val ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                            {T(f.ar, f.en)}
                            {!f.implemented && (
                              <span className="text-[9px] uppercase tracking-wide bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                                {T("قريبًا", "Soon")}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {T(f.desc_ar, f.desc_en)}
                          </div>
                          {f.depends_on && f.depends_on.length > 0 && (
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {T("يتطلب:", "Requires:")}{" "}
                              {f.depends_on.map((d) => (ar ? FEATURE_MAP[d]?.ar : FEATURE_MAP[d]?.en) ?? d).join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                      <Switch
                        checked={val}
                        disabled={!f.implemented}
                        onCheckedChange={(c) => toggle(f.key, c)}
                      />
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Bilingual labels for well-known document type codes. Code stays English
// everywhere; the label is only for display when the UI language is Arabic.
const DOC_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  // Sales & purchasing lifecycle
  RFQ: { ar: "طلب عرض سعر",         en: "Request for Quotation" },
  QT:  { ar: "عرض سعر",             en: "Quotation" },
  PR:  { ar: "طلب شراء",            en: "Purchase Requisition" },
  PO:  { ar: "أمر توريد",           en: "Purchase Order" },
  LPO: { ar: "أمر توريد محلي",      en: "Local Purchase Order" },
  CTR: { ar: "عقد",                 en: "Contract" },
  WO:  { ar: "أمر عمل",             en: "Work Order" },
  SO:  { ar: "أمر بيع",             en: "Sales Order" },
  PFI: { ar: "فاتورة مبدئية",       en: "Proforma Invoice" },
  INV: { ar: "فاتورة",              en: "Invoice" },
  TXI: { ar: "فاتورة ضريبية",       en: "Tax Invoice" },
  // Logistics & warehouse
  DN:  { ar: "إذن تسليم",           en: "Delivery Note" },
  GRN: { ar: "إذن استلام",          en: "Goods Receipt Note" },
  GIN: { ar: "إذن صرف",             en: "Goods Issue Note" },
  MTN: { ar: "إذن تحويل مخزني",     en: "Material Transfer Note" },
  RTV: { ar: "مرتجع مورد",          en: "Return to Vendor" },
  RTC: { ar: "مرتجع عميل",          en: "Customer Return" },
  PKL: { ar: "قائمة تعبئة",         en: "Packing List" },
  ASN: { ar: "إشعار شحن مسبق",      en: "Advance Shipment Notice" },
  STK: { ar: "تسوية مخزون",         en: "Stock Adjustment" },
  // Finance
  CN:  { ar: "إشعار دائن",          en: "Credit Note" },
  DBN: { ar: "إشعار مدين",          en: "Debit Note" },
  JV:  { ar: "قيد يومية",           en: "Journal Voucher" },
  PV:  { ar: "سند صرف",             en: "Payment Voucher" },
  RV:  { ar: "سند قبض",             en: "Receipt Voucher" },
  PC:  { ar: "عهدة نثرية",          en: "Petty Cash" },
  EXP: { ar: "مصروف",               en: "Expense Claim" },
  // HR & operations
  SAL: { ar: "مسير رواتب",          en: "Salary Slip" },
  QCR: { ar: "تقرير جودة",          en: "Quality Report" },
  MOM: { ar: "محضر اجتماع",         en: "Meeting Minutes" },
};

function docTypeLabel(code: string, isAr: boolean): string {
  const l = DOC_TYPE_LABELS[code.toUpperCase()];
  if (!l) return code;
  return isAr ? l.ar : l.en;
}

function StepNumbering({
  numbering, setNumbering, T, isAr,
}: {
  numbering: NumberingRow[];
  setNumbering: React.Dispatch<React.SetStateAction<NumberingRow[]>>;
  T: (ar: string, en: string) => string;
  isAr: boolean;
}) {
  const year = new Date().getFullYear();
  const preview = (r: NumberingRow) =>
    `${r.prefix}${r.year_segment ? `-${year}` : ""}-${String(r.next_seq).padStart(r.padding, "0")}`;

  const [addOpen, setAddOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newPrefix, setNewPrefix] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const takenTypes = new Set(numbering.map((n) => n.doc_type.toUpperCase()));
  const takenPrefixes = new Set(numbering.map((n) => n.prefix.toUpperCase()));

  function addRow() {
    const code = newCode.trim().toUpperCase();
    const pref = (newPrefix.trim() || code).toUpperCase();
    if (!code) return toast.error(T("النوع مطلوب", "Type is required"));
    if (!/^[A-Z0-9_-]+$/.test(code)) return toast.error(T("النوع لازم يكون إنجليزى", "Type must be English"));
    if (!/^[A-Z0-9_-]+$/.test(pref)) return toast.error(T("البادئة لازم تكون إنجليزى", "Prefix must be English"));
    if (takenTypes.has(code)) return toast.error(T("النوع موجود بالفعل", "Type already exists"));
    if (takenPrefixes.has(pref)) return toast.error(T("البادئة مستخدمة", "Prefix already used"));
    setNumbering((prev) => [...prev, { doc_type: code, prefix: pref, year_segment: true, padding: 6, next_seq: 1 }]);
    setNewCode(""); setNewPrefix(""); setAddOpen(false);
  }

  function removeRow(idx: number) {
    setNumbering((prev) => prev.filter((_, i) => i !== idx));
    setConfirmDelete(null);
  }

  // Suggest quick-add chips for common codes the user hasn't used yet.
  const suggestions = Object.keys(DOC_TYPE_LABELS).filter((c) => !takenTypes.has(c));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">{T("ترقيم المستندات", "Document Numbering")}</h3>
          <p className="text-sm text-muted-foreground">{T("خصّص صيغة ترقيم كل نوع مستند. الأكواد والبادئة بالإنجليزى دايمًا.", "Customize numbering for each document type. Codes and prefixes are always English.")}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 me-1.5" /> {T("إضافة نوع", "Add type")}
        </Button>
      </div>

      <div className="space-y-3">
        {numbering.map((row, i) => {
          const upd = (patch: Partial<NumberingRow>) =>
            setNumbering((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
          const label = docTypeLabel(row.doc_type, isAr);
          const dupPrefix = numbering.filter((n) => n.prefix.trim().toUpperCase() === row.prefix.trim().toUpperCase()).length > 1;
          return (
            <div key={`${row.doc_type}-${i}`} className="border rounded-xl p-4 grid md:grid-cols-12 gap-3 items-end bg-card/50">
              <div className="md:col-span-3">
                <Label className="text-xs text-muted-foreground">{T("النوع", "Type")}</Label>
                <div className="mt-1 h-9 px-3 flex items-center justify-between gap-2 bg-muted rounded-md">
                  <span className="text-sm font-medium truncate">{label}</span>
                  <Badge variant="secondary" className="font-mono text-[10px] shrink-0">{row.doc_type}</Badge>
                </div>
              </div>
              <div className="md:col-span-2">
                <Field label={T("البادئة", "Prefix")}>
                  <ScriptInput
                    script="en"
                    isAr={isAr}
                    value={row.prefix}
                    onChange={(v) => upd({ prefix: v.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })}
                    maxLength={8}
                    className={dupPrefix ? "border-destructive" : ""}
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label={T("خانات الرقم", "Padding")}>
                  <Input type="number" min={1} max={12} value={row.padding} onChange={(e) => upd({ padding: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })} />
                </Field>
              </div>
              <div className="md:col-span-2 flex items-center gap-2 h-9 mt-6">
                <Switch checked={row.year_segment} onCheckedChange={(c) => upd({ year_segment: c })} />
                <span className="text-sm">{T("إظهار السنة", "Include year")}</span>
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs text-muted-foreground">{T("معاينة", "Preview")}</Label>
                <div className="mt-1 h-9 px-3 grid items-center bg-primary/5 border border-primary/20 rounded-md font-mono text-sm text-primary" dir="ltr">
                  {preview(row)}
                </div>
              </div>
              <div className="md:col-span-1 flex md:justify-end">
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10" onClick={() => setConfirmDelete(i)} aria-label={T("حذف", "Delete")}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
        {numbering.length === 0 && (
          <div className="border border-dashed rounded-xl p-8 text-center text-sm text-muted-foreground">
            {T("لا توجد أنواع مستندات. اضغط \"إضافة نوع\" للبدء.", "No document types yet. Click \"Add type\" to start.")}
          </div>
        )}
      </div>

      {/* Add type dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{T("إضافة نوع مستند", "Add document type")}</DialogTitle>
            <DialogDescription>{T("الكود والبادئة لازم يكونوا إنجليزى.", "Code and prefix must be English.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {suggestions.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">{T("اقتراحات سريعة", "Quick suggestions")}</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {suggestions.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => { setNewCode(code); setNewPrefix(code); }}
                      className="text-xs px-2.5 py-1 rounded-full border hover:bg-muted transition-colors"
                    >
                      <span className="font-mono me-1.5">{code}</span>
                      <span className="text-muted-foreground">{docTypeLabel(code, isAr)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Field label={T("الكود (إنجليزى)", "Code (English)")}>
              <ScriptInput
                script="en" isAr={isAr} autoFocus
                value={newCode}
                onChange={(v) => {
                  const up = v.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
                  setNewCode(up);
                  if (!newPrefix || newPrefix === newCode) setNewPrefix(up);
                }}
                placeholder="e.g. RFQ"
                maxLength={8}
              />
              {newCode && DOC_TYPE_LABELS[newCode] && (
                <p className="text-xs text-muted-foreground mt-1">{docTypeLabel(newCode, isAr)}</p>
              )}
            </Field>
            <Field label={T("البادئة", "Prefix")}>
              <ScriptInput
                script="en" isAr={isAr}
                value={newPrefix}
                onChange={(v) => setNewPrefix(v.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                placeholder={newCode || "e.g. RFQ"}
                maxLength={8}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{T("إلغاء", "Cancel")}</Button>
            <Button onClick={addRow}>{T("إضافة", "Add")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{T("حذف نوع المستند؟", "Delete document type?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete !== null && numbering[confirmDelete] &&
                T(`سيتم حذف "${docTypeLabel(numbering[confirmDelete].doc_type, true)}" من إعدادات الترقيم.`,
                  `"${docTypeLabel(numbering[confirmDelete].doc_type, false)}" will be removed from numbering settings.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{T("إلغاء", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => confirmDelete !== null && removeRow(confirmDelete)}>
              {T("حذف", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  function openAdd() { setEditIndex(null); setOpen(true); }
  function openEdit(i: number) { setEditIndex(i); setOpen(true); }
  function daysLeft(date?: string | null): number | null {
    if (!date) return null;
    const d = new Date(date + "T00:00:00");
    if (isNaN(d.getTime())) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.ceil((d.getTime() - today.getTime()) / 86400000);
  }
  function expiryLabel(date?: string | null): { text: string; tone: "ok" | "warn" | "danger" } | null {
    const n = daysLeft(date);
    if (n === null) return null;
    if (n < 0) return { text: T(`منتهى منذ ${Math.abs(n)} يوم`, `expired ${Math.abs(n)}d ago`), tone: "danger" };
    if (n === 0) return { text: T("ينتهى اليوم", "expires today"), tone: "danger" };
    const tone = n <= 30 ? "warn" : "ok";
    return { text: T(`${n} يوم على التجديد`, `${n}d to renewal`), tone };
  }

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
            const exp = expiryLabel(d.expiry_date);
            const details = [d.doc_number, d.expiry_date && T(`ينتهى ${d.expiry_date}`, `exp ${d.expiry_date}`)]
              .filter(Boolean).join(" • ") || T("بدون تفاصيل", "no details");
            const toneClass =
              exp?.tone === "danger" ? "text-destructive font-semibold"
              : exp?.tone === "warn" ? "text-amber-600 dark:text-amber-500 font-medium"
              : "text-emerald-600 dark:text-emerald-500";
            return (
              <div
                key={i}
                className="group relative w-[113px] h-[113px] rounded-xl border bg-card hover:border-primary/60 hover:shadow-md transition flex flex-col items-center justify-center gap-1.5 p-2"
              >
                <button
                  type="button"
                  title={`${label}\n${details}${d.file ? `\n${d.file.name}` : ""}`}
                  onClick={() => openEdit(i)}
                  className="absolute inset-0 rounded-xl flex flex-col items-center justify-center gap-1.5 p-2"
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
                  {exp && (
                    <div className={`text-[9px] truncate w-full text-center px-1 ${toneClass}`}>
                      {exp.text}
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(i); }}
                  className="absolute -top-1.5 -end-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground grid place-items-center opacity-0 group-hover:opacity-100 transition shadow z-10"
                  aria-label={T("حذف", "Remove")}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
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

      <AlertDialog open={confirmDelete !== null} onOpenChange={(v) => { if (!v) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{T("تأكيد حذف المستند", "Confirm document deletion")}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete !== null && documents[confirmDelete]
                ? T(
                    `هل تريد فعلاً حذف «${isAr ? documents[confirmDelete].name_ar : documents[confirmDelete].name_en}»؟ لا يمكن التراجع.`,
                    `Delete "${isAr ? documents[confirmDelete].name_ar : documents[confirmDelete].name_en}"? This cannot be undone.`,
                  )
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{T("لا", "No")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelete !== null) {
                  const doc = documents[confirmDelete];
                  if (doc?.storage_path) void deleteCompanyDocumentDraft(doc.storage_path);
                  setDocuments((prev) => prev.filter((_, idx) => idx !== confirmDelete));
                }
                setConfirmDelete(null);
              }}
            >
              {T("نعم، احذف", "Yes, delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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


  const [uploadingFile, setUploadingFile] = useState(false);

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

  async function handleFilePick(f: File | null) {
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) {
      toast.error(T("الحجم أكبر من 15MB", "File is larger than 15MB"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploadingFile(true);
    try {
      const oldPath = form.storage_path;
      const { path, url } = await uploadCompanyDocumentDraft(f);
      setForm((prev) => ({
        ...prev,
        file: null,
        storage_path: path,
        file_name: f.name,
        file_type: f.type,
        file_size: f.size,
        file_data_url: url, // signed URL kept only in memory for preview
        has_file: true,
      }));
      if (oldPath && oldPath !== path) void deleteCompanyDocumentDraft(oldPath);
    } catch (e: any) {
      toast.error(e?.message ?? T("فشل رفع الملف", "Failed to upload the file"));
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setUploadingFile(false);
    }
  }

  function clearFile() {
    const p = form.storage_path;
    setForm((f) => ({ ...f, file: null, file_name: null, file_type: null, file_size: null, file_data_url: null, storage_path: null, has_file: false }));
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (p) void deleteCompanyDocumentDraft(p);
  }

  async function addOrUpdate() {
    if (!form.code || !form.name_ar || !form.name_en) {
      toast.error(T("اختر نوع المستند", "Choose a document type"));
      return;
    }
    if (uploadingFile) {
      toast.error(T("جارٍ رفع الملف…", "File is still uploading…"));
      return;
    }
    const hasFile = !!form.storage_path || !!form.has_file;
    if (!hasFile) {
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
      file: null,
      file_name: form.file_name ?? null,
      file_type: form.file_type ?? null,
      file_size: form.file_size ?? null,
      file_data_url: form.file_data_url ?? null,
      storage_path: form.storage_path ?? null,
      has_file: hasFile,
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
    const doc = documents[i];
    if (doc?.storage_path) void deleteCompanyDocumentDraft(doc.storage_path);
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
                  let expText: string | null = null;
                  let expTone = "text-muted-foreground";
                  if (d.expiry_date) {
                    const dt = new Date(d.expiry_date + "T00:00:00");
                    if (!isNaN(dt.getTime())) {
                      const today = new Date(); today.setHours(0, 0, 0, 0);
                      const n = Math.ceil((dt.getTime() - today.getTime()) / 86400000);
                      if (n < 0) { expText = T(`منتهى -${Math.abs(n)}ي`, `exp -${Math.abs(n)}d`); expTone = "text-destructive font-semibold"; }
                      else if (n === 0) { expText = T("ينتهى اليوم", "today"); expTone = "text-destructive font-semibold"; }
                      else { expText = T(`${n} يوم`, `${n}d`); expTone = n <= 30 ? "text-amber-600 dark:text-amber-500 font-medium" : "text-emerald-600 dark:text-emerald-500"; }
                    }
                  }
                  return (
                    <div
                      key={i}
                      title={`${label}\n${details}${d.file ? `\n${d.file.name}` : ""}`}
                      className={`group relative w-[76px] h-[76px] rounded-lg border bg-card hover:border-primary/60 hover:shadow-sm transition cursor-pointer flex flex-col items-center justify-center gap-0.5 p-1.5 ${editingIndex === i ? "border-primary ring-2 ring-primary/20 bg-primary/5" : ""}`}
                      onClick={() => edit(i)}
                    >
                      <div className="relative">
                        <div className="h-7 w-7 rounded-md bg-primary/10 text-primary grid place-items-center">
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
                      {expText && (
                        <div className={`text-[9px] truncate w-full text-center ${expTone}`}>{expText}</div>
                      )}
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
                  disabled={uploadingFile}
                  onChange={(e) => { void handleFilePick(e.target.files?.[0] ?? null); }}
                />
                {uploadingFile ? (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {T("جارٍ رفع الملف…", "Uploading…")}
                  </div>
                ) : (form.storage_path || form.file_name) ? (
                  <div className="text-[11px] text-muted-foreground flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 min-w-0 truncate">
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <span className="truncate">{form.file_name ?? T("ملف مرفوع", "Uploaded file")}</span>
                      {form.file_size ? (
                        <span className="shrink-0">· {(form.file_size / 1024).toFixed(1)} KB</span>
                      ) : null}
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

