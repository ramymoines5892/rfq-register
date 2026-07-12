## الخطوة 1: إنشاء طبقة Data Layer + TanStack Query

### الهدف
تنظيم كل استدعاءات قاعدة البيانات (151 استدعاء مباشر لـ `supabase.from(...)`) في طبقة واحدة منظمة، وتحويل الـ 45 استخدام لـ `useEffect + fetch` إلى TanStack Query — علشان:
- الأداء أحسن (caching + deduplication)
- الكود أنضف وأسهل في الصيانة
- تحديث تلقائي للبيانات بعد التعديل
- معالجة أفضل للأخطاء والتحميل

### الاستراتيجية
هنشتغل بالتدريج — مش هنكسر أي حاجة. كل feature (customers, workflows, notifications...) ليها فولدر خاص، والمكونات القديمة تفضل شغالة لحد ما نحوّلها.

### هيكل جديد

```text
src/features/
├── customers/
│   ├── api.ts          ← دوال Supabase raw
│   └── queries.ts      ← queryOptions + hooks
├── workflows/
│   ├── api.ts
│   └── queries.ts
├── notifications/
│   ├── api.ts
│   └── queries.ts
├── quotes/
├── hr/                 ← profiles, departments, job_titles
└── settings/           ← form-builder, org fields
```

### الخطوات التنفيذية (بالترتيب)

**المرحلة 1.1 — البنية التحتية** (هنبدأ بيها دلوقتي)
1. التأكد إن `QueryClient` مظبوط في `router.tsx` بـ defaults كويسة (staleTime، retry).
2. إنشاء `src/features/_shared/queryKeys.ts` — factory موحّد للـ query keys.
3. إنشاء `src/features/_shared/types.ts` — DTOs مشتركة (Pagination، Result).

**المرحلة 1.2 — أول feature: Notifications** (نموذج تجريبي)
- ملف `src/features/notifications/api.ts` — كل استدعاءات جدول notifications و notification_preferences.
- ملف `src/features/notifications/queries.ts` — `useNotifications()`, `useNotificationPrefs()`, `useMarkRead()`, `useMarkAllRead()`, `useSaveNotificationPrefs()`.
- تحويل `NotificationBell.tsx` و `settings.notifications.tsx` يستخدموا الـ hooks الجديدة.
- الـ realtime channel يعمل `queryClient.invalidateQueries` بدل ما يعدل الـ state يدوي.

**المرحلة 1.3 — Customers**
- كل حاجة خاصة بـ customers, customer_contacts, customer_banks, customer_attachments, customer_field_*.
- تحويل `customers.tsx` (1348 سطر) يستخدم الطبقة الجديدة.

**المرحلة 1.4 — Workflows + Quotes**
- workflow_templates, workflow_stages, workflow_stage_approvers, quotes, quote_approvals, quote_attachments.
- تحويل `workflows.tsx` (1873 سطر).

**المرحلة 1.5 — HR + Settings**
- profiles, user_roles, user_permissions, departments, job_titles.
- تحويل `hr.tsx`, `team.tsx`, `settings.*`.

**المرحلة 1.6 — التنظيف**
- إزالة أي `useEffect + supabase.from` متبقي.
- توحيد error handling عبر `errorComponent` في الـ routes.

### النطاق للـ turn ده بس
هنعمل **المرحلة 1.1 + 1.2 فقط** (البنية التحتية + Notifications كنموذج). لو الشغل عجبك، نكمل باقي المراحل واحدة واحدة.

### ملفات هتتعدل/تتعمل في الـ turn ده
- ✨ جديد: `src/features/_shared/queryKeys.ts`
- ✨ جديد: `src/features/notifications/api.ts`
- ✨ جديد: `src/features/notifications/queries.ts`
- 📝 تعديل: `src/components/notifications/NotificationBell.tsx` (يستخدم الـ hooks الجديدة)
- 📝 تعديل: `src/routes/_authenticated/settings.notifications.tsx` (يستخدم الـ hooks الجديدة)
- 📝 تحقق: `src/router.tsx` (QueryClient defaults)

### ملاحظة مهمة
مش هنمس أي feature تانية في الـ turn ده — كل الصفحات التانية هتفضل شغالة زي ما هي. التحويل هيكون تدريجي وآمن.

**موافق نبدأ؟**