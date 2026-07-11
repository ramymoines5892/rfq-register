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
  workflows: { ar: "قوالب الموافقات", en: "Workflows" },
  workflow: { ar: "قالب الموافقة", en: "Workflow" },
  noWorkflow: { ar: "بدون قالب", en: "No workflow" },
  newWorkflow: { ar: "قالب جديد", en: "New workflow" },
  workflowName: { ar: "اسم القالب", en: "Workflow name" },
  stages: { ar: "المراحل", en: "Stages" },
  addStage: { ar: "إضافة مرحلة", en: "Add stage" },
  stageName: { ar: "اسم المرحلة", en: "Stage name" },
  approvers: { ar: "المسؤولون", en: "Approvers" },
  addApprover: { ar: "إضافة مسؤول", en: "Add approver" },
  selectApprover: { ar: "اختر مسؤولاً", en: "Select approver" },
  moveUp: { ar: "لأعلى", en: "Move up" },
  moveDown: { ar: "لأسفل", en: "Move down" },
  approvalState: { ar: "حالة الموافقة", en: "Approval" },
  inProgress: { ar: "قيد الموافقة", en: "In progress" },
  approvalApproved: { ar: "معتمد", en: "Approved" },
  approvalRejected: { ar: "مرفوض", en: "Rejected" },
  currentStage: { ar: "المرحلة الحالية", en: "Current stage" },
  sendToApprovers: { ar: "إرسال للمسؤولين", en: "Send to approvers" },
  approve: { ar: "موافقة", en: "Approve" },
  reject: { ar: "رفض", en: "Reject" },
  decisionComment: { ar: "ملاحظات (اختياري)", en: "Comment (optional)" },
  submit: { ar: "تأكيد", en: "Submit" },
  tabMyQuotes: { ar: "عروضي", en: "My Quotes" },
  tabPendingMe: { ar: "بانتظار موافقتي", en: "Pending my approval" },
  noPending: { ar: "لا يوجد عروض بانتظار موافقتك", en: "Nothing pending your approval" },
  workflowStarted: { ar: "بدأ workflow الموافقات", en: "Approval workflow started" },
  emailSent: { ar: "تم إرسال الإيميل", en: "Email sent" },
  emailNotConfigured: { ar: "يجب تفعيل نطاق الإيميل أولاً", en: "Please configure the email domain first" },
  decisionSaved: { ar: "تم حفظ القرار", en: "Decision saved" },
  noApprovers: { ar: "لا يوجد مسؤولون للمرحلة الحالية", en: "No approvers for the current stage" },
  addStagesFirst: { ar: "أضف مرحلة أولاً", en: "Add a stage first" },
  saved: { ar: "تم الحفظ", en: "Saved" },
  backToQuotes: { ar: "رجوع للعروض", en: "Back to quotes" },
  customers: { ar: "العملاء", en: "Customers" },
  addCustomer: { ar: "إضافة عميل", en: "Add customer" },
  newCustomer: { ar: "عميل جديد", en: "New customer" },
  editCustomer: { ar: "تعديل العميل", en: "Edit customer" },
  customerName: { ar: "اسم العميل", en: "Customer name" },
  taxId: { ar: "الرقم الضريبي", en: "Tax ID" },
  taxIdOptional: { ar: "الرقم الضريبي (اختياري)", en: "Tax ID (optional)" },
  defaultCurrency: { ar: "العملة الافتراضية", en: "Default currency" },
  terms: { ar: "الشروط الخاصة", en: "Special terms" },
  termsPlaceholder: { ar: "شروط الدفع، التوريد، الضمان...", en: "Payment, delivery, warranty terms..." },
  customer: { ar: "العميل", en: "Customer" },
  selectCustomer: { ar: "اختر عميل", en: "Select customer" },
  noCustomer: { ar: "بدون عميل", en: "No customer" },
  taxIdInUse: { ar: "هذا الرقم الضريبي مسجّل مسبقاً باسم", en: "This tax ID is already registered under" },
  overrideTerms: { ar: "تعديل الشروط لهذا العرض", en: "Override terms for this quote" },
  effectiveTerms: { ar: "الشروط السارية", en: "Effective terms" },
  noCustomersYet: { ar: "لا يوجد عملاء بعد. أضف أول عميل.", en: "No customers yet. Add one." },
  customerSaved: { ar: "تم حفظ العميل", en: "Customer saved" },
  overview: { ar: "نظرة عامة", en: "Overview" },
  phone: { ar: "التليفون", en: "Phone" },
  website: { ar: "الموقع الإلكتروني", en: "Website" },
  address: { ar: "العنوان", en: "Address" },
  city: { ar: "المدينة", en: "City" },
  country: { ar: "الدولة", en: "Country" },
  industry: { ar: "النشاط", en: "Industry" },
  paymentTerms: { ar: "شروط الدفع", en: "Payment terms" },
  mainInfo: { ar: "البيانات الأساسية", en: "Main info" },
  contacts: { ar: "الأشخاص المسؤولون", en: "Contact persons" },
  banks: { ar: "الحسابات البنكية", en: "Bank accounts" },
  addContact: { ar: "إضافة مسؤول", en: "Add contact" },
  addBank: { ar: "إضافة بنك", en: "Add bank" },
  contactName: { ar: "الاسم", en: "Name" },
  jobTitle: { ar: "المسمى الوظيفي", en: "Job title" },
  primary: { ar: "أساسي", en: "Primary" },
  bankName: { ar: "اسم البنك", en: "Bank name" },
  accountName: { ar: "اسم الحساب", en: "Account name" },
  accountNumber: { ar: "رقم الحساب", en: "Account number" },
  iban: { ar: "IBAN", en: "IBAN" },
  swift: { ar: "SWIFT", en: "SWIFT" },
  branch: { ar: "الفرع", en: "Branch" },
  noContacts: { ar: "لا يوجد أشخاص مسؤولون", en: "No contacts yet" },
  noBanks: { ar: "لا يوجد حسابات بنكية", en: "No bank accounts yet" },
  saveFirst: { ar: "احفظ بيانات العميل أولاً لإضافة المزيد", en: "Save the customer first to add more details" },
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
