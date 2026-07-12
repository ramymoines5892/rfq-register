# خطة: شاشة الهيكل التنظيمي (Organization)

## الهدف
شاشة موحّدة داخل الإعدادات لإدارة **الإدارات** و**المسميات الوظيفية** برسمة Org Chart حية، وحقول قابلة للتخصيص، وبيانات افتراضية جاهزة.

## المكان والتنقّل
- شاشة جديدة: `/settings/organization` (تبويب داخل الإعدادات).
- ننقل تبويبَي "الإدارات" و"المسميات" من `/hr` إلى هنا، ويبقى `/hr` لإدارة الموظفين فقط.
- إضافة التبويب في `settings.tsx` بأيقونة Network.

## تخطيط الشاشة (Layout)
عمودان (2:1) مع toggle للموبايل:

```
┌─────────────────────────────────┬──────────────────┐
│  Org Chart (react-flow)         │  Inspector       │
│  - سحب/تكبير/تصغير              │  الاسم AR/EN     │
│  - كل إدارة node ملوّن          │  الكود، المدير   │
│  - أزرار: + قسم فرعي، +مسمى     │  الحقول المخصصة  │
│  - Fit view، Export PNG          │  حذف/أرشفة      │
│  - عرض تلقائى بالـ dagre layout │                  │
└─────────────────────────────────┴──────────────────┘
Tabs: [الإدارات] [المسميات الوظيفية]  (نفس الـ inspector يشتغل للاثنين)
```

- كل node يعرض: اللون، الاسم، عدد الأقسام الفرعية، عدد المسميات المرتبطة، عدد الموظفين.
- كليك على node → يفتح Inspector؛ dblclick → تعديل سريع للاسم inline.
- زر عائم `+ إدارة جديدة` أعلى يمين الرسمة.

## القوالب (Form Builder)
- إضافة entity جديد في `form_entities`: `department` و `job_title` (system-seeded).
- الحقول النظامية المحمية (لا تُحذف، تُخفى فقط):
  - department: name_ar, name_en, code, color, parent_id, manager_id, status
  - job_title: name_ar, name_en, code, department_id, level, status
- الحقول الإضافية (تليفون داخلي، ميزانية، موقع، …) تُضاف من `/settings/form-builder?entity=department` وتظهر تلقائيًا في Inspector عبر `<DynamicForm />`.

## البيانات الافتراضية
Migration seed (idempotent — يعمل فقط لو الجدول فارغ):
- **إدارات**: المبيعات، المشتريات، المخازن، المالية، الموارد البشرية.
- **مسميات**: مدير النظام، مدير عام، مدير الموارد البشرية، مدير مبيعات، مدير مشتريات، أمين مخزن، محاسب.
- كل إدارة لها لون ثابت (design tokens) وكود قصير.
- زر "إعادة تعيين الافتراضيات" فى الـ header للـ owner.

## سلاسة الاستخدام
- إضافة سريعة: `Enter` بعد الاسم يحفظ ويفتح صف جديد.
- Optimistic updates + toast محترم (بدل confirm/alert المتصفح).
- Drag & drop لتغيير الأب (parent_id) داخل الـ chart.
- بحث فورى فى الرسمة (يميّز الـ nodes المطابقة).
- ألوان محددة من قائمة (لا color picker حر).

## التفاصيل التقنية

**DB migration:**
- `ALTER TABLE departments ADD COLUMN parent_id uuid REFERENCES departments(id), color text, code text`.
- `ALTER TABLE job_titles ADD COLUMN department_id uuid, level int, code text`.
- Seed rows للـ `form_entities` لـ `department` و`job_title`.
- Seed للـ system fields فى `form_fields` لكل entity.
- Seed للـ default departments/job_titles (بس لو الجداول فاضية).

**Packages:**
- `@xyflow/react` (react-flow الحديث) — للـ Org Chart.
- `dagre` — للـ auto-layout الشجرى.

**Files:**
- `src/routes/_authenticated/settings.organization.tsx` — الشاشة.
- `src/components/organization/OrgChart.tsx` — الرسمة.
- `src/components/organization/OrgInspector.tsx` — لوحة التعديل.
- `src/components/organization/orgLayout.ts` — منطق dagre.
- تحديث `settings.tsx` لإضافة التبويب.
- تنظيف tabs الإدارات/المسميات من `hr.tsx`.

## نطاق التنفيذ
جلسة واحدة كبيرة. هأبدأ بالـ migration، وأستنى موافقتك عليها، وبعدها أكوّد الشاشة والمكونات دفعة واحدة.
