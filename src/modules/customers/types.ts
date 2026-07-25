/**
 * Customer domain types + shared constants.
 *
 * Extracted from `routes/_authenticated/customers.tsx` (Phase 3) so the
 * route file only owns rendering/composition, not the domain shape.
 */

export type Customer = {
  id: string;
  user_id: string;
  name: string;
  name_ar: string | null;
  name_en: string | null;
  tax_id: string | null;
  currency: string;
  terms: string | null;
  notes: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  address_ar: string | null;
  address_en: string | null;
  city: string | null;
  country: string | null;
  industry: string | null;
  industry_ar: string | null;
  industry_en: string | null;
  payment_terms: string | null;
  payment_terms_ar: string | null;
  payment_terms_en: string | null;
  created_at: string;
};

export type Contact = {
  id: string;
  customer_id: string;
  name: string;
  name_ar: string | null;
  name_en: string | null;
  title: string | null;
  title_ar: string | null;
  title_en: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  notes: string | null;
};

export type Bank = {
  id: string;
  customer_id: string;
  bank_name: string;
  bank_name_ar: string | null;
  bank_name_en: string | null;
  account_name: string | null;
  account_name_ar: string | null;
  account_name_en: string | null;
  account_number: string | null;
  iban: string | null;
  swift: string | null;
  currency: string;
  branch: string | null;
  branch_ar: string | null;
  branch_en: string | null;
  is_primary: boolean;
  notes: string | null;
};

export type DraftContact = Omit<Contact, "id" | "customer_id"> & { _key: string };
export type DraftBank = Omit<Bank, "id" | "customer_id"> & { _key: string };

export type AttachmentCategory =
  | "company_profile"
  | "commercial_register"
  | "tax_card"
  | "bank_letter"
  | "other";

export type Attachment = {
  id: string;
  customer_id: string;
  category: AttachmentCategory;
  label: string | null;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export type DraftAttachment = {
  _key: string;
  file: File;
  category: AttachmentCategory;
  label: string | null;
};

export const ATTACHMENT_CATEGORIES: AttachmentCategory[] = [
  "company_profile",
  "commercial_register",
  "tax_card",
  "bank_letter",
  "other",
];

export const CURRENCIES = ["EGP", "USD", "EUR", "SAR", "AED", "GBP"];

export function attachmentCategoryLabel(cat: AttachmentCategory, lang: "ar" | "en") {
  const ar: Record<AttachmentCategory, string> = {
    company_profile: "بروفيل الشركة",
    commercial_register: "السجل التجاري",
    tax_card: "البطاقة الضريبية",
    bank_letter: "خطاب البنوك",
    other: "أخرى",
  };
  const en: Record<AttachmentCategory, string> = {
    company_profile: "Company profile",
    commercial_register: "Commercial register",
    tax_card: "Tax card",
    bank_letter: "Bank letter",
    other: "Other",
  };
  return lang === "ar" ? ar[cat] : en[cat];
}

export function formatBytes(n: number | null | undefined) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
