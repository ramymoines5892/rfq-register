
# نظام الصلاحيات الهرمي (Cascading Permissions)

## الفكرة الأساسية (بأبسط شكل)

كل موظف مربوط بـ **إدارة** و **وظيفة**. الصلاحيات بتتجمع من 3 مصادر:

```
صلاحيات الإدارة  ─┐
صلاحيات الوظيفة  ─┼─► اتحاد (Union) ─► صلاحيات المستخدم النهائية
صلاحيات المستخدم ─┘   (مفيش تعارض، أي مصدر يمنح = ممنوح)
```

**مثال:** إدارة الحسابات فيها `finance.view + finance.manage`. وظيفة "محاسب" فيها `reports.view`. المستخدم "أحمد" مضاف له شخصياً `quotes.approve`.
النتيجة: أحمد عنده الأربعة كلهم تلقائياً.

## المميزات

- **بدون Roles منفصلة** — الإدارة والوظيفة نفسهم بيلعبوا دور الـ Role.
- **توارث تلقائي** — أي موظف جديد في الإدارة بياخد صلاحياتها فوراً.
- **مرونة استثنائية** — ممكن تضيف صلاحية لمستخدم واحد بس بدون ما تأثر على غيره.
- **شفافية** — في شاشة المستخدم بنعرض "الصلاحية دي جاية من: الإدارة / الوظيفة / إضافة شخصية".

## قاعدة البيانات

### 1) جداول جديدة
- `department_permissions (department_id, permission)` — الصلاحيات على مستوى الإدارة.
- `job_title_permissions (job_title_id, permission)` — الصلاحيات على مستوى الوظيفة.
- `user_permissions` موجود بالفعل ✓ — بيتستخدم للإضافات الشخصية.

### 2) تحديث `has_permission()` (Security Definer)
تفحص بالترتيب: user_permissions → job_title_permissions (عبر employees) → department_permissions (عبر employees). لو أي مصدر رجّع صف = TRUE.

### 3) حذف نظام الأدوار القديم
- إلغاء جداول `roles` و `role_permissions` و `employee_roles`.
- الاحتفاظ بـ `user_roles` (owner/admin/member) لأنها لسه مستخدمة كـ system-level guard.

## واجهة الاستخدام

### /organization
تبويبات موجودة + نضيف **زرار "الصلاحيات"** على كل صف في:

**تبويب الإدارات:** أيقونة قفل بجانب كل إدارة → dialog بيعرض قائمة الصلاحيات مقسمة بالوحدات (Sales, HR, Inventory...) ومربعات اختيار.

**تبويب الوظائف:** نفس الـ dialog على مستوى الوظيفة.

**تبويب الموظفين/المستخدمين:** dialog بيعرض 3 أقسام:
- الصلاحيات الموروثة من الإدارة (للقراءة فقط، badge أخضر)
- الصلاحيات الموروثة من الوظيفة (للقراءة فقط، badge أزرق)
- **الصلاحيات الإضافية للمستخدم** (checkboxes قابلة للتعديل)

## الملفات المتأثرة

**Backend (Migration واحد):**
- `department_permissions`, `job_title_permissions` + RLS + GRANT.
- تحديث `has_permission()` للاستعلام من الثلاث مصادر.
- حذف `roles`, `role_permissions`, `employee_roles`.

**Frontend:**
- `src/modules/permissions/api.ts` (جديد) — CRUD للثلاث مستويات + fetch للـ effective permissions لمستخدم.
- `src/modules/permissions/queries.ts` (جديد).
- `src/components/permissions/PermissionMatrix.tsx` (جديد) — الـ dialog الموحّد لاختيار الصلاحيات.
- `src/routes/_authenticated/organization.tsx` — إضافة أزرار "الصلاحيات" في التبويبات.
- `src/routes/_authenticated/hr.tsx` — استبدال شاشة الصلاحيات الحالية بالـ Matrix الجديد اللي بيوضح المصدر.
- حذف `src/routes/_authenticated/settings.foundation.tsx` أو الأجزاء الخاصة بـ Roles منها.

## ملاحظات تقنية

- `has_permission()` هتفضل SECURITY DEFINER عشان تتجنب RLS recursion.
- الصلاحية على مستوى الإدارة **مش بتتوارث للأقسام الفرعية** (اخترت الخيار الأبسط). لو الإدارة عندها أقسام تحتها، بنطلب صلاحية منفصلة لكل قسم — أوضح للـ Admin.
- للـ `admin`/`owner` (system role): بيتخطوا الفحص كله ويرجع TRUE على طول (زي دلوقتي).
