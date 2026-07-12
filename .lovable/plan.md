# خطة: منشئ الشاشات العام + صفحة الإعدادات المركزية

## 1) تعميم منشئ الحقول على أي شاشة (مش بس العملاء)

بدل ما يكون فيه جداول خاصة بالعملاء، نعمل نظام عام:

**جداول DB جديدة (تحل محل الحالية الخاصة بالعملاء):**
- `form_entities` — يعرّف كل شاشة قابلة للتخصيص (customers, quotes, workflows, …). فيه `key`, `label_ar`, `label_en`, `is_system`.
- `form_fields` — كل الحقول لكل الشاشات (يحل محل `customer_field_definitions`). زيادة على الحالي:
  - `entity_key` (FK لـ form_entities)
  - `row_index` (int) + `col_span` (1..12) → للتحكم في الـ layout grid
  - `position` داخل الصف (order)
- `form_field_options` — نفس الفكرة لكن عام.
- `form_field_values` — القيم الفعلية، مرتبطة بـ `entity_key` + `record_id` (uuid) بدل ما تكون مربوطة بجدول واحد.

**Migration path:** نرحّل بيانات `customer_field_*` الحالية للجداول الجديدة ثم نحذف القديمة.

## 2) صلاحيات مرنة (مش الأدمن بس)

- الصلاحية الحالية `manage_customer_fields` نغيّرها لـ `manage_form_fields` (تشمل كل الشاشات).
- كل إدخال في `form_entities` ممكن يشير لـ permission مخصصة (مثلاً `manage_customer_fields`, `manage_quote_fields`) → المستخدم يقدر يعدّل شاشة معينة بس.
- إدارة الصلاحيات نفسها تتم من صفحة Settings > Permissions.

## 3) صفحة الإعدادات المركزية `/settings`

route واحد بتبويبات جانبية:

```
/settings
├── /settings/general       — اللغة الافتراضية، اسم الشركة، الشعار
├── /settings/form-builder  — منشئ الحقول لكل الشاشات (اختيار الشاشة من dropdown)
├── /settings/permissions   — إدارة الأدوار والصلاحيات لكل مستخدم
├── /settings/reports       — إعدادات التقارير (لاحقاً)
├── /settings:الخ…
```

كل تبويب يظهر بس لو المستخدم عنده الصلاحية المناسبة.  
البنود القديمة (admin/customer-fields, hr, team) نقلها تحت `/settings/*` تدريجياً.

## 4) منشئ الحقول التفاعلي (Drag & Drop حقيقي)

استخدام `@dnd-kit` (خفيف ومتوافق مع RTL):

**واجهة الـ builder — عمودين:**
- **يسار (Sidebar):** أنواع الحقول (text, number, dropdown, file, bilingual…) — تسحبها للـ canvas.
- **يمين (Canvas — grid 12-column):**
  - كل صف يقدر يحتوي أكتر من حقل جنب بعض حسب `col_span`.
  - تسحب الحقل يمين/شمال داخل الصف = تغيير الترتيب.
  - تسحبه لصف تاني = نقله.
  - مقبض على حافة الحقل لتغيير العرض (col_span: 3/4/6/8/12).
  - كليك على الحقل يفتح لوحة إعدادات على اليمين (label, required, validation, options).
- **معاينة Live:** زرار "Preview" يعرض الشاشة بنفس الشكل اللى هيشوفه المستخدم النهائى.

## 5) عرض الشاشة النهائية للمستخدم

`<DynamicForm entityKey="customers" recordId={...} />`:
- يجيب `form_fields` مرتبة حسب `row_index` ثم `position`.
- يرسمها في CSS Grid (`grid-cols-12`) وكل حقل يأخذ `col-span-{col_span}`.
- يقرأ/يكتب في `form_field_values` تلقائياً.
- RTL/LTR يشتغل تلقائى من `dir`.

## 6) UX التفاصيل

- Undo/Redo داخل الـ builder (Ctrl+Z).
- Auto-save كل تغيير + مؤشر "Saved ✓".
- Duplicate field, hide field (soft), archive.
- Sections/Tabs داخل الشاشة الواحدة (accordion groups).
- Keyboard: Enter لتحرير label، Delete للحذف، Arrow keys للتنقل.
- Mobile: الـ grid ينهار لعمود واحد تلقائى (`md:col-span-*`).

## Technical details

- **DB:** migration واحدة تنشئ الجداول الجديدة + ترحيل + drop للقديم.
- **Component tree:**
  - `src/routes/_authenticated/settings/route.tsx` — layout بتبويبات
  - `src/routes/_authenticated/settings/form-builder.tsx`
  - `src/components/form-builder/{FieldPalette, FormCanvas, FieldEditor, DynamicForm}.tsx`
- **DnD lib:** `@dnd-kit/core` + `@dnd-kit/sortable`.
- **إزالة:** صفحة `/admin/customer-fields` القديمة (redirect لـ `/settings/form-builder?entity=customers`).
- **Existing customer form:** الحقول الأساسية (اسم/عنوان/تليفون…) تتحوّل لـ system-seeded rows في `form_fields` بحيث الأدمن يقدر يخفيها/يعيد ترتيبها بس مش يمسحها.

## نطاق التنفيذ

كبير — هعمله على مرحلتين:

**Phase 1 (الآن):**
- DB الجديد + الترحيل
- `/settings` shell + التنقل
- Form Builder بالـ DnD الحقيقى لشاشة العملاء بس
- `DynamicForm` component + دمجه فى شاشة العملاء

**Phase 2 (بعد ما تراجع):**
- تعميمه على شاشة Quotes وHR
- Sections/Tabs، Undo/Redo، Preview mode
- نقل باقى الإعدادات (لغة، تقارير) لـ Settings

## أسئلة قبل ما أبدأ

1. **الحقول الأساسية للعميل** (name, tax_id, address…): تفضل تبقى system-seeded مع إمكانية إخفاء/إعادة ترتيب فقط، ولا مسموح للأدمن يحذفها نهائى؟
2. **صلاحيات كل شاشة:** permission واحدة `manage_form_fields` تخلى صاحبها يعدل كل الشاشات، ولا permission لكل شاشة (`manage_customer_fields`, `manage_quote_fields`)؟
3. **الحقول الحالية اللى موجودة فى الكود** (شاشة العملاء الحالية بكل حقولها الـ hardcoded): أستبدلها بالكامل بـ `<DynamicForm />` أم أخليها كما هى وأضيف قسم dynamic تحتها؟

قوللى الإجابات وأبدأ Phase 1 على طول.
