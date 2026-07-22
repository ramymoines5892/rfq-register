import type { PartnerRole, BusinessPartner } from "./api";

export type FieldRule = { field: keyof BusinessPartner; ar: string; en: string };

/** Required fields per role. A partner with multiple roles must satisfy the union. */
export const ROLE_REQUIRED: Record<PartnerRole, FieldRule[]> = {
  customer: [
    { field: "tax_id",    ar: "الرقم الضريبي مطلوب للعملاء (فوترة إلكترونية).", en: "Tax ID required for customers (e-invoicing)." },
    { field: "email",     ar: "بريد إلكتروني مطلوب لإرسال الفواتير.",           en: "Email required to send invoices." },
    { field: "payment_terms", ar: "شروط الدفع مطلوبة.",                          en: "Payment terms required." },
  ],
  supplier: [
    { field: "tax_id",         ar: "الرقم الضريبي مطلوب للموردين.",   en: "Tax ID required for suppliers." },
    { field: "payment_terms",  ar: "شروط الدفع للمورد مطلوبة.",       en: "Supplier payment terms required." },
    { field: "currency",       ar: "العملة مطلوبة.",                    en: "Currency required." },
  ],
  manufacturer: [
    { field: "name_en", ar: "الاسم الإنجليزي مطلوب للمصنّع (شهادات MTC/COO).", en: "English name required for manufacturer (MTC/COO)." },
    { field: "country", ar: "بلد المنشأ مطلوب.",                                  en: "Country of origin required." },
  ],
  freight_forwarder: [
    { field: "email",   ar: "البريد الإلكتروني مطلوب للمخالصات.", en: "Email required for shipping docs." },
    { field: "mobile",  ar: "الموبايل مطلوب للتنسيق.",             en: "Mobile required for coordination." },
  ],
  inspection: [
    { field: "name_en", ar: "الاسم الإنجليزي مطلوب على الشهادات.", en: "English name required on certificates." },
    { field: "email",   ar: "البريد الإلكتروني مطلوب.",             en: "Email required." },
  ],
  shipping: [
    { field: "mobile",  ar: "الموبايل مطلوب.",   en: "Mobile required." },
    { field: "address", ar: "العنوان مطلوب.",    en: "Address required." },
  ],
  bank: [
    { field: "name_en", ar: "اسم البنك بالإنجليزية مطلوب (SWIFT).", en: "Bank English name required (SWIFT)." },
    { field: "country", ar: "الدولة مطلوبة.",                        en: "Country required." },
  ],
  insurance: [
    { field: "tax_id",  ar: "الرقم الضريبي مطلوب لشركة التأمين.", en: "Tax ID required for insurance company." },
    { field: "email",   ar: "البريد الإلكتروني مطلوب.",             en: "Email required." },
  ],
  agent: [
    { field: "commercial_reg", ar: "السجل التجاري مطلوب للوكيل.", en: "Commercial reg. required for agents." },
    { field: "mobile",         ar: "الموبايل مطلوب.",               en: "Mobile required." },
  ],
};

export function requiredFieldsFor(roles: PartnerRole[]): FieldRule[] {
  const seen = new Set<string>();
  const out: FieldRule[] = [];
  for (const r of roles ?? []) {
    for (const rule of ROLE_REQUIRED[r] ?? []) {
      if (!seen.has(String(rule.field))) { seen.add(String(rule.field)); out.push(rule); }
    }
  }
  return out;
}

export function validatePartner(p: Partial<BusinessPartner>, ar: boolean): { field: string; message: string }[] {
  const errors: { field: string; message: string }[] = [];
  if (!(p.name_ar || p.name_en)) errors.push({ field: "name_ar", message: ar ? "الاسم مطلوب (عربي أو إنجليزي)." : "Name required (Arabic or English)." });
  for (const rule of requiredFieldsFor((p.roles ?? []) as PartnerRole[])) {
    const v = (p as any)[rule.field];
    if (v === null || v === undefined || String(v).trim() === "") {
      errors.push({ field: String(rule.field), message: ar ? rule.ar : rule.en });
    }
  }
  if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) {
    errors.push({ field: "email", message: ar ? "بريد إلكتروني غير صالح." : "Invalid email." });
  }
  return errors;
}
