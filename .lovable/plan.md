# خطة تحسين UX الشاملة + نظام تخصيص المظهر لكل مستخدم

## الفكرة العامة
كل مستخدم يقدر يتحكم فى الألوان والخط ووضع الليل/النهار من داخل التطبيق، والإعدادات دى بتتحفظ فى الداتا بيز مربوطة بحسابه — يعنى لو دخل من أى جهاز يلاقى نفس المظهر. مع تطبيق نظام تصميم موحد على كل الشاشات لتحسين التجربة.

---

## المرحلة 1 — البنية التحتية للمظهر (Personalization Infra)

### 1.1 جدول تفضيلات الواجهة
جدول جديد `user_ui_preferences` (RLS: كل مستخدم يقرا/يكتب صفه فقط):
- `user_id` (PK, FK → auth.users)
- `theme_mode` (`light` | `dark` | `system`)
- `preset` (`navy` | `emerald` | `slate` | `indigo` | `custom`)
- `primary_hue`, `primary_chroma` (لو custom)
- `radius` (`sm` | `md` | `lg`)
- `density` (`comfortable` | `compact`)
- `font_family` (`outfit` | `sora` | `space-grotesk` | `urbanist` | `cairo`)
- `sidebar_collapsed` (bool)
- `lang` (`ar` | `en`) — نقل تفضيل اللغة للداتابيز بدل localStorage

### 1.2 ThemeProvider موحّد
- `src/providers/ThemeProvider.tsx`: يقرأ التفضيلات عبر TanStack Query ويحقن CSS variables على `<html>` (كل tokens: `--primary`, `--radius`, `--font-sans`، إلخ).
- Fallback على localStorage للـ SSR/pre-hydration عشان مفيش وميض.
- تحميل خطوط Google تلقائى حسب الاختيار (`<link>` فى `__root.tsx`).

### 1.3 توسيع `styles.css`
- إعادة تنظيم tokens (light/dark لكل preset).
- إضافة `--radius-scale` و `--density-scale` للتحكم فى الحشو الموحد.
- Semantic tokens إضافية للحالات (success/warning/info) بلمسات كل preset.

---

## المرحلة 2 — شاشة "المظهر" فى الإعدادات

`/settings/appearance` (تبويب جديد فى Settings):
- **وضع الإضاءة**: نهارى / ليلى / تلقائى (بأيقونات Sun/Moon/Monitor).
- **جاليرى الثيمات**: 4 كروت جاهزة (Navy Trust / Emerald Prestige / Slate Steel / Midnight Indigo) مع معاينة حية.
- **مخصص**: color picker للـ Primary + Accent مع معاينة زرار حى.
- **الخط**: 5 خيارات مع sample نص عربى + إنجليزى لكل واحد.
- **الحجم**: Radius (حاد/متوسط/دائرى) + الكثافة (مريح/مدمج).
- زرار "إعادة الافتراضى" و"تطبيق على كل الأجهزة" (autosave).

---

## المرحلة 3 — نظام UI موحّد على كل الشاشات

مكونات مشتركة جديدة تحت `src/components/ui-kit/`:
- `PageHeader` — عنوان + وصف + breadcrumbs + إجراءات (شكل موحد على كل الشاشات).
- `PageToolbar` — بحث + فلاتر + view toggle (grid/list).
- `EmptyState` — أيقونة + عنوان + CTA (بدل الرسائل النصية الحالية).
- `DataTable` مطوّر — sorting + column visibility + sticky header + row density من الإعدادات.
- `StatCard` — kpi موحّد بأيقونة وترند.
- `ListSkeleton` / `CardSkeleton` — Loading states احترافية بدل النصوص.

## المرحلة 4 — تطبيق النظام الجديد شاشة شاشة

على كل الشاشات: استبدال الـ headers/toolbars/empty-states بالمكونات الموحدة، وتوحيد spacing و shadows و corners، وإضافة loading skeletons، وضبط responsive جيد للموبايل.

- Dashboard (index) — grid موحّد + StatCards + آخر نشاط.
- Customers — DataTable محسّن + فلاتر جانبية + سلة العميل من ريل.
- Workflows — Timeline موحّد للمراحل + بطاقات approvals أوضح.
- HR / Team — قوائم مستخدمين بـ avatars + شارات دور واضحة.
- Organization — تحسين OrgChart (spacing/connectors) + قائمة جانبية.
- Form Builder — تحسين ترتيب الحقول + preview جانبى للنموذج النهائى.
- Settings — sidebar محدث + كل التبويبات على نفس النسق.
- Notifications — قائمة مجمّعة بالتاريخ (اليوم/الأمس/الأسبوع).
- Trash — قائمة موحّدة + إجراءات bulk.
- Auth / Pending — تصميم أنيق مع الـ preset المختار.

## المرحلة 5 — تحسينات UX عامة

- **Command Palette** (⌘K موجود فعلاً) — إضافة اختصارات لكل شاشة.
- **Breadcrumbs** فى كل الشاشات الفرعية.
- **Toasts** موحّدة بألوان الـ preset.
- **Confirm dialogs** لكل الإجراءات الحذف (فى بعض الأماكن ناقصة).
- **Autofocus** على أول input فى كل الحوارات (طبّقناها جزئياً — نعمّمها).
- **Keyboard navigation**: `Esc` يقفل الحوارات، `Enter` يحفظ، `/` يفتح البحث.
- **Optimistic updates** لكل mutations (طبقناها فى بعض الأماكن — نعمّمها).
- **Error boundaries** لكل route مع رسائل ودّية.
- **RTL polish** — مراجعة كل الأيقونات والسهام تكون فى الاتجاه الصحيح.

---

## التفاصيل التقنية

- **Query invalidation**: تعديل التفضيلات يحدث cache فوراً بدون reload.
- **Prefetch**: تحميل تفضيلات المستخدم فى `_authenticated/route.tsx` قبل عرض أى شاشة (لتفادى الوميض).
- **Migration**: SQL migration واحدة تعمل الجدول + policies + grants + default row لكل مستخدم موجود.
- **Type safety**: تحديث `types.ts` تلقائياً بعد الـ migration.
- **Zero breaking changes**: الشاشات الحالية تستمر تعمل أثناء الترحيل التدريجى.

---

## ترتيب التنفيذ المقترح
1. المرحلة 1 (Infra) — أساس كل حاجة.
2. المرحلة 2 (شاشة المظهر) — تختبر النظام فوراً.
3. المرحلة 3 (UI Kit) — قبل تطبيقه على الشاشات.
4. المرحلة 4 (تطبيق على الشاشات) — واحدة واحدة مع تأكيد بعد كل شاشة.
5. المرحلة 5 (لمسات UX) — بعد ما التصميم يستقر.

مدة تقديرية: 5–7 خطوات كبيرة، كل خطوة نراجعها معاك قبل ما نكمل.
