/**
 * Feature Registry — single source of truth for every feature flag in the
 * system. Every module that gets built should register itself here.
 *
 * Adding a new module:
 *   1) Add an entry here (key, labels, category, icon).
 *   2) In its route/component, use `useFeature(key)` or `<FeatureGate>`.
 *   3) In the sidebar, use `featureFor(navKey)` to hide the entry when off.
 */
import {
  GitBranch,
  Warehouse,
  DollarSign,
  Workflow,
  ClipboardList,
  Paperclip,
  ShoppingCart,
  Store,
  Package,
  Landmark,
  BadgeCheck,
  Search,
  Flame,
  Layers,
  Boxes,
  PenLine,
  type LucideIcon,
} from "lucide-react";

export type FeatureCategory = "core" | "operations" | "traceability" | "finance" | "compliance";

export type FeatureDef = {
  key: string;
  ar: string;
  en: string;
  desc_ar: string;
  desc_en: string;
  category: FeatureCategory;
  icon: LucideIcon;
  /** Other feature keys required to be ON for this to work. */
  depends_on?: string[];
  /** Whether the underlying module is actually implemented in the app. */
  implemented: boolean;
  /** Default state on new company. */
  default: boolean;
};

export const FEATURE_REGISTRY: FeatureDef[] = [
  // ── Core ────────────────────────────────────────────────────────────────
  {
    key: "multi_branch",
    ar: "تعدد الفروع",
    en: "Multi-Branch",
    desc_ar: "تفعيل أكثر من فرع للشركة وربط البيانات بكل فرع.",
    desc_en: "Enable multiple branches per company and scope data per branch.",
    category: "core",
    icon: GitBranch,
    implemented: true,
    default: false,
  },
  {
    key: "multi_warehouse",
    ar: "تعدد المخازن",
    en: "Multi-Warehouse",
    desc_ar: "إدارة عدة مخازن وربط الحركات المخزنية بكل مخزن.",
    desc_en: "Manage multiple warehouses and scope stock movements per warehouse.",
    category: "core",
    icon: Warehouse,
    implemented: true,
    default: false,
  },
  {
    key: "multi_currency",
    ar: "تعدد العملات",
    en: "Multi-Currency",
    desc_ar: "إضافة عملات متعددة وأسعار صرف لعروض الأسعار والفواتير.",
    desc_en: "Multiple currencies with exchange rates for quotes and invoices.",
    category: "core",
    icon: DollarSign,
    implemented: false,
    default: false,
  },
  {
    key: "approval_workflow",
    ar: "دورات الاعتماد",
    en: "Approval Workflows",
    desc_ar: "بناء دورات اعتماد متعددة المراحل للمستندات.",
    desc_en: "Multi-stage approval flows for documents.",
    category: "core",
    icon: Workflow,
    implemented: true,
    default: true,
  },
  {
    key: "audit_log",
    ar: "سجل التدقيق",
    en: "Audit Log",
    desc_ar: "تسجيل تلقائي لكل تغيير على البيانات الحساسة.",
    desc_en: "Automatic logging of every change on sensitive data.",
    category: "compliance",
    icon: ClipboardList,
    implemented: true,
    default: true,
  },
  {
    key: "attachments",
    ar: "المرفقات",
    en: "Attachments",
    desc_ar: "رفع ملفات ومستندات للسجلات المختلفة.",
    desc_en: "Upload files and documents on records.",
    category: "core",
    icon: Paperclip,
    implemented: true,
    default: true,
  },

  // ── Operations ──────────────────────────────────────────────────────────
  {
    key: "procurement",
    ar: "المشتريات",
    en: "Procurement",
    desc_ar: "طلبات الشراء وأوامر التوريد والموردين.",
    desc_en: "Purchase requisitions, POs, and vendors.",
    category: "operations",
    icon: ShoppingCart,
    implemented: false,
    default: false,
  },
  {
    key: "sales",
    ar: "المبيعات",
    en: "Sales",
    desc_ar: "عروض أسعار، أوامر بيع، وفواتير للعملاء.",
    desc_en: "Quotes, sales orders, and customer invoices.",
    category: "operations",
    icon: Store,
    implemented: false,
    default: false,
  },
  {
    key: "inventory",
    ar: "المخزون",
    en: "Inventory",
    desc_ar: "الأصناف، الأرصدة، الحركات المخزنية.",
    desc_en: "Items, balances, and stock movements.",
    category: "operations",
    icon: Package,
    implemented: false,
    default: false,
  },
  {
    key: "finance",
    ar: "المالية",
    en: "Finance",
    desc_ar: "القيود، الحسابات، والتقارير المالية.",
    desc_en: "Ledger, accounts, and financial reports.",
    category: "finance",
    icon: Landmark,
    implemented: false,
    default: false,
  },

  // ── Traceability & Compliance ───────────────────────────────────────────
  {
    key: "quality",
    ar: "الجودة",
    en: "Quality",
    desc_ar: "شهادات المطابقة وضبط الجودة.",
    desc_en: "Certificates and quality control.",
    category: "compliance",
    icon: BadgeCheck,
    implemented: false,
    default: false,
  },
  {
    key: "traceability",
    ar: "التتبع الكامل",
    en: "Full Traceability",
    desc_ar: "تتبع كامل للأصناف من المورد للعميل.",
    desc_en: "End-to-end traceability from vendor to customer.",
    category: "traceability",
    icon: Search,
    implemented: false,
    default: false,
  },
  {
    key: "heat_number",
    ar: "أرقام الصهر (Heat)",
    en: "Heat Numbers",
    desc_ar: "تتبع Heat Number على الأصناف المعدنية.",
    desc_en: "Track heat numbers on metallic items.",
    category: "traceability",
    icon: Flame,
    depends_on: ["traceability"],
    implemented: false,
    default: false,
  },
  {
    key: "lot_number",
    ar: "أرقام التشغيلة (Lot)",
    en: "Lot Numbers",
    desc_ar: "تتبع Lot لكل استلام أو تصنيع.",
    desc_en: "Track lot numbers per receipt or production run.",
    category: "traceability",
    icon: Layers,
    depends_on: ["traceability"],
    implemented: false,
    default: false,
  },
  {
    key: "batch_control",
    ar: "التحكم بالدُفعات",
    en: "Batch Control",
    desc_ar: "إدارة دفعات الإنتاج/الاستلام.",
    desc_en: "Manage production/receipt batches.",
    category: "traceability",
    icon: Boxes,
    depends_on: ["traceability"],
    implemented: false,
    default: false,
  },
  {
    key: "e_signatures",
    ar: "التوقيع الإلكتروني",
    en: "E-Signatures",
    desc_ar: "توقيعات رقمية معتمدة على المستندات.",
    desc_en: "Digital signatures on documents.",
    category: "compliance",
    icon: PenLine,
    implemented: false,
    default: false,
  },
];

export type FeatureKey = (typeof FEATURE_REGISTRY)[number]["key"];

export const FEATURE_MAP: Record<string, FeatureDef> = Object.fromEntries(
  FEATURE_REGISTRY.map((f) => [f.key, f]),
);

export const CATEGORY_LABELS: Record<FeatureCategory, { ar: string; en: string }> = {
  core: { ar: "أساسي", en: "Core" },
  operations: { ar: "تشغيلي", en: "Operations" },
  traceability: { ar: "التتبع", en: "Traceability" },
  finance: { ar: "المالية", en: "Finance" },
  compliance: { ar: "الامتثال", en: "Compliance" },
};

/** Defaults record used when creating a new company. */
export function defaultFeatures(): Record<string, boolean> {
  return Object.fromEntries(FEATURE_REGISTRY.map((f) => [f.key, f.default]));
}

/** Feature key that gates each nav route. Undefined = always visible. */
export const NAV_FEATURE: Record<string, FeatureKey | undefined> = {
  "/branches": "multi_branch",
  "/warehouses": "multi_warehouse",
  "/workflows": "approval_workflow",
  "/inventory": "inventory",
  "/procurement": "procurement",
  "/sales": "sales",
  "/finance": "finance",
};
