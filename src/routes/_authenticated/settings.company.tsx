import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useCurrentCompany, useUpdateCompany } from "@/features/company/queries";
import { uploadCompanyLogo, type ContactEntry } from "@/features/company/api";
import { useDocumentTypes } from "@/features/companyDocs/queries";
import { useNumberingSeries } from "@/features/foundation/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  Building2, Save, Loader2, ImagePlus, X, Mail, Phone, Smartphone, Printer, Globe,
  MapPin, CheckCircle2, ArrowRight, ArrowLeft, FolderArchive, Hash, ExternalLink, Plus, Trash2, Star, AlertCircle, Sparkles,
} from "lucide-react";
import { ScriptInput } from "@/components/ScriptInput";
import { COUNTRIES, applyMask, getCountry, validateEmail, validateRule, validateWebsite, type FieldValidation } from "@/lib/countryFormats";
import { getStates, getCities, hasGeo } from "@/lib/geoData";

export const Route = createFileRoute("/_authenticated/settings/company")({
  component: SettingsCompanyPage,
  head: () => ({ meta: [{ title: "بيانات الشركة | Company Data" }] }),
});

// ─────────────────────────────────────────────────────────────────────────
// Local helpers (mirror the /setup wizard behavior)
// ─────────────────────────────────────────────────────────────────────────
function sanitize(list: ContactEntry[] | null | undefined): ContactEntry[] {
  if (!list?.length) return [];
  const clean = list
    .map((e) => ({ value: (e.value ?? "").trim(), label: e.label?.trim() || null, is_primary: !!e.is_primary }))
    .filter((e) => e.value.length > 0);
  if (!clean.length) return [];
  if (!clean.some((e) => e.is_primary)) clean[0].is_primary = true;
  let seen = false;
  for (const e of clean) { if (e.is_primary && !seen) seen = true; else e.is_primary = false; }
  return clean;
}

// ─────────────────────────────────────────────────────────────────────────
// Multi-contact field (self-contained, mirrors the wizard)
// ─────────────────────────────────────────────────────────────────────────
function MultiContact({
  label, icon: Icon, values, onChange, placeholder, hint, format, validate, T, isAr, type, inputMode,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  values: ContactEntry[];
  onChange: (list: ContactEntry[]) => void;
  placeholder?: string;
  hint?: string;
  format?: (v: string) => string;
  validate?: (v: string) => FieldValidation;
  T: (ar: string, en: string) => string;
  isAr: boolean;
  type?: "text" | "email";
  inputMode?: "tel" | "text" | "email";
}) {
  const list = values.length ? values : [{ value: "", label: "", is_primary: true }];
  const update = (i: number, patch: Partial<ContactEntry>) => onChange(list.map((e, idx) => idx === i ? { ...e, ...patch } : e));
  const setPrimary = (i: number) => onChange(list.map((e, idx) => ({ ...e, is_primary: idx === i })));
  const add = () => {
    const next = [...list, { value: "", label: "", is_primary: false }];
    if (!next.some((e) => e.is_primary)) next[0].is_primary = true;
    onChange(next);
  };
  const remove = (i: number) => {
    const next = list.filter((_, idx) => idx !== i);
    if (next.length && !next.some((e) => e.is_primary)) next[0].is_primary = true;
    onChange(next);
  };
  const anyInvalid = list.some((e) => {
    const v = (e.value ?? "").trim();
    if (!v) return true;
    if (!validate) return false;
    return !validate(v).ok;
  });
  return (
    <div className="space-y-1.5">
      <Label className="text-sm flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{label}</span>
      </Label>
      <div className="space-y-2">
        {list.map((entry, i) => {
          const trimmed = (entry.value ?? "").trim();
          const v = trimmed ? validate?.(trimmed) : undefined;
          let error: string | undefined;
          if (!trimmed && list.length > 1) error = T("لازم تملأ ده أو تحذفه", "Fill this or remove it");
          else if (v && !v.ok && trimmed) error = isAr ? v.error?.ar : v.error?.en;
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setPrimary(i)} title={T("تعيين كأساسى", "Set as primary")}
                  className={`shrink-0 h-9 w-9 grid place-items-center rounded-md border transition-colors ${
                    entry.is_primary ? "bg-primary/10 border-primary text-primary" : "border-input text-muted-foreground hover:text-foreground"
                  }`}>
                  <Star className={`h-4 w-4 ${entry.is_primary ? "fill-current" : ""}`} />
                </button>
                <Input dir="ltr" type={type ?? "text"} inputMode={inputMode} value={entry.value}
                  onChange={(e) => update(i, { value: format ? format(e.target.value) : e.target.value })}
                  placeholder={placeholder}
                  className={`flex-1 ${error ? "border-destructive focus-visible:ring-destructive/40" : ""}`} />
                <button type="button" onClick={() => remove(i)} disabled={list.length <= 1 && !entry.value}
                  title={T("حذف", "Remove")}
                  className="shrink-0 h-9 w-9 grid place-items-center rounded-md border border-input text-muted-foreground hover:text-destructive hover:border-destructive disabled:opacity-40 disabled:cursor-not-allowed">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {error && (
                <div className="ps-11 flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" /><span>{error}</span>
                </div>
              )}
            </div>
          );
        })}
        <button type="button" onClick={add} disabled={anyInvalid}
          className="text-xs text-primary hover:underline flex items-center gap-1 disabled:text-muted-foreground disabled:hover:no-underline disabled:cursor-not-allowed">
          <Plus className="h-3.5 w-3.5" />{T("إضافة", "Add another")}
        </button>
      </div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Fiscal-year helpers (identical to setup wizard)
