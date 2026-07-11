import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ar" | "en";

type Dict = Record<string, { ar: string; en: string }>;

const dict = {
  appName: { ar: "متابعة عروض الأسعار", en: "Quote Tracker" },
  tagline: { ar: "سجّل عروض الأسعار وتابع صلاحيتها وحالتها", en: "Log price quotes and track status & expiry" },
  signIn: { ar: "تسجيل الدخول", en: "Sign in" },
  signUp: { ar: "إنشاء حساب", en: "Sign up" },
  signOut: { ar: "تسجيل الخروج", en: "Sign out" },
  email: { ar: "البريد الإلكتروني", en: "Email" },
  password: { ar: "كلمة المرور", en: "Password" },
  haveAccount: { ar: "عندك حساب؟ سجّل دخول", en: "Have an account? Sign in" },
  noAccount: { ar: "مفيش حساب؟ أنشئ واحد", en: "No account? Sign up" },
  dashboard: { ar: "العروض", en: "Quotes" },
  addQuote: { ar: "إضافة عرض", en: "Add quote" },
  newQuote: { ar: "عرض جديد", en: "New quote" },
  editQuote: { ar: "تعديل العرض", en: "Edit quote" },
  supplier: { ar: "المورد", en: "Supplier" },
  reference: { ar: "رقم مرجعي", en: "Reference #" },
  description: { ar: "الوصف", en: "Description" },
  amount: { ar: "المبلغ", en: "Amount" },
  currency: { ar: "العملة", en: "Currency" },
  status: { ar: "الحالة", en: "Status" },
  receivedDate: { ar: "تاريخ الاستلام", en: "Received date" },
  expiryDate: { ar: "تاريخ الصلاحية", en: "Expiry date" },
  notes: { ar: "ملاحظات", en: "Notes" },
  attachments: { ar: "المرفقات", en: "Attachments" },
  attach: { ar: "إرفاق ملف", en: "Attach file" },
  save: { ar: "حفظ", en: "Save" },
  cancel: { ar: "إلغاء", en: "Cancel" },
  delete: { ar: "حذف", en: "Delete" },
  edit: { ar: "تعديل", en: "Edit" },
  view: { ar: "عرض", en: "View" },
  confirmDelete: { ar: "متأكد إنك عايز تحذف؟", en: "Are you sure you want to delete?" },
  empty: { ar: "لا توجد عروض بعد. أضف أول عرض.", en: "No quotes yet. Add your first one." },
  all: { ar: "الكل", en: "All" },
  new: { ar: "جديد", en: "New" },
  reviewing: { ar: "قيد المراجعة", en: "Reviewing" },
  accepted: { ar: "مقبول", en: "Accepted" },
  rejected: { ar: "مرفوض", en: "Rejected" },
  expired: { ar: "منتهي", en: "Expired" },
  expiringSoon: { ar: "قرب انتهاؤه", en: "Expiring soon" },
  daysLeft: { ar: "يوم متبقي", en: "days left" },
  daysAgo: { ar: "منذ أيام", en: "days ago" },
  search: { ar: "بحث...", en: "Search..." },
  total: { ar: "الإجمالي", en: "Total" },
  filterStatus: { ar: "تصفية الحالة", en: "Filter status" },
  langToggle: { ar: "EN", en: "عربي" },
  loading: { ar: "جارِ التحميل...", en: "Loading..." },
  errorGeneric: { ar: "حصل خطأ. حاول تاني.", en: "Something went wrong." },
  required: { ar: "مطلوب", en: "Required" },
  download: { ar: "تحميل", en: "Download" },
  files: { ar: "ملفات", en: "files" },
  file: { ar: "ملف", en: "file" },
  noAttachments: { ar: "لا توجد مرفقات", en: "No attachments" },
  quotesCount: { ar: "عدد العروض", en: "Quotes" },
  totalValue: { ar: "القيمة الإجمالية", en: "Total value" },
  expiringWeek: { ar: "تنتهي خلال 7 أيام", en: "Expiring in 7 days" },
} satisfies Dict;

export type TKey = keyof typeof dict;

const I18nCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string; dir: "rtl" | "ltr" }>({
  lang: "ar", setLang: () => {}, t: (k) => k, dir: "rtl",
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    const stored = (typeof window !== "undefined" ? localStorage.getItem("lang") : null) as Lang | null;
    if (stored === "ar" || stored === "en") setLangState(stored);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    }
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("lang", l);
  };

  const t = (k: TKey) => dict[k][lang];
  return <I18nCtx.Provider value={{ lang, setLang, t, dir: lang === "ar" ? "rtl" : "ltr" }}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);
