import {
  Crown, Landmark, Building2, Users, Briefcase, DollarSign, ShoppingCart,
  TrendingUp, Package, Truck, Wrench, Cpu, Megaphone, Headphones, Scale,
  Factory, FlaskConical, HardHat, BookOpen, Shield, Stethoscope, ClipboardList,
  BarChart3, FileText, Handshake, Palette, Code2, Globe, Wallet, Receipt,
  UserCog, Building, Store, PenTool, Send, LifeBuoy, Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const DEPT_ICONS: { key: string; icon: LucideIcon; label_ar: string; label_en: string }[] = [
  { key: "crown", icon: Crown, label_ar: "إدارة عليا", label_en: "Executive" },
  { key: "landmark", icon: Landmark, label_ar: "إدارة عامة", label_en: "General" },
  { key: "building2", icon: Building2, label_ar: "إدارة", label_en: "Department" },
  { key: "building", icon: Building, label_ar: "فرع", label_en: "Branch" },
  { key: "users", icon: Users, label_ar: "موارد بشرية", label_en: "HR" },
  { key: "userCog", icon: UserCog, label_ar: "شؤون الموظفين", label_en: "Staff Affairs" },
  { key: "briefcase", icon: Briefcase, label_ar: "أعمال", label_en: "Business" },
  { key: "dollar", icon: DollarSign, label_ar: "مالية", label_en: "Finance" },
  { key: "wallet", icon: Wallet, label_ar: "خزينة", label_en: "Treasury" },
  { key: "receipt", icon: Receipt, label_ar: "محاسبة", label_en: "Accounting" },
  { key: "cart", icon: ShoppingCart, label_ar: "مشتريات", label_en: "Purchasing" },
  { key: "trending", icon: TrendingUp, label_ar: "مبيعات", label_en: "Sales" },
  { key: "store", icon: Store, label_ar: "منافذ بيع", label_en: "Retail" },
  { key: "package", icon: Package, label_ar: "مخازن", label_en: "Warehouse" },
  { key: "truck", icon: Truck, label_ar: "لوجستيات", label_en: "Logistics" },
  { key: "factory", icon: Factory, label_ar: "إنتاج", label_en: "Production" },
  { key: "wrench", icon: Wrench, label_ar: "صيانة", label_en: "Maintenance" },
  { key: "hardhat", icon: HardHat, label_ar: "مشاريع", label_en: "Projects" },
  { key: "cpu", icon: Cpu, label_ar: "تقنية المعلومات", label_en: "IT" },
  { key: "code", icon: Code2, label_ar: "تطوير", label_en: "Development" },
  { key: "megaphone", icon: Megaphone, label_ar: "تسويق", label_en: "Marketing" },
  { key: "palette", icon: Palette, label_ar: "تصميم", label_en: "Design" },
  { key: "pen", icon: PenTool, label_ar: "محتوى", label_en: "Content" },
  { key: "send", icon: Send, label_ar: "علاقات عامة", label_en: "PR" },
  { key: "headphones", icon: Headphones, label_ar: "خدمة عملاء", label_en: "Support" },
  { key: "lifebuoy", icon: LifeBuoy, label_ar: "دعم فني", label_en: "Help Desk" },
  { key: "handshake", icon: Handshake, label_ar: "شراكات", label_en: "Partnerships" },
  { key: "scale", icon: Scale, label_ar: "شؤون قانونية", label_en: "Legal" },
  { key: "file", icon: FileText, label_ar: "وثائق", label_en: "Documents" },
  { key: "clipboard", icon: ClipboardList, label_ar: "تخطيط", label_en: "Planning" },
  { key: "chart", icon: BarChart3, label_ar: "تقارير", label_en: "Reports" },
  { key: "flask", icon: FlaskConical, label_ar: "جودة", label_en: "Quality" },
  { key: "book", icon: BookOpen, label_ar: "تدريب", label_en: "Training" },
  { key: "shield", icon: Shield, label_ar: "أمن", label_en: "Security" },
  { key: "stethoscope", icon: Stethoscope, label_ar: "طبي", label_en: "Medical" },
  { key: "globe", icon: Globe, label_ar: "دولي", label_en: "International" },
  { key: "sparkles", icon: Sparkles, label_ar: "ابتكار", label_en: "Innovation" },
];

const MAP: Record<string, LucideIcon> = Object.fromEntries(DEPT_ICONS.map((i) => [i.key, i.icon]));

export function getDeptIcon(key: string | null | undefined, depth = 0): LucideIcon {
  if (key && MAP[key]) return MAP[key];
  // fallback by depth
  if (depth === 0) return Crown;
  if (depth === 1) return Landmark;
  if (depth === 2) return Building2;
  return Briefcase;
}
