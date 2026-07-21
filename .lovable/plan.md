# ربط مميزات النظام بالسلوك الفعلي

كلامك صح — حالياً المميزات مجرد Switches بتتخزن ومحدش بيقرأها. الخطة إننا نحوّلها لـ **Feature Flags حقيقية** تتحكم فى ظهور وإتاحة الموديولات فى كل النظام، مع نظام قابل للتوسّع بحيث كل ما نبنى موديول جديد بنسجّله فى مكان واحد.

## المبدأ

المميزات = مفاتيح تشغيل فعلية. لما `multi_branch = false` مفيش صفحة فروع أصلاً، ولما `multi_currency = false` حقل العملة يختفى من كل الفواتير والعروض، وهكذا.

## الخطوات

### 1. مصدر واحد للمميزات (Feature Registry)
ملف `src/lib/features/registry.ts` فيه لكل ميزة:
- المفتاح، الاسم بالعربى/الإنجليزى، الوصف، الأيقونة، التصنيف (أساسى / تشغيلى / تتبع / مالى).
- `depends_on`: مثلاً `heat_number` يحتاج `traceability`.
- `affects`: قائمة الـ Routes والـ Components والحقول اللى تتأثر.
- `default`: القيمة الافتراضية.

### 2. Hook مركزى `useFeature`
`useFeature("multi_branch")` يرجع `boolean` بيقرأ من `company_features` الحالى (Cached فى TanStack Query).
مع `<FeatureGate feature="multi_currency">...</FeatureGate>` لإخفاء أجزاء من الـ UI.

### 3. حماية الـ Routes
فى `_authenticated/route.tsx` نضيف `beforeLoad` guard: لو المستخدم دخل على `/branches` وهو مقفول، يتحوّل لصفحة "الميزة غير مفعّلة" مع زر "تفعيل".

### 4. ربط أول 6 مميزات فعلياً (Phase 1)
| الميزة | التأثير الفعلى |
|---|---|
| `multi_branch` | صفحة الفروع تختفى من السايدبار، حقل "الفرع" يختفى من كل الفورمز |
| `multi_warehouse` | صفحة المخازن + حقل "المخزن" فى المستندات |
| `multi_currency` | حقل العملة يظهر فى العروض/الفواتير + جدول أسعار صرف |
| `approval_workflow` | صفحة Workflow Templates + زر "طلب اعتماد" |
| `audit_log` | صفحة سجل التدقيق + تفعيل التسجيل التلقائى |
| `attachments` | زر رفع مرفقات على العملاء/العروض |

باقى المميزات (quality, traceability, heat_number, e_signatures...) نسيبها مسجّلة فى الـ Registry لكن بدون Route فعلى لحد ما نبنيها — الـ Switch يفضل موجود لكن يتقفل ومكتوب "قريباً".

### 5. صفحة إدارة المميزات بعد الـ Setup
`/_authenticated/settings/features` — نفس مكونات الـ Setup Wizard، الأونر/الأدمن يقدر يفعّل ويعطّل فى أى وقت مع تحذير لو الميزة عليها بيانات (مثلاً عاوز تقفل multi_branch وعندك 3 فروع).

### 6. نمط قابل للتوسّع
كل موديول جديد نبنيه لازم:
1. يضيف نفسه فى `registry.ts`.
2. يلف الـ Route بتاعه بـ `FeatureGate`.
3. يستخدم `useFeature` لإخفاء حقوله المشروطة.

بكده كل ما نبنى فى النظام، شاشة المميزات تتحدّث تلقائياً وتفضل مصدر الحقيقة الوحيد.

## تفاصيل تقنية

- **قاعدة البيانات**: `company_features` موجود بالفعل ومظبوط — بس هنضيف عمود `updated_by` و trigger يسجّل التغييرات فى `audit_logs`.
- **Cache**: `useFeatures()` query بـ `staleTime: Infinity` وnvalidate عند التحديث فقط.
- **Types**: نولّد `FeatureKey` union type تلقائياً من الـ Registry عشان الـ Typescript يمنع أى مفتاح غلط.
- **SSR-safe**: القراءة من Client فقط (protected routes)، مفيش تأثير على SEO.

## اللى مش داخل فى الخطة دى
- بناء الموديولات الناقصة نفسها (quality module, e-signatures...) — دى مشاريع منفصلة، بس البنية التحتية هتكون جاهزة لاستقبالها.

هل نبدأ بالتنفيذ كده، أو تحب نعدّل نطاق الـ Phase 1 (نضيف/نشيل مميزات)؟