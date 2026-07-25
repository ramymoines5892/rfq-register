/**
 * Static map: permission → user-facing pages/actions unlocked by that permission.
 * Used by the "before/after diff" UI so admins can see exactly what a toggle affects.
 * Keep in sync with route guards and PermissionGate usages.
 */

export type ImpactEntry = { ar: string; en: string; path?: string };

export const PERMISSION_IMPACT: Record<string, ImpactEntry[]> = {
  "customers.view":          [{ ar: "عرض قائمة العملاء", en: "View customer list", path: "/customers" }],
  "customers.create":        [{ ar: "إنشاء عميل جديد", en: "Create new customer" }],
  "customers.edit":          [{ ar: "تعديل بيانات العملاء", en: "Edit customer data" }],
  "customers.delete":        [{ ar: "حذف العملاء", en: "Delete customers" }],
  "customers.manage":        [{ ar: "إدارة كاملة للعملاء", en: "Full customer management", path: "/customers" }],
  "customers.view_payment_info": [{ ar: "عرض بيانات الدفع الحساسة", en: "View sensitive payment info" }],

  "quotes.view":       [{ ar: "عرض العروض", en: "View quotes", path: "/workflows" }],
  "quotes.view_own":   [{ ar: "عرض عروضي فقط", en: "View own quotes only" }],
  "quotes.view_team":  [{ ar: "عرض عروض الفريق", en: "View team quotes" }],
  "quotes.view_all":   [{ ar: "عرض كل العروض", en: "View all quotes" }],
  "quotes.create":     [{ ar: "إنشاء عرض سعر", en: "Create quote" }],
  "quotes.edit":       [{ ar: "تعديل عرض سعر", en: "Edit quote" }],
  "quotes.delete":     [{ ar: "حذف عرض", en: "Delete quote" }],
  "quotes.assign":     [{ ar: "إسناد عرض لمستخدم", en: "Assign quote" }],
  "quotes.manage":     [{ ar: "إدارة كاملة للعروض", en: "Full quote management" }],
  "quotes.approve":    [{ ar: "اعتماد العروض", en: "Approve quotes" }],

  "workflows.view":    [{ ar: "عرض تدفقات العمل", en: "View workflows", path: "/workflows" }],
  "workflows.manage":  [{ ar: "إدارة قوالب التدفقات", en: "Manage workflow templates", path: "/workflows" }],

  "hr.view":           [{ ar: "عرض الموارد البشرية", en: "View HR", path: "/hr" }],
  "hr.manage":         [{ ar: "إدارة الموارد البشرية والمستخدمين", en: "Manage HR & users", path: "/hr" }],

  "warehouses.view":   [{ ar: "عرض المخازن", en: "View warehouses", path: "/warehouses" }],
  "warehouses.manage": [{ ar: "إدارة المخازن", en: "Manage warehouses", path: "/warehouses" }],
  "bins.manage":       [{ ar: "إدارة مواقع التخزين (Bins)", en: "Manage storage bins" }],

  "inventory.view":              [{ ar: "عرض المخزون", en: "View inventory", path: "/inventory" }],
  "inventory.manage":            [{ ar: "إدارة المخزون", en: "Manage inventory", path: "/inventory" }],
  "inventory.transfer":          [{ ar: "تحويل المخزون بين المخازن", en: "Transfer stock", path: "/transfers" }],
  "inventory.transfer.create":   [{ ar: "إنشاء أمر تحويل", en: "Create transfer order" }],
  "inventory.transfer.post":     [{ ar: "ترحيل تحويل المخزون", en: "Post stock transfer" }],
  "inventory.transfer.cancel":   [{ ar: "إلغاء تحويل مخزون", en: "Cancel stock transfer" }],
  "inventory.adjust.create":     [{ ar: "إنشاء تسوية مخزون", en: "Create stock adjustment", path: "/adjustments" }],
  "inventory.adjust.approve":    [{ ar: "اعتماد تسوية مخزون", en: "Approve stock adjustment" }],

  "approvals.view":    [{ ar: "عرض طلبات الاعتماد", en: "View approval requests", path: "/approvals" }],
  "approvals.decide":  [{ ar: "الموافقة/الرفض على طلبات الاعتماد", en: "Approve/reject requests", path: "/approvals" }],

  "team.view":         [{ ar: "عرض الفريق", en: "View team" }],
  "team.manage":       [{ ar: "إدارة الفريق", en: "Manage team" }],

  "users.manage_roles":       [{ ar: "إدارة أدوار المستخدمين", en: "Manage user roles", path: "/hr" }],
  "templates.manage":          [{ ar: "إدارة القوالب", en: "Manage templates" }],
  "notifications.view":        [{ ar: "عرض الإشعارات", en: "View notifications" }],
  "reports.view":              [{ ar: "عرض التقارير", en: "View reports" }],
  "manage_customer_fields":    [{ ar: "إدارة حقول العملاء", en: "Manage customer fields", path: "/settings/form-builder" }],
  "manage_form_fields":        [{ ar: "إدارة حقول النماذج", en: "Manage form fields", path: "/settings/form-builder" }],
};

export function getImpact(perm: string): ImpactEntry[] {
  return PERMISSION_IMPACT[perm] ?? [];
}
