# Module 02 — Identity & Employee Framework

هذا مواصفات كبيرة (Person / Employee / Assignment / User / Position / Grade / Delegation / Promotion / Transfer / History / Calendar…). لأنه لا يمكن بناؤه في دفعة واحدة بشكل سليم، سأقسمه إلى مراحل صغيرة قابلة للاختبار. نبدأ بالمرحلة الأولى فقط، ونتفق على التالي بعدها.

## المبدأ الأساسي (نطبقه في كل المراحل)
- **Person ≠ Employee ≠ User ≠ Role ≠ Permission ≠ Authority**
- الـ Identity ثابتة، الـ Employment تاريخية، الـ User اختياري.
- Workflow يشير إلى Assignment/Position، لا لأسماء موظفين.

---

## المرحلة 1 — Persons + Employee refactor (نبدأ بها الآن)

### DB
- إنشاء جدول `persons` (National ID / Passport / Names AR/EN / Birth / Gender / Nationality / Personal Email / Personal Phone / Photo).
- إضافة `person_id` على `employees` + backfill من الحقول الحالية.
- إضافة على `employees`:
  - `employee_number` (unique per company)
  - `employment_type` (enum: full_time, part_time, contract, temporary, intern, consultant, freelancer)
  - `termination_date`, `cost_center` (text placeholder للـ Finance)
  - توسيع `employment_status` enum: planned, active, probation, on_leave, suspended, retired, resigned, terminated, archived.
- Trigger: منع login لموظف غير Active (لاحقاً في User).
- RLS + GRANTs + audit fields.

### UI
- `/organization` → تبويب **Employees**:
  - قسمين: **Person Info** (identity) / **Employment Info** (job).
  - عرض Employee Number + Status + Type + Hire/Termination.
  - Filter بالـ status و type.
- استخدام `ScriptInput` للأسماء العربي/الإنجليزي.

### Out of scope in Phase 1 (نأجلها)
- Positions & Grades كجداول مستقلة
- Assignments متعددة primary/secondary (الجدول موجود، UI لاحقاً)
- Delegation / Promotion / Transfer / History timeline
- Work Calendar / Shifts / Leave status
- Skills / Documents attachments
- User Account lifecycle (Pending/Locked/Expired…)
- Approval authority (module منفصل)

---

## المراحل التالية (للموافقة لاحقاً)

- **Phase 2**: Job Positions + Grades كجداول (بدل حقل نصي) + ربطها بالـ Assignment.
- **Phase 3**: Assignments UI (Primary/Secondary, Manager Types, Reporting Matrix).
- **Phase 4**: Employee History + Transfer/Promotion/Delegation flows.
- **Phase 5**: User Account lifecycle (Pending, Locked, Expired, MFA hooks).
- **Phase 6**: Work Calendar + Shifts + Leave Status.
- **Phase 7**: Skills + Documents + Search + Reports.
- **Phase 8**: Audit expansion + Security على الحقول الحساسة.

---

## ماذا أحتاج منك قبل ما أبدأ Phase 1
1. موافقة على البدء بـ Phase 1 كما هو موصّف أعلاه؟
2. Employee Number: توليد تلقائي (باستخدام `next_document_number` لكل شركة) أم إدخال يدوي؟
3. الحقول الحالية على `employees` (full_name/full_name_ar/full_name_en/national_id/passport_no/phone/email) — أنقلها للـ `persons` وأخليها views/computed على `employees`، أم أسيبها duplicated لفترة انتقالية؟

قل لي "ابدأ Phase 1" + إجابات النقطتين 2 و3، وأبدأ فوراً.
