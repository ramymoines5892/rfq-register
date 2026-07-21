# خطة: First-Run Setup Wizard لإنشاء الشركة

## الفكرة العامة
أول ما حد يفتح البرنامج، لو مفيش أي شركة مسجلة في الداتا بيز، البرنامج بالكامل (Dashboard + Sidebar + كل الموديولز) يتقفل ويتحوّل المستخدم على شاشة ترحيب → Wizard لإنشاء أول شركة. بعد الإنشاء، الـ Wizard مايظهرش تاني إلا لو الجدول رجع فاضي.

هنبني فوق اللي موجود من غير ما نلمس بنية `_authenticated` أو `profiles/user_roles`. الشركة هتكون Entity جديد (`companies`) + جداول مساعدة.

---

## المرحلة 1 — Database (Migration واحدة)

جداول جديدة (كلها RLS + GRANT حسب القواعد):

- **`companies`**: الحقول الأساسية (name, name_ar, short_name, code UNIQUE, tax_no, cr_no, vat_no, email, phone, mobile, website, logo_url) + الحقول المتقدمة (country, city, state, postal_code, address, default_language, timezone, date_format, number_format, base_currency, fiscal_year_start, fiscal_year_end, gm_name, purchasing_manager, sales_manager, finance_manager, notes) + `is_active`, `created_by`.
- **`company_features`**: `company_id` FK + toggle boolean لكل feature (multi_branch, multi_warehouse, multi_currency, approval_workflow, audit_log, inventory, procurement, sales, finance, quality, traceability, heat_number, lot_number, batch_control, attachments, e_signatures).
- **`company_numbering`**: `company_id` FK + `doc_type` (RFQ/PO/QT/SO/INV/GRN) + `prefix`, `year_segment`, `padding`, `next_seq`.
- **`branches`**: `company_id`, name, is_head_office. نعمل Insert تلقائي لـ "Head Office".
- **`warehouses`**: `company_id`, `branch_id`, name, is_main. نعمل Insert تلقائي لـ "Main Warehouse".

Helper function: `public.has_any_company()` returns boolean (SECURITY DEFINER) عشان الـ client يعرف يعمل gate من غير ما يحتاج صلاحيات SELECT قبل تسجيل الدخول.

RLS: القراءة والتعديل للـ `authenticated` بس، والإنشاء الأول للـ owner/admin (أو أي authenticated لو مفيش شركات لسه — عشان أول مستخدم يقدر يعملها).

Storage: هنستعمل bucket جديد `company-logos` (public read) لرفع اللوجو.

---

## المرحلة 2 — Feature layer

`src/features/company/`:
- `api.ts`: `hasAnyCompany()`, `fetchCompany()`, `createCompanyBundle(payload)` — يعمل insert للشركة + features + numbering + Head Office branch + Main Warehouse في transaction واحدة (server function).
- `queries.ts`: `useHasAnyCompany()`, `useCurrentCompany()`, `useCreateCompany()` مع invalidation.

نضيف `qk.company` في `queryKeys.ts`.

---

## المرحلة 3 — Gating

- **Route جديد public**: `src/routes/setup.tsx` — شاشة الترحيب + الـ Wizard.
- **تعديل `src/routes/_authenticated/route.tsx`**: بعد الـ auth check نستعلم عن `has_any_company`؛ لو false نعمل `redirect({ to: "/setup" })`.
- **تعديل `src/routes/auth.tsx`**: بعد login ناجح، لو مفيش شركة يوديه على `/setup`.
- `/setup` نفسها لو فيه شركة بالفعل تعمل redirect على `/`.

---

## المرحلة 4 — الـ Wizard UI

مكوّن واحد `SetupWizard` جوّه `/setup` بيبتدي بشاشة Welcome:
- عنوان "Welcome to EEC ERP" + Description + زرار "Create Company" واحد بس.

بعد الضغط يظهر Wizard بـ 4 tabs (Stepper بصري فوق):

1. **General Information** — الحقول الأساسية + رفع لوجو (Upload لـ storage).
2. **Advanced Information** — 5 secions (Address, Regional, Financial, Contacts, Notes) مع Selects للـ country/timezone/currency/language.
3. **System Features** — grid toggles لكل feature (defaults كلها ON).
4. **Document Numbering** — جدول قابل للتعديل لكل نوع مستند مع preview live (`RFQ-2026-000001`).

Navigation: Back/Next + Progress indicator. Validation بـ zod لكل tab قبل الانتقال. الـ state محفوظ في `useState` (autosave في localStorage اختياري خفيف).

في آخر tab زرار "Create Company" → يستدعي `useCreateCompany` → عند النجاح يعرض شاشة "Congratulations" + زرار "Go to Dashboard" → يوديه على `/` ويعمل invalidate لـ `has_any_company`.

---

## المرحلة 5 — تعديلات على القائمة

الاسم في الـ sidebar بيبقى من `companies.short_name` بدل الـ hardcode "Egyptian Europe" (fallback على "Egyptian Europe" لو مفيش قيمة).

---

## Design
- shadcn Card + Tabs + Input + Select + Switch + Button + Progress.
- Layout Split screen للـ Welcome (يسار brand/gradient، يمين call-to-action).
- Wizard في container max-w-4xl، Stepper أفقي فوق، محتوى الـ tab في Card.
- كامل الدعم لـ RTL/AR-EN من `useI18n`.
- Responsive: الـ tabs تتحول إلى Select على الموبايل.

---

## الملفات اللي هتتعمل/تتعدل

**جديد:**
- Migration واحدة (companies + company_features + company_numbering + branches + warehouses + has_any_company + storage bucket policies)
- `src/features/company/api.ts`
- `src/features/company/queries.ts`
- `src/routes/setup.tsx` (Welcome + Wizard)
- `src/components/setup/SetupWizard.tsx` + مكونات فرعية للـ tabs الأربعة

**تعديل:**
- `src/features/_shared/queryKeys.ts` (إضافة `qk.company`)
- `src/routes/_authenticated/route.tsx` (gate على has_any_company)
- `src/routes/auth.tsx` (redirect بعد login)
- `src/routes/_authenticated/route.tsx` (استخدام short_name في الـ sidebar)

---

## ملاحظات
- مش هنلمس أي شاشة تانية دلوقتي — بس الـ gate والـ wizard.
- الـ Administrator account نفسه بيتعمل من خلال أول signup الموجود بالفعل (أول مستخدم = owner). الشركة بيربطها بـ `created_by = auth.uid()`.
- ممكن في مراحل جاية نربط باقي الموديولز بـ `company_id` — دلوقتي مش هنكسر أي شيء موجود.

هل نبدأ بالـ migration؟