## مقارنة سريعة: الموجود vs الاسكريبت

| العنصر في الاسكريبت | الحالة الحالية في النظام | القرار |
|---|---|---|
| Company | ✅ موجود (companies) كامل مع wizard | نبقيه |
| Branch | ✅ موجود (branches) بس مش مربوط بالموظف | نوسّعه ونربطه |
| **Management** (إدارة عليا) | ❌ **مفقود تماماً** — عندنا Departments بس مع `parent_id` (تدرج ذاتي) | **نضيفه كطبقة مستقلة** |
| Department | ✅ موجود لكن بيلعب دور Management + Department | نفصل الأدوار |
| Position (Job Title) | ✅ موجود (job_titles) | نبقيه ونربطه بـManagement |
| Employee | ⚠️ متداخل مع profiles (User = Employee) | **نفصل Employee عن User** |
| User Account | ✅ auth.users + profiles | نخليه linked لـEmployee |
| Roles | ⚠️ بسيط جداً (user_roles enum: owner/admin/…) بدون Role Definitions | **نبني Roles + Role Permissions** |
| Permissions | ⚠️ user_permissions مباشرة للـuser (ضد الاسكريبت) | ننقلها لطبقة Role |
| Approval hierarchy | ⚠️ manager_id فقط على profile | نوسّعها لـDirect/Dept/Management managers |

**الخلاصة:** الاسكريبت أنضف وأصح معمارياً. الموجود عندنا 50% من الطريق، لكن فيه خلط مفاهيمي كبير (Department = Management، User = Employee، Permissions مباشرة). **أوصي باعتماد الاسكريبت** مع migration path يحافظ على البيانات.

---

## الخطة (على مراحل — بدون كسر النظام الحالي)

### Phase 1 — Schema (Migration واحد)
1. **جدول جديد `managements`** (id, company_id, name_ar, name_en, code, director_id, position, is_system).
2. **`departments`**: نضيف `management_id` (FK). نبقي `parent_id` للتوافق لكن نستخدم `management_id` كمصدر أساسي.
3. **جدول جديد `employees`** منفصل عن profiles:
   - employee_code, full_name_ar/en, national_id, passport, phone, email, joining_date
   - branch_id, management_id, department_id, position_id (job_title)
   - direct_manager_id, employment_status, photo_url, signature_url
   - `user_id` (nullable, FK → auth.users) — يتملى بس لو الموظف عنده حساب دخول
4. **`profiles`**: يبقى مربوط بـauth.users بس، ويشاور على `employee_id` لو موجود.
5. **`roles`** (id, company_id, name_ar/en, description, is_system).
6. **`role_permissions`** (role_id, permission app_permission).
7. **`employee_roles`** (employee_id, role_id) — الـM2M.
8. تحديث `has_permission()` تستفسر عن الـroles من الـemployee بدل الـuser مباشرة.
9. Migration data: تحويل `user_permissions` الحالية لـroles تلقائية.

### Phase 2 — Setup Wizard: توسعة
Wizard الحالي فيه 4 steps (General/Advanced/Features/Numbering). نضيف بعد الحفظ **Setup Post-Wizard** بالخطوات:
- Branches → Managements → Departments → Positions → Employees → Users → Roles → Review

كل خطوة اختيارية بعد إنشاء الشركة، مع indicator كامل.

### Phase 3 — شاشات الإدارة
- `/organization/branches` — CRUD للفروع
- `/organization/managements` — CRUD للإدارات العليا مع OrgChart
- `/organization/departments` — CRUD مع filter بالـManagement
- `/organization/positions` — CRUD (كان job_titles)
- `/organization/employees` — CRUD كامل للموظفين
- `/organization/users` — ربط user account بموظف + assign roles
- `/organization/roles` — CRUD Roles + permission matrix
- تحديث `settings.organization.tsx` (OrgChart) عشان يعرض التدرج الكامل الجديد

### Phase 4 — تحديث الشاشات الموجودة
- Team page: تعرض employees مش profiles
- HR page: تعمل link على employee
- Sidebar: تظهر modules حسب الـfeature flags (موجود) + حسب صلاحيات الـrole (جديد)
- Audit log: يسجل employee_id + user_id

---

## ملاحظات مهمة

- **الميزة الكبيرة:** فصل Employee عن User = يقدر يبقى فيه موظفين مش عندهم دخول للنظام (عمال، فنيين)، وده مطلب حقيقي في ERP.
- **Approval hierarchy** هيبقى مستقل عن Permissions زي ما الاسكريبت طلب.
- **مايتكسرش:** كل الشاشات القديمة (customers, quotes, workflows) هتفضل شغالة. بس الـpermission check هيبقى عبر الـrole الجديد بدل الـuser_permissions.

---

## قرار مطلوب منك

**هل نبدأ بـPhase 1 (Schema)** الأول ونعرضهولك للموافقة؟ ولا عندك تعديل في التسلسل أو حاجة عايز تضيفها/تشيلها قبل ما نبدأ؟

بمجرد ما توافق على Phase 1، هبعتلك migration واحد كامل بالجداول الجديدة والـmigration data من الـuser_permissions القديمة.