// ─────────────────────────────────────────────────────────────────────────
const MONTHS: [string, string, string][] = [
  ["01", "يناير", "January"], ["02", "فبراير", "February"], ["03", "مارس", "March"],
  ["04", "أبريل", "April"], ["05", "مايو", "May"], ["06", "يونيو", "June"],
  ["07", "يوليو", "July"], ["08", "أغسطس", "August"], ["09", "سبتمبر", "September"],
  ["10", "أكتوبر", "October"], ["11", "نوفمبر", "November"], ["12", "ديسمبر", "December"],
];
const parseMD = (v?: string | null) => {
  if (!v) return { m: "", d: "" };
  const p = v.split("-"); return { m: p[1] ?? "", d: p[2] ?? "" };
};
const composeMD = (m: string, d: string) => (m && d ? `2000-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : null);
const daysInMonth = (m: string) => {
  if (!m) return 31; const mi = parseInt(m, 10);
  if (mi === 2) return 29; if ([4, 6, 9, 11].includes(mi)) return 30; return 31;
};

// ─────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────
const STEPS = [
  { key: "general",   ar: "عام",         en: "General",   icon: Building2 },
  { key: "advanced",  ar: "متقدم",       en: "Advanced",  icon: MapPin },
  { key: "documents", ar: "الوثائق",     en: "Documents", icon: FolderArchive },
  { key: "numbering", ar: "الترقيم",     en: "Numbering", icon: Hash },
] as const;
type StepKey = typeof STEPS[number]["key"];

function SettingsCompanyPage() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const { data: company, isLoading } = useCurrentCompany();
  const update = useUpdateCompany();

  const [step, setStep] = useState<StepKey>("general");
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [logoUploading, setLogoUploading] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (company) setForm(company as Record<string, unknown>);
  }, [company]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  if (isLoading || !company) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground" dir={dir}>
        <Loader2 className="h-5 w-5 animate-spin me-2" />
        {T("جاري التحميل...", "Loading...")}
      </div>
    );
  }

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const get = <T,>(k: string, def?: T): T => (form[k] as T) ?? (def as T);

  const save = async (fields: string[]) => {
    const patch: Record<string, unknown> = {};
    for (const k of fields) {
      const v = form[k];
      if (k === "emails" || k === "phones" || k === "mobiles" || k === "faxes" || k === "websites") {
        patch[k] = sanitize(v as ContactEntry[]);
      } else {
        patch[k] = v ?? null;
      }
    }
    try {
      await update.mutateAsync({ id: company.id, patch });
      toast.success(T("تم الحفظ", "Saved"));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || T("فشل الحفظ", "Save failed"));
    }
  };

  const handleLogo = async (file: File) => {
    setLogoUploading(true);
    try {
      const { url } = await uploadCompanyLogo(file);
      await update.mutateAsync({ id: company.id, patch: { logo_url: url } });
      set("logo_url", url);
      toast.success(T("تم تحديث الشعار", "Logo updated"));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || T("فشل الرفع", "Upload failed"));
    } finally {
      setLogoUploading(false);
    }
  };

  const goNext = () => { if (stepIndex < STEPS.length - 1) { setStep(STEPS[stepIndex + 1].key); window.scrollTo({ top: 0, behavior: "smooth" }); } };
  const goPrev = () => { if (stepIndex > 0) { setStep(STEPS[stepIndex - 1].key); window.scrollTo({ top: 0, behavior: "smooth" }); } };

  return (
    <div className="space-y-6" dir={dir}>
      {/* Sticky wizard header */}
      <div className={`sticky top-16 z-20 -mx-4 px-4 py-3 backdrop-blur bg-background/90 border-b transition-all ${scrolled ? "shadow-sm" : ""}`}>
        {scrolled ? (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
              {(() => { const I = STEPS[stepIndex].icon; return <I className="h-4 w-4" />; })()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground">{T("الخطوة", "Step")} {stepIndex + 1}/{STEPS.length}</div>
              <div className="text-sm font-semibold truncate">{T(STEPS[stepIndex].ar, STEPS[stepIndex].en)}</div>
            </div>
            <div className="text-sm font-bold text-primary tabular-nums">{progress}%</div>
            <div className="h-1.5 flex-1 max-w-[200px] bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
                  {get<string | null>("logo_url")
                    ? <img src={get<string>("logo_url")} alt="" className="h-full w-full object-cover" />
                    : <Building2 className="h-5 w-5 text-primary" />}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{T("بيانات الشركة", "Company Data")}</h2>
                  <p className="text-xs text-muted-foreground">
                    {T("عدّل بيانات شركتك في 4 خطوات — كل خطوة تحفظ لوحدها.",
                       "Edit your company in 4 steps — each step saves independently.")}
                  </p>
                </div>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/setup"><ExternalLink className="h-3.5 w-3.5 me-1" /> {T("معالج الإعداد الأولي", "Initial Setup")}</Link>
              </Button>
            </div>

            {/* Stepper */}
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const active = s.key === step;
                const done = i < stepIndex;
                return (
                  <button key={s.key} type="button" onClick={() => setStep(s.key)}
                    className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${
                      active ? "bg-primary text-primary-foreground border-primary shadow-sm"
                             : done ? "bg-primary/10 text-primary border-primary/30"
                                    : "bg-background text-muted-foreground border-input hover:border-primary/40 hover:text-foreground"
                    }`}>
                    <div className={`h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold ${
                      active ? "bg-primary-foreground/20" : done ? "bg-primary/20" : "bg-muted"
                    }`}>
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                    </div>
                    <Icon className="h-3.5 w-3.5" />
                    <span className="whitespace-nowrap">{T(s.ar, s.en)}</span>
                  </button>
                );
              })}
            </div>

            {/* Progress */}
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Step content */}
      <div className="min-h-[400px]">
        {step === "general"   && <StepGeneral  form={form} set={set} get={get} T={T} isAr={ar} onLogo={handleLogo} logoUploading={logoUploading} />}
        {step === "advanced"  && <StepAdvanced form={form} set={set} get={get} setForm={setForm} T={T} isAr={ar} />}
        {step === "documents" && <StepDocuments T={T} />}
        {step === "numbering" && <StepNumbering T={T} />}
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between gap-3 pt-4 border-t sticky bottom-0 bg-background/95 backdrop-blur -mx-4 px-4 py-3">
        <Button variant="outline" size="sm" onClick={goPrev} disabled={stepIndex === 0}>
          {ar ? <ArrowRight className="h-4 w-4 me-1" /> : <ArrowLeft className="h-4 w-4 me-1" />}
          {T("السابق", "Previous")}
        </Button>

        <div className="flex items-center gap-2">
          {step === "general" && (
            <Button size="sm" onClick={() =>
              save(["name", "name_ar", "short_name", "code", "cr_no", "tax_no", "vat_no",
                    "emails", "phones", "mobiles", "faxes", "websites", "email", "phone", "mobile", "fax", "website"])
            } disabled={update.isPending}>
              {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin me-1" /> : <Save className="h-3.5 w-3.5 me-1" />}
              {T("حفظ الخطوة", "Save Step")}
            </Button>
          )}
          {step === "advanced" && (
            <Button size="sm" onClick={() =>
              save(["country", "state", "city", "postal_code", "address", "default_language",
                    "timezone", "date_format", "number_format", "base_currency",
                    "fiscal_year_start", "fiscal_year_end",
                    "gm_name", "purchasing_manager", "sales_manager", "finance_manager", "notes"])
            } disabled={update.isPending}>
              {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin me-1" /> : <Save className="h-3.5 w-3.5 me-1" />}
              {T("حفظ الخطوة", "Save Step")}
            </Button>
          )}
        </div>

        <Button size="sm" onClick={goNext} disabled={stepIndex === STEPS.length - 1}>
          {T("التالي", "Next")}
          {ar ? <ArrowLeft className="h-4 w-4 ms-1" /> : <ArrowRight className="h-4 w-4 ms-1" />}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 1 — General
// ─────────────────────────────────────────────────────────────────────────
function StepGeneral({ form, set, get, T, isAr, onLogo, logoUploading }: {
  form: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  get: <T,>(k: string, def?: T) => T;
  T: (a: string, e: string) => string;
  isAr: boolean;
  onLogo: (f: File) => void;
  logoUploading: boolean;
}) {
  const country = get<string>("country", "EG");
  const c = getCountry(country || "EG");

  return (
    <div className="space-y-8">
      {/* Identity */}
      <section className="space-y-4">
        <SectionHeader n={1} T={T} title={T("الهوية والعلامة", "Identity & Branding")} />
        <Card className="border-none bg-gradient-to-br from-muted/40 to-transparent">
          <CardContent className="p-4 sm:p-6">
            <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-8 items-start">
              {/* Logo */}
              <div className="relative justify-self-center md:justify-self-start">
                <label className="relative group cursor-pointer block">
                  <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-background grid place-items-center overflow-hidden group-hover:border-primary/60 transition-colors">
                    {logoUploading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> :
                      get<string | null>("logo_url") ? <img src={get<string>("logo_url")} alt="logo" className="h-full w-full object-contain" /> :
                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                          <ImagePlus className="h-7 w-7" />
                          <span className="text-[10px] font-medium">{T("اللوجو", "Logo")}</span>
                        </div>}
                  </div>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => e.target.files?.[0] && onLogo(e.target.files[0])} />
                  <div className="mt-2 text-[11px] text-muted-foreground text-center">
                    {get<string | null>("logo_url") ? T("انقر للتغيير", "Click to change") : T("انقر للرفع", "Click to upload")}
                  </div>
                </label>
                {get<string | null>("logo_url") && !logoUploading && (
                  <button type="button"
                    onClick={(e) => { e.preventDefault(); set("logo_url", null); }}
                    aria-label={T("حذف اللوجو", "Remove logo")}
                    className="absolute -top-2 -end-2 h-7 w-7 rounded-full bg-destructive text-destructive-foreground shadow-lg grid place-items-center hover:scale-110 transition-transform">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Name grid */}
              <div className="grid gap-4 sm:grid-cols-2 min-w-0">
                <SmartField label={T("الاسم بالإنجليزى", "Company Name (English)")} icon={Building2}>
                  <ScriptInput script="en" isAr={isAr} className="h-11"
                    value={get<string>("name", "")} onChange={(v) => set("name", v)} />
                </SmartField>
                <SmartField label={T("الاسم بالعربى", "Company Name (Arabic)")} icon={Building2}>
                  <ScriptInput script="ar" isAr={isAr} className="h-11"
                    value={get<string>("name_ar", "")} onChange={(v) => set("name_ar", v)} />
                </SmartField>
                <SmartField label={T("الاسم المختصر", "Short Name")}
                  hint={T("يظهر في القائمة الجانبية", "Shown in the sidebar")}>
                  <Input className="h-11" value={get<string>("short_name", "")}
                    onChange={(e) => set("short_name", e.target.value)} placeholder="EEC" />
                </SmartField>
                <SmartField label={T("الكود", "Company Code")}>
                  <Input className="h-11 uppercase" value={get<string>("code", "")}
                    onChange={(e) => set("code", e.target.value.toUpperCase())} />
                </SmartField>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Registration numbers */}
      <section className="space-y-4">
        <SectionHeader n={2} T={T} title={T("أرقام التسجيل", "Registration Numbers")} />
        <Card className="border-none bg-gradient-to-br from-muted/40 to-transparent">
          <CardContent className="p-4 sm:p-6 grid gap-4 md:grid-cols-3">
            <SmartField label={T("السجل التجاري", "Commercial Reg.")}>
              <Input className="h-11" value={get<string>("cr_no", "")} onChange={(e) => set("cr_no", e.target.value)} />
            </SmartField>
            <SmartField label={T("الرقم الضريبي", "Tax No.")}>
              <Input className="h-11" value={get<string>("tax_no", "")} onChange={(e) => set("tax_no", e.target.value)} />
            </SmartField>
            <SmartField label={T("رقم القيمة المضافة", "VAT No.")}>
              <Input className="h-11" value={get<string>("vat_no", "")} onChange={(e) => set("vat_no", e.target.value)} />
            </SmartField>
          </CardContent>
        </Card>
      </section>

      {/* Phone numbers */}
      <section className="space-y-4">
        <SectionHeader n={3} T={T} title={T("أرقام الاتصال", "Phone Numbers")}
          right={<div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Star className="h-3 w-3 fill-primary text-primary" />{T("النجمة = الأساسى", "Star = primary")}
          </div>} />
        <Card className="border-none bg-gradient-to-br from-muted/40 to-transparent">
          <CardContent className="p-4 sm:p-6 grid gap-4 md:gap-5 md:grid-cols-3">
            <MultiContact label={T("موبايل", "Mobile")} icon={Smartphone}
              values={get<ContactEntry[]>("mobiles", [])} onChange={(l) => set("mobiles", l)}
              placeholder={c.mobile?.example}
              hint={c.mobile ? (isAr ? c.mobile.hintAr : c.mobile.hintEn) : undefined}
              format={(v) => (c.mobile ? applyMask(v, c.mobile) : v)}
              validate={(v) => validateRule(v, c.mobile)}
              T={T} isAr={isAr} inputMode="tel" />
            <MultiContact label={T("تليفون أرضى", "Landline")} icon={Phone}
              values={get<ContactEntry[]>("phones", [])} onChange={(l) => set("phones", l)}
              placeholder={c.phone?.example}
              hint={c.phone ? (isAr ? c.phone.hintAr : c.phone.hintEn) : undefined}
              format={(v) => (c.phone ? applyMask(v, c.phone) : v)}
              validate={(v) => validateRule(v, c.phone)}
              T={T} isAr={isAr} inputMode="tel" />
            <MultiContact label={T("فاكس", "Fax")} icon={Printer}
              values={get<ContactEntry[]>("faxes", [])} onChange={(l) => set("faxes", l)}
              placeholder={c.phone?.example}
              format={(v) => (c.phone ? applyMask(v, c.phone) : v)}
              T={T} isAr={isAr} inputMode="tel" />
          </CardContent>
        </Card>
      </section>

      {/* Digital presence */}
      <section className="space-y-4">
        <SectionHeader n={4} T={T} title={T("التواجد الرقمى", "Digital Presence")} />
        <Card className="border-none bg-gradient-to-br from-muted/40 to-transparent">
          <CardContent className="p-4 sm:p-6 grid gap-4 md:gap-5 md:grid-cols-2">
            <MultiContact label={T("البريد الإلكتروني", "Email")} icon={Mail}
              values={get<ContactEntry[]>("emails", [])} onChange={(l) => set("emails", l)}
              placeholder="info@company.com"
              hint={T("الأساسى يُستخدم لإرسال الإشعارات", "Primary is used for outbound mail")}
              validate={validateEmail}
              T={T} isAr={isAr} type="email" />
            <MultiContact label={T("الموقع الإلكتروني", "Website")} icon={Globe}
              values={get<ContactEntry[]>("websites", [])} onChange={(l) => set("websites", l)}
              placeholder="https://company.com"
              validate={validateWebsite}
              T={T} isAr={isAr} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 2 — Advanced
// ─────────────────────────────────────────────────────────────────────────
function StepAdvanced({ form, set, get, setForm, T, isAr }: {
  form: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  get: <T,>(k: string, def?: T) => T;
  setForm: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  T: (a: string, e: string) => string;
  isAr: boolean;
}) {
  const country = get<string>("country", "EG") || "EG";
  const hasGeoData = hasGeo(country);
  const states = hasGeoData ? getStates(country) : [];
  const cities = hasGeoData ? getCities(country, get<string>("state", "")) : [];
  const fs = parseMD(get<string | null>("fiscal_year_start"));
  const fe = parseMD(get<string | null>("fiscal_year_end"));

  return (
    <div className="space-y-8">
      {/* Address */}
      <section className="space-y-4">
        <SectionHeader n={1} T={T} title={T("العنوان", "Address")} />
        <Card className="border-none bg-gradient-to-br from-muted/40 to-transparent">
          <CardContent className="p-4 sm:p-6 grid gap-4 md:grid-cols-2">
            <SmartField label={T("الدولة", "Country")} icon={MapPin}>
              <SearchableSelect value={country}
                onValueChange={(v) => setForm((f) => ({ ...f, country: v, state: "", city: "" }))}
                className="h-11" dir={isAr ? "rtl" : "ltr"}
                searchPlaceholder={T("ابحث…", "Search…")} emptyText={T("لا توجد نتائج", "No results")}
                options={COUNTRIES.map((cc): SearchableSelectOption => ({
                  value: cc.code, label: isAr ? cc.labelAr : cc.labelEn,
                  keywords: `${cc.labelAr} ${cc.labelEn} ${cc.code}`,
                }))} />
            </SmartField>
            <SmartField label={T("المحافظة / المنطقة", "State / Governorate")}>
              {hasGeoData ? (
                <SearchableSelect value={get<string>("state", "")}
                  onValueChange={(v) => setForm((f) => ({ ...f, state: v, city: "" }))}
                  className="h-11" placeholder={T("اختر المحافظة", "Select governorate")}
                  searchPlaceholder={T("ابحث…", "Search…")} emptyText={T("لا توجد نتائج", "No results")}
                  options={states.map((s): SearchableSelectOption => ({
                    value: s.key, label: T(s.ar, s.en), keywords: `${s.ar} ${s.en} ${s.key}`,
                  }))} />
              ) : (
                <Input className="h-11" value={get<string>("state", "")}
                  onChange={(e) => set("state", e.target.value)} />
              )}
            </SmartField>
            <SmartField label={T("المدينة", "City")}>
              {hasGeoData ? (
                <SearchableSelect value={get<string>("city", "")}
                  onValueChange={(v) => set("city", v)}
                  disabled={!get<string>("state")}
                  className="h-11"
                  placeholder={get<string>("state") ? T("اختر المدينة", "Select city") : T("اختر المحافظة أولاً", "Pick governorate first")}
                  searchPlaceholder={T("ابحث…", "Search…")} emptyText={T("لا توجد نتائج", "No results")}
                  options={cities.map((ct): SearchableSelectOption => ({
                    value: ct.en, label: T(ct.ar, ct.en), keywords: `${ct.ar} ${ct.en}`,
                  }))} />
              ) : (
                <Input className="h-11" value={get<string>("city", "")}
                  onChange={(e) => set("city", e.target.value)} />
              )}
            </SmartField>
            <SmartField label={T("الرمز البريدي", "Postal Code")}>
              <Input className="h-11" value={get<string>("postal_code", "")}
                onChange={(e) => set("postal_code", e.target.value)} />
            </SmartField>
            <div className="md:col-span-2">
              <SmartField label={T("العنوان الكامل", "Full Address")}>
                <Textarea rows={2} value={get<string>("address", "")}
                  onChange={(e) => set("address", e.target.value)} />
              </SmartField>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Regional */}
      <section className="space-y-4">
        <SectionHeader n={2} T={T} title={T("الإعدادات الإقليمية", "Regional Settings")} />
        <Card className="border-none bg-gradient-to-br from-muted/40 to-transparent">
          <CardContent className="p-4 sm:p-6 grid gap-4 md:grid-cols-2">
            <SmartField label={T("اللغة الافتراضية", "Default Language")}>
              <Select value={get<string>("default_language", "ar")}
                onValueChange={(v) => set("default_language", v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </SmartField>
            <SmartField label={T("المنطقة الزمنية", "Time Zone")}>
              <SearchableSelect value={get<string>("timezone", "Africa/Cairo")}
                onValueChange={(v) => set("timezone", v)} className="h-11"
                searchPlaceholder={T("ابحث…", "Search…")} emptyText={T("لا توجد نتائج", "No results")}
                options={[
                  { value: "Africa/Cairo", label: "Africa/Cairo" },
                  { value: "Europe/London", label: "Europe/London" },
                  { value: "Europe/Berlin", label: "Europe/Berlin" },
                  { value: "Asia/Riyadh", label: "Asia/Riyadh" },
                  { value: "Asia/Dubai", label: "Asia/Dubai" },
                  { value: "UTC", label: "UTC" },
                ]} />
            </SmartField>
            <SmartField label={T("صيغة التاريخ", "Date Format")}>
              <Select value={get<string>("date_format", "DD/MM/YYYY")}
                onValueChange={(v) => set("date_format", v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </SmartField>
            <SmartField label={T("صيغة الأرقام", "Number Format")}>
              <Select value={get<string>("number_format", "#,##0.00")}
                onValueChange={(v) => set("number_format", v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="#,##0.00">1,234.56</SelectItem>
                  <SelectItem value="#.##0,00">1.234,56</SelectItem>
                  <SelectItem value="# ##0.00">1 234.56</SelectItem>
                </SelectContent>
              </Select>
            </SmartField>
          </CardContent>
        </Card>
      </section>

      {/* Financial */}
      <section className="space-y-4">
        <SectionHeader n={3} T={T} title={T("الإعدادات المالية", "Financial Settings")} />
        <Card className="border-none bg-gradient-to-br from-muted/40 to-transparent">
          <CardContent className="p-4 sm:p-6 grid gap-4 md:grid-cols-2">
            <SmartField label={T("العملة الأساسية", "Base Currency")}>
              <SearchableSelect value={get<string>("base_currency", "EGP")}
                onValueChange={(v) => set("base_currency", v)} className="h-11"
                searchPlaceholder={T("ابحث…", "Search…")} emptyText={T("لا توجد نتائج", "No results")}
                options={[
                  { value: "EGP", label: "EGP - جنيه مصري", keywords: "egyptian pound" },
                  { value: "USD", label: "USD - US Dollar" },
                  { value: "EUR", label: "EUR - Euro" },
                  { value: "GBP", label: "GBP - British Pound" },
                  { value: "SAR", label: "SAR - Saudi Riyal" },
                  { value: "AED", label: "AED - UAE Dirham" },
                  { value: "KWD", label: "KWD - Kuwaiti Dinar" },
                  { value: "QAR", label: "QAR - Qatari Riyal" },
                ]} />
            </SmartField>
            <div />
            <SmartField label={T("بداية السنة المالية (يوم/شهر)", "Fiscal Year Start (day/month)")}>
              <div className="grid grid-cols-2 gap-2">
                <Select value={fs.d}
                  onValueChange={(v) => set("fiscal_year_start", composeMD(fs.m || "01", v))}>
                  <SelectTrigger className="h-11"><SelectValue placeholder={T("يوم", "Day")} /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: daysInMonth(fs.m) }, (_, i) => String(i + 1).padStart(2, "0")).map((d) =>
                      <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={fs.m}
                  onValueChange={(v) => set("fiscal_year_start", composeMD(v, fs.d || "01"))}>
                  <SelectTrigger className="h-11"><SelectValue placeholder={T("شهر", "Month")} /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(([val, ar, en]) => <SelectItem key={val} value={val}>{T(ar, en)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </SmartField>
            <SmartField label={T("نهاية السنة المالية (يوم/شهر)", "Fiscal Year End (day/month)")}>
              <div className="grid grid-cols-2 gap-2">
                <Select value={fe.d}
                  onValueChange={(v) => set("fiscal_year_end", composeMD(fe.m || "12", v))}>
                  <SelectTrigger className="h-11"><SelectValue placeholder={T("يوم", "Day")} /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: daysInMonth(fe.m) }, (_, i) => String(i + 1).padStart(2, "0")).map((d) =>
                      <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={fe.m}
                  onValueChange={(v) => set("fiscal_year_end", composeMD(v, fe.d || "31"))}>
                  <SelectTrigger className="h-11"><SelectValue placeholder={T("شهر", "Month")} /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(([val, ar, en]) => <SelectItem key={val} value={val}>{T(ar, en)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </SmartField>
          </CardContent>
        </Card>
      </section>

      {/* Managers */}
      <section className="space-y-4">
        <SectionHeader n={4} T={T} title={T("المسؤولون الرئيسيون", "Key Managers")} />
        <Card className="border-none bg-gradient-to-br from-muted/40 to-transparent">
          <CardContent className="p-4 sm:p-6 grid gap-4 md:grid-cols-2">
            <SmartField label={T("المدير العام", "General Manager")}>
              <Input className="h-11" value={get<string>("gm_name", "")}
                onChange={(e) => set("gm_name", e.target.value)} />
            </SmartField>
            <SmartField label={T("مدير المشتريات", "Procurement Manager")}>
              <Input className="h-11" value={get<string>("purchasing_manager", "")}
                onChange={(e) => set("purchasing_manager", e.target.value)} />
            </SmartField>
            <SmartField label={T("مدير المبيعات", "Sales Manager")}>
              <Input className="h-11" value={get<string>("sales_manager", "")}
                onChange={(e) => set("sales_manager", e.target.value)} />
            </SmartField>
            <SmartField label={T("المدير المالي", "Finance Manager")}>
              <Input className="h-11" value={get<string>("finance_manager", "")}
                onChange={(e) => set("finance_manager", e.target.value)} />
            </SmartField>
            <div className="md:col-span-2">
              <SmartField label={T("ملاحظات داخلية", "Internal Notes")}>
                <Textarea rows={3} value={get<string>("notes", "")}
                  onChange={(e) => set("notes", e.target.value)} />
              </SmartField>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 3 — Documents (summary + link to full manager)
// ─────────────────────────────────────────────────────────────────────────
function StepDocuments({ T }: { T: (a: string, e: string) => string }) {
  const { data: types = [], isLoading } = useDocumentTypes();
  return (
    <div className="space-y-4">
      <SectionHeader n={1} T={T} title={T("وثائق الشركة", "Company Documents")} />
      <Card>
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            {T("إدارة كاملة لأنواع المستندات (السجل التجاري، البطاقة الضريبية، …) والتنبيهات وقوالبها تتم من الشاشة المخصصة.",
               "Full management of document types (Commercial Register, Tax Card, …), reminders and templates happens in the dedicated screen.")}
          </p>

          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />{T("جاري تحميل الأنواع…", "Loading types…")}
            </div>
          ) : types.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed p-8 text-center">
              <FolderArchive className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <div className="text-sm font-medium">{T("لم يتم إعداد أي أنواع مستندات بعد", "No document types configured yet")}</div>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                {T("أضف أول نوع للبدء في تتبع صلاحيات المستندات.", "Add your first type to start tracking document validity.")}
              </p>
              <Button asChild size="sm">
                <Link to="/settings/document-types"><Plus className="h-3.5 w-3.5 me-1" />{T("إضافة نوع", "Add Type")}</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {types.slice(0, 9).map((t) => (
                  <div key={t.id} className="rounded-xl border p-3 hover:border-primary/40 transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">{t.code}</Badge>
                      {t.is_system && <span className="text-[9px] text-muted-foreground uppercase">{T("افتراضى", "System")}</span>}
                    </div>
                    <div className="text-sm font-medium truncate">{t.name_ar}</div>
                    <div className="text-xs text-muted-foreground truncate">{t.name_en}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {T("تنبيه قبل", "Alert")} {t.notify_days_before} {T("يوم", "days")}
                    </div>
                  </div>
                ))}
              </div>
              {types.length > 9 && (
                <div className="text-xs text-muted-foreground text-center">
                  +{types.length - 9} {T("نوع آخر", "more types")}
                </div>
              )}
            </>
          )}

          <div className="flex gap-2 pt-2 border-t">
            <Button asChild size="sm">
              <Link to="/settings/document-types">
                <FolderArchive className="h-3.5 w-3.5 me-1" />{T("إدارة الأنواع والوثائق", "Manage Types & Documents")}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/documents">
                <ExternalLink className="h-3.5 w-3.5 me-1" />{T("عرض كل الوثائق", "View All Documents")}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// STEP 4 — Numbering (summary + link to Foundation)
// ─────────────────────────────────────────────────────────────────────────
function StepNumbering({ T }: { T: (a: string, e: string) => string }) {
  const { data: series = [], isLoading } = useNumberingSeries();

  const preview = useMemo(() => {
    return series.slice(0, 12).map((s) => {
      const y = new Date().getFullYear().toString();
      const seq = String(s.next_seq ?? 1).padStart(s.padding ?? 6, "0");
      const out = (s.format_template || "{prefix}-{year}-{seq}")
        .replaceAll("{prefix}", s.prefix).replaceAll("{year}", y).replaceAll("{seq}", seq);
      return { ...s, out };
    });
  }, [series]);

  return (
    <div className="space-y-4">
      <SectionHeader n={1} T={T} title={T("ترقيم المستندات", "Document Numbering")} />
      <Card>
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            {T("تحكم في بادئات وأرقام كل نوع مستند (فواتير، عروض، أوامر شراء…) — الإعدادات الكاملة والتصفير الزمني موجود في «الأساس».",
               "Control prefixes and sequences for every document type — full settings and reset policies live in \"Foundation\".")}
          </p>

          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />{T("جاري التحميل…", "Loading…")}
            </div>
          ) : series.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed p-8 text-center">
              <Hash className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <div className="text-sm font-medium">{T("لم يتم إعداد ترقيم بعد", "No numbering series yet")}</div>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                {T("أضف أول سلسلة لبدء ترقيم المستندات تلقائياً.", "Add your first series to auto-number documents.")}
              </p>
              <Button asChild size="sm">
                <Link to="/settings/foundation"><Plus className="h-3.5 w-3.5 me-1" />{T("إضافة سلسلة", "Add Series")}</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {preview.map((s) => (
                <div key={s.id} className="rounded-xl border p-3 hover:border-primary/40 transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">{s.doc_type}</Badge>
                    <span className="text-[9px] text-muted-foreground uppercase">{s.reset_policy}</span>
                  </div>
                  <div className="font-mono text-sm truncate">{s.out}</div>
                  {(s.label_ar || s.label_en) && (
                    <div className="text-[10px] text-muted-foreground truncate">
                      {s.label_ar || s.label_en}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t">
            <Button asChild size="sm">
              <Link to="/settings/foundation">
                <Hash className="h-3.5 w-3.5 me-1" />{T("إدارة الترقيم", "Manage Numbering")}
              </Link>
            </Button>
          </div>

          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-xs">
              <div className="font-medium">{T("هل تعرف؟", "Did you know?")}</div>
              <div className="text-muted-foreground">
                {T("كل سلسلة ترقيم تدعم بادئة مخصصة + تصفير سنوي/شهري/يومي، وتوليد الرقم يتم في قاعدة البيانات لضمان عدم التكرار حتى مع الاستخدام المتزامن.",
                   "Every series supports a custom prefix + yearly/monthly/daily reset, and numbers are generated in the database to guarantee uniqueness under concurrent use.")}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Small building blocks
// ─────────────────────────────────────────────────────────────────────────
function SectionHeader({ n, title, T, right }: { n: number; title: string; T: (a: string, e: string) => string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary grid place-items-center text-xs font-bold shrink-0">{n}</div>
        <h3 className="text-base sm:text-lg font-semibold">{title}</h3>
      </div>
      {right}
      <span className="sr-only">{T("قسم", "Section")}</span>
    </div>
  );
}

function SmartField({ label, icon: Icon, hint, children }: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 min-w-0">
      <Label className="text-sm flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span>{label}</span>
      </Label>
      {children}
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
