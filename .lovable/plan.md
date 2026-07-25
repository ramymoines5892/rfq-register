
# الخطة — 3 مراحل متتابعة

بعد كل مرحلة أوقف وأعرض النتيجة عشان تراجع قبل ما نكمل. ده شغل كبير وحساس (تغييرات في مسارات الاستيراد لكل المشروع)، فالتقسيم ده بيقلل المخاطر.

---

## المرحلة 1 — فحص شامل للداتابيز والكود

**الهدف:** أتأكد إن كل حاجة شغالة صح قبل ما نبني فوقها.

- **فحص الداتابيز:**
  - كل الجداول: RLS مفعّل؟ GRANTs موجودة لكل جدول public؟
  - العلاقات (FKs): سليمة ومربوطة صح؟ فيه أعمدة orphan؟
  - الـ enums وقيمها متطابقة مع الكود؟
  - الـ functions/triggers شغالة (security definer, search_path)?
  - `supabase--linter` لأي تحذيرات
- **فحص الكود:**
  - كل `useQuery`/`useMutation` عندها queryKey متسق ومفيش invalidation ناقصة
  - كل استخدامات `as any` — أيها بيخفي bug فعلي
  - كل الحقول اللي في UI مقابلها في الداتابيز والعكس (خصوصاً `companies` — فيه عمود `fax` و `faxes` jsonb، لازم نتأكد)
  - أي imports مكسورة، أي routes بدون `head()`، أي شاشة بترمي error صامت
- **المخرج:** تقرير `AUDIT_PHASE1.md` فيه:
  - ✅ حاجات سليمة
  - ⚠️ مشاكل غير حرجة (اقتراحات)
  - ❌ مشاكل حرجة — بصلحها فوراً في نفس المرحلة

---

## المرحلة 2 — إعادة تصميم `/settings/company` كـ Wizard

**الشكل:** نفس تجربة `/setup` بالظبط، 4 خطوات:

```text
[1 عام] → [2 متقدم] → [3 وثائق] → [4 ترقيم]
```

- **Stepper علوي sticky** مع progress bar (نفس مكون setup) — قابل للنقر للتنقل بين الخطوات
- **الخطوات:**
  1. **عام:** الاسم AR/EN، الكود، الشعار، جهات الاتصال المتعددة (emails/phones/mobiles/faxes/websites) — بنفس مكون `MultiContactField`
  2. **متقدم:** الدولة/المحافظة/المدينة (cascading)، العملة الأساسية، اللغة الافتراضية، التوقيت، صيغ التاريخ/الأرقام، السنة المالية، أرقام ضريبية/تجارية
  3. **وثائق الشركة:** نفس شبكة البلاطات المربعة (`DocumentsDialog`) مع الصلاحيات وتنبيهات الانتهاء
  4. **ترقيم المستندات:** نفس محرر السلاسل بـ prefix + preview + reset policy
- **الفروق عن `/setup`:**
  - العنوان "تعديل بيانات الشركة" بدل "الإعداد الأولي"
  - زر "حفظ التغييرات" في كل خطوة (بدل "التالي" فقط)
  - مفيش auto-signOut بعد الحفظ
  - العودة للـ Settings hub بعد الحفظ النهائي
- **مشاركة الكود:** أستخرج مكونات الخطوات من `src/routes/setup.tsx` إلى `src/modules/company/wizard/` عشان الشاشتين يستعملوا نفس الكود (source of truth واحد)
- **بعد التنفيذ:** تحقق يدوي في المتصفح (screenshot) قبل ما ننتقل

---

## المرحلة 3 — إعادة تنظيم فولدرات المشروع

**الهيكل الجديد** `src/modules/<name>/`:

```text
src/modules/
  company/       api.ts queries.ts components/ wizard/ tests/
  branches/
  warehouses/
  inventory/
  transfers/
  adjustments/
  partners/
  customers/
  products/
  organization/  (departments, managements, positions, employees)
  hr/
  approvals/
  workflows/
  quotes/
  notifications/
  search/
  appearance/
  foundation/
  features/
  formBuilder/
  trash/
  companyDocs/
```

- `src/routes/` تفضل مكانها (TanStack file-based routing — تغييرها بيكسر الـ router)
- كل route بيستورد من `@/modules/<name>` بدل `@/features/<name>`
- `src/components/ui/` (shadcn), `src/hooks/`, `src/lib/`, `src/integrations/` تفضل مكانها (shared)
- `src/components/organization/*` → `src/modules/organization/components/`
- `src/features/*` → `src/modules/*` مع تحديث كل الـ imports
- **الأدوات:** ripgrep لإيجاد كل `@/features/` و `@/components/organization/` واستبدالها، بعدها typecheck كامل + `bunx vitest run`
- **الاختبار:** بعد النقل، تشغيل الـ dev server والتأكد من كل route بيفتح صح

---

## تفاصيل تقنية (للمراجعة)

- **جدول companies** فيه ازدواج: `fax` (text) + `faxes` (jsonb). خلال المرحلة 1 هحدد لو `fax` القديم لسه مستعمل؛ لو لأ، هقترح إسقاطه في migration.
- **حقول ناقصة محتملة:** `companies` مفيهاش `industry` أو `size` أو `established_year` — لو الويزرد بيحتاجهم نضيفهم في migration.
- **الاستخدامات المتأثرة بإعادة التنظيم:** ~60 ملف route + component. كل التغييرات مسارات imports فقط، لا logic changes.
- **Backwards compat:** ممكن أخلي `src/features/` فيها re-exports مؤقتة لو حبيت — لكن الأنضف نعمل النقل مرة واحدة كاملة.

---

**نبدأ بالمرحلة 1؟** لما توافق، هبدأ الفحص فوراً وأرجعلك بالتقرير قبل ما نلمس أي كود.
