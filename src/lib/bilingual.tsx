/**
 * Bilingual helpers — resolve AR/EN fields with graceful fallback,
 * and render form inputs / display badges consistently across the app.
 *
 * Convention: DB tables carry `<base>_ar` and `<base>_en` columns for
 * user-facing free-text fields. Legacy single-language columns (e.g.
 * `name`, `address`) are still populated for backward compatibility.
 */

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useI18n, type Lang } from "@/lib/i18n";

export function pickLangValue(
  row: Record<string, unknown> | null | undefined,
  base: string,
  lang: Lang,
): { value: string; isFallback: boolean; empty: boolean } {
  if (!row) return { value: "", isFallback: false, empty: true };
  const other: Lang = lang === "ar" ? "en" : "ar";
  const primary = row[`${base}_${lang}`];
  const fallback = row[`${base}_${other}`];
  const legacy = row[base];
  const asStr = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
  const p = asStr(primary).trim();
  if (p) return { value: asStr(primary), isFallback: false, empty: false };
  const f = asStr(fallback).trim();
  if (f) return { value: asStr(fallback), isFallback: true, empty: false };
  const l = asStr(legacy).trim();
  if (l) return { value: asStr(legacy), isFallback: true, empty: false };
  return { value: "", isFallback: false, empty: true };
}

/** Convenience — used inside client components. */
export function usePickLang() {
  const { lang } = useI18n();
  return (row: Record<string, unknown> | null | undefined, base: string) =>
    pickLangValue(row, base, lang);
}

/** Inline display: value + tiny "AR/EN" badge when we fell back to the other language. */
export function BilingualText({
  row,
  base,
  className,
  empty = "—",
}: {
  row: Record<string, unknown> | null | undefined;
  base: string;
  className?: string;
  empty?: ReactNode;
}) {
  const { lang } = useI18n();
  const { value, isFallback, empty: isEmpty } = pickLangValue(row, base, lang);
  if (isEmpty) return <span className={className}>{empty}</span>;
  const otherLabel = lang === "ar" ? "EN" : "AR";
  return (
    <span className={className} dir={isFallback ? (lang === "ar" ? "ltr" : "rtl") : undefined}>
      {value}
      {isFallback && (
        <span
          className="mx-1 inline-flex items-center rounded border border-dashed border-muted-foreground/40 px-1 text-[9px] font-medium leading-none text-muted-foreground align-middle"
          title={
            lang === "ar"
              ? `القيمة غير مسجّلة بالعربي — يتم عرض النسخة (${otherLabel})`
              : `Not filled in this language — showing the ${otherLabel} value`
          }
        >
          {otherLabel}
        </span>
      )}
    </span>
  );
}

/** Two-input row for AR + EN. Compact, RTL-aware. */
export function BilingualInputs({
  label,
  valueAr,
  valueEn,
  onChangeAr,
  onChangeEn,
  textarea = false,
  required = false,
  maxLength,
  placeholderAr,
  placeholderEn,
  className,
  rows,
}: {
  label?: ReactNode;
  valueAr: string;
  valueEn: string;
  onChangeAr: (v: string) => void;
  onChangeEn: (v: string) => void;
  textarea?: boolean;
  required?: boolean;
  maxLength?: number;
  placeholderAr?: string;
  placeholderEn?: string;
  className?: string;
  rows?: number;
}) {
  const { lang } = useI18n();
  const isMissingCurrent =
    (lang === "ar" ? valueAr : valueEn).trim() === "" &&
    (lang === "ar" ? valueEn : valueAr).trim() !== "";

  const commonProps = {
    maxLength,
  };

  const arField = textarea ? (
    <Textarea
      {...commonProps}
      dir="rtl"
      rows={rows ?? 2}
      value={valueAr}
      onChange={(e) => onChangeAr(e.target.value)}
      placeholder={placeholderAr ?? "بالعربي"}
      className="pe-8"
    />
  ) : (
    <Input
      {...commonProps}
      dir="rtl"
      value={valueAr}
      onChange={(e) => onChangeAr(e.target.value)}
      placeholder={placeholderAr ?? "بالعربي"}
      className="pe-8"
    />
  );

  const enField = textarea ? (
    <Textarea
      {...commonProps}
      dir="ltr"
      rows={rows ?? 2}
      value={valueEn}
      onChange={(e) => onChangeEn(e.target.value)}
      placeholder={placeholderEn ?? "In English"}
      className="pe-8"
    />
  ) : (
    <Input
      {...commonProps}
      dir="ltr"
      value={valueEn}
      onChange={(e) => onChangeEn(e.target.value)}
      placeholder={placeholderEn ?? "In English"}
      className="pe-8"
    />
  );

  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      {label !== undefined && (
        <Label className="flex items-center gap-1.5 text-xs">
          {label}
          {required && <span className="text-destructive">*</span>}
          <span className="ms-auto text-[10px] font-normal text-muted-foreground">
            {lang === "ar" ? "املأ الاتنين للتقارير" : "Fill both for bilingual reports"}
          </span>
        </Label>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="relative">
          <span className="pointer-events-none absolute top-1 end-1 z-10 rounded bg-muted px-1 text-[9px] font-medium leading-tight text-muted-foreground">
            AR
          </span>
          {arField}
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute top-1 end-1 z-10 rounded bg-muted px-1 text-[9px] font-medium leading-tight text-muted-foreground">
            EN
          </span>
          {enField}
        </div>
      </div>
      {isMissingCurrent && (
        <p className="text-[10px] text-amber-600">
          {lang === "ar"
            ? "النسخة العربية فاضية — التقرير العربي هيعرض القيمة الإنجليزية."
            : "English is empty — the English report will show the Arabic value."}
        </p>
      )}
    </div>
  );
}

/** Turn user input into DB payload with legacy column populated from either language. */
export function toBilingualPayload(base: string, ar: string, en: string) {
  const arT = ar.trim();
  const enT = en.trim();
  return {
    [`${base}_ar`]: arT || null,
    [`${base}_en`]: enT || null,
    // Legacy column keeps whichever language exists so old code / reports still work.
    [base]: arT || enT || null,
  } as Record<string, string | null>;
}
