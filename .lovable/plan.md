
# EEC ERP — خارطة الطريق (Roadmap)

الملف الذي رفعته (9825 سطر) هو **مواصفات ERP كاملة بحجم SAP B1/Odoo Enterprise** تشمل 26 موديول رئيسي + قواعد قاعدة بيانات + قواعد أعمال + قواعد أمان. لا يمكن — ولا يجب — تنفيذه في جلسة واحدة. الخطة أدناه تقسّمه على **8 مراحل قابلة للتسليم** بحيث كل مرحلة تُنتج قيمة قابلة للاستخدام قبل الانتقال للتي بعدها.

---

## ما تم بناؤه فعلياً (خط الأساس)

- ✅ **01 Company Setup** — الشركة، الفروع، الترقيم، الميزات (Features Registry)
- ✅ **02 Organization** — Managements, Departments, Positions, Employees, Users, Roles, Permissions (Role-based، بدون تعيين مباشر)
- ✅ **12 Warehouse Management** (جزئي) — Warehouses, Bins, Transfers
- ✅ **13 Inventory Management** (جزئي) — Balances, Movements, Adjustments
- ✅ **20 Workflow Engine** (جزئي) — Templates, Stages, Approvers + `approval_requests`
- ✅ **04 Business Partners** (جزئي) — Customers فقط
- ✅ **09 Quotation** (جزئي) — quotes + attachments + email log
- ✅ **19 Document Management** (جزئي) — Company Documents
- ✅ **03 Administration** (جزئي) — audit_logs, notifications, user_ui_preferences

---

## المراحل المقترحة

### المرحلة 1 — إغلاق الأساس (Foundation Hardening) 🎯 **نبدأ بها**
تغطية الفجوات في ما هو مبني:
- **Fiscal Years** كجدول مستقل بدلاً من حقل نصي واحد.
- **Numbering Series متعددة السنوات** + Reset سنوي + Preview.
- **Approval Matrix**: مصفوفة "من يوافق على ماذا وبأي حد مالي" مربوطة بالـ Workflow Engine الموجود.
- **Password Policies + Login History** (03 Administration).
- **Backup Settings** + سياسة الاحتفاظ بالسجلات.

### المرحلة 2 — Business Partners الكامل (04)
- توحيد Suppliers, Manufacturers, Freight Forwarders, Inspection Companies, Shipping Companies, Banks, Insurance, Agents في **جدول موحّد `business_partners`** مع `partner_type` متعدد (شريك قد يكون Customer + Supplier معاً).
- Contacts / Banks / Addresses / Attachments / Tax IDs / Payment Terms / Credit Limits.
- ترحيل جدول `customers` الحالي إلى النموذج الجديد بدون فقدان بيانات.

### المرحلة 3 — Engineering Master + Product Master (05 + 06)
هذا **قلب المنظومة الصناعية** ولا يمكن بناء المبيعات/المشتريات/المخزون بشكل حقيقي بدونه:
- **Standards** (ASTM/ASME/API/DIN/EN/ISO/MSS/NACE) كجداول مرجعية.
- **Materials, Grades, Schedules, Pressure Classes, Pipe Sizes, Threads, Finishes, Coating, Heat Treatment, Testing Standards, Material Equivalents**.
- **Product Model الديناميكي**: Category → Standard → Material → Grade → Attributes (Flange/Pipe/Valve/Fastener/Gasket…) — كل Category له مخطط سماته الخاص (attribute schema) بدلاً من أعمدة ثابتة.
- ترحيل جدول `products` الحالي.

### المرحلة 4 — Procurement + Logistics (10 + 11)
- **PR → RFQ → PO → GRN → Invoice Matching (3-way)**.
- Suppliers Quotations Comparison.
- Logistics: شحنات، Freight, Insurance, Customs, ETA/ATA tracking.
- ربط كامل بالمخزون (استلام يُنشئ حركة `receipt` في `stock_movements`).

### المرحلة 5 — Sales Cycle الكامل (07 + 08 + 09 + 17)
- **Tender → RFQ (from customer) → Quotation → Sales Order → Delivery Note → Sales Invoice**.
- Quotation الموجود حالياً يصبح جزءاً من دورة كاملة.
- Pricing rules, Discounts, Approval flow (استخدام Workflow Engine).

### المرحلة 6 — Traceability + Certificates + QC (14 + 15 + 16 + 24)
- **Heat No / Lot / Batch / Serial** موجود في الحركات — نضيف **الشجرة الكاملة**: من مورد → GRN → مخزن → Sales Order → عميل، بجانب MTC + COO + Inspection Certs مربوطة بالحركة.
- Quality Control: خطط فحص، نتائج، Non-Conformance Reports.
- **Certificate Center**: مستودع موحّد لكل الشهادات مع رابط لكل حركة/شحنة.

### المرحلة 7 — Finance (18)
- Chart of Accounts, Journal Entries (تلقائية من فواتير البيع/الشراء والمخزون).
- AR / AP, Bank Reconciliation, Multi-currency, Tax (VAT).
- Cost of Goods Sold مربوط بحركات المخزون (Moving Average / FIFO — نسألك).

### المرحلة 8 — الطبقات الذكية والتحليلية (21 + 22 + 23 + 25 + 26)
- Dashboards + Reports Engine + KPIs حسب الدور.
- Product Rules Engine (تحقق متوافقية Material/Standard/Service تلقائياً).
- AI Assistant (استخدام Lovable AI Gateway).
- Vendor Performance Scorecards.
- Communication Center (Email/WhatsApp/SMS).

---

## قواعد ثابتة عبر كل المراحل (من الملف)

1. **لا شيء Hardcoded** — كل قاعدة عمل قابلة للتكوين.
2. كل جدول أعمال: `id UUID`, `company_id`, `branch_id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at` (Soft Delete)، RLS مفعّل مع GRANT صريح.
3. كل عملية حرجة عبر **SECURITY DEFINER RPC** مع فحص `has_permission` داخل الدالة.
4. **Audit log** لكل تعديل حسّاس.
5. كل مستند مرتبط بمصدره ووجهته (Traceability كاملة).
6. UI ثنائي اللغة AR/EN + RTL + `ScriptInput` للحقول اللغوية.
7. Responsive لكل الشاشات.

---

## المُخرجات لكل مرحلة (Definition of Done)

- Migrations كاملة مع RLS + GRANT + Triggers.
- API layer (`src/features/<module>/api.ts` + `queries.ts` بمفاتيح `qk.*`).
- شاشات CRUD كاملة + استيراد/تصدير CSV حيث ينطبق.
- تسجيل الموديول في القائمة الجانبية + Feature Flag.
- توثيق قصير في `AGENTS.md` أو README الموديول.

---

## طلبي منك قبل بدء المرحلة 1

قل لي: **هل نبدأ بالمرحلة 1 (إغلاق الأساس) الآن؟**
أم تفضّل القفز مباشرة إلى **المرحلة 3 (Engineering Master + Product Model الديناميكي)** لأنها الأكثر تأثيراً على باقي النظام (المبيعات/المشتريات/المخزون كلها تعتمد عليها)؟

عند اختيار المرحلة سأطرح عليك أسئلة الأعمال التفصيلية (Standards المعتمدة عندك، سياسة الترقيم السنوي، طريقة تسعير المخزون…إلخ) قبل كتابة أي كود.
