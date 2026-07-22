## نظرة عامة

خمس تحسينات مترابطة على وحدة المخزون والصلاحيات: صلاحيات دقيقة، سجل حركات، ضبط يدوى، تقييد إدخال، نظام موافقات (Approvals).

---

## 1) صلاحيات دقيقة + RLS للمخازن والنقل

**Permissions جديدة (تُضاف إلى `app_permission`):**
- `warehouses.view` / `warehouses.manage`
- `bins.manage`
- `inventory.view`
- `inventory.transfer.create` / `inventory.transfer.post` / `inventory.transfer.cancel`
- `inventory.adjust.create` / `inventory.adjust.approve`

**RLS محدَّثة:**
- `warehouses`: SELECT عبر `can_access_branch` + `has_permission(uid, 'warehouses.view')`؛ INSERT/UPDATE/DELETE عبر `warehouses.manage`.
- `warehouse_bins`: نفس المبدأ عبر `bins.manage`.
- `stock_transfers` + `stock_transfer_lines`: SELECT مقيّد بالفروع المسموحة؛ INSERT/UPDATE بصلاحيات النقل.
- `stock_movements`: SELECT عبر `inventory.view`؛ لا كتابة مباشرة (تُنشأ من RPC).

**UI:**
- إخفاء أزرار «جديد/تعديل/حذف/ترحيل/إلغاء» عند غياب الصلاحية.
- عرض `toast` عربى/إنجليزى واضح عند رفض RLS بدلاً من رسالة Postgres الخام (رسالة موحّدة في `api.ts`).

---

## 2) سجل حركات المخزون داخل صفحة `/inventory`

**تبويبان في نفس الصفحة:** *الأرصدة الحالية* / *سجل الحركات*.

**فلاتر السجل:**
- بحث حرّ (كود/اسم المنتج، Heat/Lot/Batch/Serial، رقم المرجع).
- Select: المنتج، المخزن، النوع (in/out/transfer/adjustment).
- فترة تاريخ (من/إلى).
- ترتيب حسب آخر حركة.

**عمود واحد لكل صف** يوضّح: التاريخ · النوع (Badge ملوَّن) · المنتج · المخزن · الكمية (±) · التتبع · مرجع المصدر (يفتح تفاصيل التحويل/الضبط).

**تصدير CSV** لنفس النتائج المفلترة.

---

## 3) ضبط مخزون يدوى (Stock Adjustment)

**جدول جديد `stock_adjustments`** (رأس) + `stock_adjustment_lines`:
- سبب الضبط `enum('count', 'damage', 'loss', 'found', 'correction', 'other')` + ملاحظات نصية إلزامية.
- ربط بالفرع والمخزن، وحقول التتبع الكاملة على كل سطر (Heat/Lot/Batch/Serial/MTC/COO).
- الحالة: `draft → pending_approval → approved → posted | rejected | cancelled`.

**RPC `post_stock_adjustment`** يُنشئ حركات في `stock_movements` بنوع `adjustment` (+/-) مربوطة بالتتبع.

**صفحة `/adjustments`** بنفس نمط صفحة النقل (List + Sheet تفاصيل + Add Line + Post).

**تفاصيل الحركة**: نافذة موحّدة تعرض المصدر (تحويل أو ضبط) مع كل حقول التتبع.

---

## 4) تقييد إدخال العربى/الإنجليزى فى كل البرنامج

**قاعدة موحّدة عبر `ScriptInput`** (موجود بالفعل):
- كل حقل عربى: يرفض الحروف اللاتينية فورًا + Tooltip دائم «أدخل نصًا عربيًا فقط».
- كل حقل إنجليزى: يرفض الحروف العربية + Tooltip «Enter English only».
- Tooltip يظهر عند التركيز، ورسالة خطأ حمراء عند اللصق غير الصحيح.

**تدقيق شامل:** استبدال كل `<Input>` نصى لاسم عربى/إنجليزى بـ `ScriptInput` عبر الشاشات: Warehouses, Bins, Products, Transfers, Adjustments, Departments, Job Titles, Employees, Company, Branches, Customers, RecordEditor.

**Zod validation** موحَّدة قبل الحفظ فى كل النماذج (طول أدنى/أقصى، نوع النص، تفرّد الأكواد).

---

## 5) نظام موافقات (Approvals) عام قابل للتوسّع

**جدول `approval_requests`:**
```
id, company_id, entity_type (transfer|adjustment|...), entity_id,
action (post|cancel|delete|update),
requested_by, requested_at, payload_snapshot jsonb,
status (pending|approved|rejected|cancelled),
approver_id, decided_at, decision_note,
required_role (app_role) — أى دور يستطيع الموافقة
```

**قواعد الاشتراط (Threshold rules):**
- إعداد فى `company_features`: هل الترحيل يحتاج موافقة؟ من (admin/owner/warehouse_manager)؟
- عند الترحيل: لو الدور لا يملك `.post` مباشرة → يُنشأ `approval_request` بحالة `pending`.
- عند الموافقة: تُنفَّذ الحركة الأصلية عبر RPC (`approve_and_execute`).

**UI:**
- علبة موافقات فى الشريط الجانبى «الموافقات» + Badge بعدد المعلَّقة.
- صفحة `/approvals`: قائمة معلّقة/محلولة، تفاصيل الكيان الأصلى مع الفروق، زرّا موافقة/رفض مع سبب.
- تنبيه (`notifications`) لكل مُوافق مؤهَّل عند إنشاء الطلب.

---

## التنفيذ التقنى

**Migrations (SQL):**
1. توسعة `app_permission` بالقيم الجديدة + تعيينها للأدوار الافتراضية.
2. تحديث سياسات RLS للجداول أعلاه.
3. جداول `stock_adjustments`, `stock_adjustment_lines`, `approval_requests` + GRANT + RLS.
4. RPCs: `post_stock_adjustment`, `approve_and_execute`, `request_approval`.
5. تعديل `post_stock_transfer` ليمرّ عبر نظام الموافقات عند الحاجة.

**Frontend:**
- `src/features/adjustments/` (api + queries + UI).
- `src/features/approvals/` (api + queries + UI + hook `useRequireApproval`).
- تحديث `src/features/transfers/api.ts` لعرض رسائل RLS واضحة.
- توسعة `/inventory` بتبويب الحركات + CSV.
- شامل استبدال `Input` بـ `ScriptInput` فى الشاشات المذكورة.
- سلسلة hooks: `useCanCreateTransfer()`, `useCanPostTransfer()`, ...إلخ.

**Sidebar:**
- إضافة «ضبط المخزون» و«الموافقات» تحت مجموعة المخزون/الإدارة، مع Badge للمعلّقات.

---

## تنبيه أمنى

- كل عمليات الترحيل/الموافقة تمرّ عبر `SECURITY DEFINER` RPCs مع تحقّق `has_permission` داخل الدالّة، وليس اعتمادًا على واجهة المستخدم فقط.
- سجل تدقيق (`audit_logs`) لكل موافقة/رفض/ترحيل.