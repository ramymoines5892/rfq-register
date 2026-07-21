// Country-aware validation and auto-formatting for company setup fields.
// Rules cover mobile, landline phone, tax registration, commercial registration
// and VAT numbers. Fields not covered by a country's ruleset fall back to
// generic "must be reasonable" validation.

export type FieldRule = {
  /** Digits-only length range accepted. */
  digits: { min: number; max: number };
  /** Mask template: use "X" for a digit slot, any other char is literal. */
  mask: string;
  /** Human-readable example shown as placeholder. */
  example: string;
  /** Short helper describing the expected input. */
  hintAr: string;
  hintEn: string;
};

export type CountryPreset = {
  code: string;
  labelAr: string;
  labelEn: string;
  dialCode: string;
  currency: string;
  timezone: string;
  language: "ar" | "en";
  mobile?: FieldRule;
  phone?: FieldRule;
  tax?: FieldRule;
  cr?: FieldRule;
  vat?: FieldRule;
};

const EG_MOBILE: FieldRule = {
  digits: { min: 11, max: 11 },
  mask: "XXXX-XXX-XXXX",
  example: "0100-123-4567",
  hintAr: "11 رقم يبدأ بـ 010 / 011 / 012 / 015",
  hintEn: "11 digits, starts with 010 / 011 / 012 / 015",
};
const EG_PHONE: FieldRule = {
  digits: { min: 8, max: 10 },
  mask: "XX-XXXXXXXX",
  example: "02-25776123",
  hintAr: "كود المحافظة + الرقم (8-10 أرقام)",
  hintEn: "Area code + number (8-10 digits)",
};
const EG_TAX: FieldRule = {
  digits: { min: 9, max: 9 },
  mask: "XXX-XXX-XXX",
  example: "123-456-789",
  hintAr: "9 أرقام (مصلحة الضرائب المصرية)",
  hintEn: "9 digits (Egyptian Tax Authority)",
};
const EG_CR: FieldRule = {
  digits: { min: 5, max: 8 },
  mask: "XXXXXXXX",
  example: "123456",
  hintAr: "رقم السجل التجاري (5-8 أرقام)",
  hintEn: "Commercial registration number (5-8 digits)",
};

const SA_MOBILE: FieldRule = {
  digits: { min: 10, max: 10 },
  mask: "XXX-XXX-XXXX",
  example: "050-123-4567",
  hintAr: "10 أرقام تبدأ بـ 05",
  hintEn: "10 digits, starts with 05",
};
const GULF_VAT: FieldRule = {
  digits: { min: 15, max: 15 },
  mask: "XXXXXXXXXXXXXXX",
  example: "300000000000003",
  hintAr: "15 رقم (الرقم الضريبي الخليجي)",
  hintEn: "15 digits (GCC tax number)",
};

const AE_MOBILE: FieldRule = {
  digits: { min: 9, max: 9 },
  mask: "XX-XXX-XXXX",
  example: "50-123-4567",
  hintAr: "9 أرقام تبدأ بـ 5",
  hintEn: "9 digits, starts with 5",
};

const US_PHONE: FieldRule = {
  digits: { min: 10, max: 10 },
  mask: "(XXX) XXX-XXXX",
  example: "(415) 555-0123",
  hintAr: "10 أرقام",
  hintEn: "10 digits",
};

const UK_MOBILE: FieldRule = {
  digits: { min: 10, max: 11 },
  mask: "XXXXX XXXXXX",
  example: "07123 456789",
  hintAr: "يبدأ بـ 07",
  hintEn: "Starts with 07",
};

