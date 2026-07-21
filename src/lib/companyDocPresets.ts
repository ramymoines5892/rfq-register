// Preset company document types used during first-time setup.
// After setup, admins can add/rename more types from /settings/document-types.

export type DocPreset = {
  code: string;
  name_ar: string;
  name_en: string;
  notify_days_before: number;
  notify_repeat: "none" | "daily" | "weekly" | "monthly";
};

export const DOC_PRESETS: DocPreset[] = [
  { code: "CR",          name_ar: "السجل التجاري",         name_en: "Commercial Registration", notify_days_before: 45, notify_repeat: "weekly" },
  { code: "TAX_CARD",    name_ar: "البطاقة الضريبية",      name_en: "Tax Card",                notify_days_before: 45, notify_repeat: "weekly" },
  { code: "VAT_CERT",    name_ar: "شهادة القيمة المضافة",  name_en: "VAT Certificate",         notify_days_before: 45, notify_repeat: "weekly" },
  { code: "INDUSTRIAL",  name_ar: "السجل الصناعي",         name_en: "Industrial Registration", notify_days_before: 60, notify_repeat: "monthly" },
  { code: "IMPORT_CARD", name_ar: "بطاقة الاستيراد",       name_en: "Import License",          notify_days_before: 60, notify_repeat: "weekly" },
  { code: "EXPORT_CARD", name_ar: "بطاقة التصدير",         name_en: "Export License",          notify_days_before: 60, notify_repeat: "weekly" },
  { code: "CHAMBER",     name_ar: "عضوية الغرفة التجارية", name_en: "Chamber Membership",      notify_days_before: 45, notify_repeat: "monthly" },
  { code: "CIVIL_DEF",   name_ar: "شهادة الدفاع المدني",   name_en: "Civil Defense Cert.",     notify_days_before: 30, notify_repeat: "weekly" },
  { code: "SOCIAL_INS",  name_ar: "شهادة التأمينات",       name_en: "Social Insurance Cert.",  notify_days_before: 30, notify_repeat: "weekly" },
  { code: "LEASE",       name_ar: "عقد الإيجار",           name_en: "Lease Contract",          notify_days_before: 60, notify_repeat: "monthly" },
];

export function findPreset(code: string): DocPreset | undefined {
  return DOC_PRESETS.find((p) => p.code === code);
}

export function slugifyCode(input: string): string {
  const s = (input || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return s || `DOC_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}