export const COUNTRIES: CountryPreset[] = [
  {
    code: "EG", labelAr: "مصر", labelEn: "Egypt", dialCode: "+20",
    currency: "EGP", timezone: "Africa/Cairo", language: "ar",
    mobile: EG_MOBILE, phone: EG_PHONE, tax: EG_TAX, cr: EG_CR,
  },
  {
    code: "SA", labelAr: "السعودية", labelEn: "Saudi Arabia", dialCode: "+966",
    currency: "SAR", timezone: "Asia/Riyadh", language: "ar",
    mobile: SA_MOBILE, tax: GULF_VAT, vat: GULF_VAT,
  },
  {
    code: "AE", labelAr: "الإمارات", labelEn: "United Arab Emirates", dialCode: "+971",
    currency: "AED", timezone: "Asia/Dubai", language: "ar",
    mobile: AE_MOBILE, tax: GULF_VAT, vat: GULF_VAT,
  },
  {
    code: "KW", labelAr: "الكويت", labelEn: "Kuwait", dialCode: "+965",
    currency: "KWD", timezone: "Asia/Kuwait", language: "ar",
    mobile: { digits: { min: 8, max: 8 }, mask: "XXXX-XXXX", example: "5000-1234", hintAr: "8 أرقام", hintEn: "8 digits" },
  },
  {
    code: "QA", labelAr: "قطر", labelEn: "Qatar", dialCode: "+974",
    currency: "QAR", timezone: "Asia/Qatar", language: "ar",
    mobile: { digits: { min: 8, max: 8 }, mask: "XXXX-XXXX", example: "3312-3456", hintAr: "8 أرقام", hintEn: "8 digits" },
  },
  {
    code: "US", labelAr: "الولايات المتحدة", labelEn: "United States", dialCode: "+1",
    currency: "USD", timezone: "America/New_York", language: "en",
    mobile: US_PHONE, phone: US_PHONE,
    tax: { digits: { min: 9, max: 9 }, mask: "XX-XXXXXXX", example: "12-3456789", hintAr: "EIN (9 أرقام)", hintEn: "EIN (9 digits)" },
  },
  {
    code: "GB", labelAr: "المملكة المتحدة", labelEn: "United Kingdom", dialCode: "+44",
    currency: "GBP", timezone: "Europe/London", language: "en",
    mobile: UK_MOBILE,
    vat: { digits: { min: 9, max: 9 }, mask: "XXX XXXX XX", example: "123 4567 89", hintAr: "9 أرقام", hintEn: "9 digits" },
  },
  {
    code: "DE", labelAr: "ألمانيا", labelEn: "Germany", dialCode: "+49",
    currency: "EUR", timezone: "Europe/Berlin", language: "en",
    mobile: { digits: { min: 10, max: 11 }, mask: "XXX XXXXXXXX", example: "151 12345678", hintAr: "يبدأ بـ 15/16/17", hintEn: "Starts with 15/16/17" },
  },
  {
    code: "OTHER", labelAr: "دولة أخرى", labelEn: "Other Country", dialCode: "",
    currency: "USD", timezone: "UTC", language: "en",
  },
];

export function getCountry(code: string | null | undefined): CountryPreset {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[COUNTRIES.length - 1];
}

/** Apply mask to a value, returning the formatted string. */
export function applyMask(raw: string, rule: FieldRule): string {
  const digits = raw.replace(/\D/g, "").slice(0, rule.digits.max);
  let out = "";
  let di = 0;
  for (const ch of rule.mask) {
    if (di >= digits.length) break;
    if (ch === "X") { out += digits[di++]; }
    else { out += ch; }
  }
  return out;
}

export type FieldValidation = { ok: boolean; error?: { ar: string; en: string } };

export function validateRule(value: string, rule: FieldRule | undefined, opts?: { required?: boolean }): FieldValidation {
  const v = (value ?? "").trim();
  if (!v) return opts?.required ? { ok: false, error: { ar: "هذا الحقل مطلوب", en: "This field is required" } } : { ok: true };
  if (!rule) return { ok: true };
  const digits = v.replace(/\D/g, "");
  if (digits.length < rule.digits.min || digits.length > rule.digits.max) {
    return {
      ok: false,
      error: {
        ar: `المتوقع ${rule.digits.min === rule.digits.max ? rule.digits.min : `${rule.digits.min}-${rule.digits.max}`} رقم — دخلت ${digits.length}`,
        en: `Expected ${rule.digits.min === rule.digits.max ? rule.digits.min : `${rule.digits.min}-${rule.digits.max}`} digits — got ${digits.length}`,
      },
    };
  }
  return { ok: true };
}

export function validateEmail(value: string, opts?: { required?: boolean }): FieldValidation {
  const v = (value ?? "").trim();
  if (!v) return opts?.required ? { ok: false, error: { ar: "البريد الإلكتروني مطلوب", en: "Email is required" } } : { ok: true };
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!re.test(v)) return { ok: false, error: { ar: "صيغة البريد غير صحيحة، مثال: name@company.com", en: "Invalid email, e.g. name@company.com" } };
  return { ok: true };
}

export function validateWebsite(value: string): FieldValidation {
  const v = (value ?? "").trim();
  if (!v) return { ok: true };
  try {
    const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    const u = new URL(withProto);
    if (!u.hostname.includes(".")) throw new Error("no tld");
    return { ok: true };
  } catch {
    return { ok: false, error: { ar: "الرابط غير صحيح، مثال: https://company.com", en: "Invalid URL, e.g. https://company.com" } };
  }
}

/** Auto-generate a company code from name + short random suffix. */
export function generateCompanyCode(name: string): string {
  const clean = (name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const base = clean.length >= 2
    ? clean.slice(0, 3).map((w) => w[0]).join("")
    : (clean[0] ?? "CO").slice(0, 3);
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${base || "CO"}-${suffix}`;
}
