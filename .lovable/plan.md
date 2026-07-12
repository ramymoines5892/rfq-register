# خطة التحويل إلى Data Layer + TanStack Query

## ✅ اللى اتعمل

### المرحلة 1.1 — البنية التحتية
- `src/router.tsx` — `QueryClient` بـ `staleTime: 30s`, `gcTime: 5min`.
- `src/features/_shared/queryKeys.ts` — factory موحّد لكل الـ query keys.

### المرحلة 1.2 — Notifications ✅
- `src/features/notifications/api.ts` + `queries.ts`
- `NotificationBell.tsx` و `settings.notifications.tsx` بيستخدموا الـ hooks الجديدة
- Realtime عن طريق `invalidateQueries` بدل تعديل state يدوي

### المرحلة 1.3 — Customers ✅
- `src/features/customers/api.ts` + `queries.ts`
- `useCustomers`, `useCustomerRelations`, `useSoftDeleteCustomer`
- `customers.tsx`: قائمة العملاء + حذف + تفاصيل (contacts/banks/attachments) عبر الـ query cache

### المرحلة 1.4 — Workflows ✅
- `src/features/workflows/api.ts` + `queries.ts`
- `useTemplates`, `useTemplateDetail`, `useTeamProfiles`, وكل الـ mutations (create/rename/delete/stages/approvers)
- `workflows.tsx` اتعاد كتابته بالكامل — مفيش `supabase.from` مباشر ولا `useEffect+fetch`

### المرحلة 1.5 — HR / Team ✅
- `src/features/hr/api.ts` + `queries.ts` (reads + writes + permissions)
- Reads: `useProfiles`, `useUserRoles`, `useCurrentUserId`, `useHrDashboard`, `useUserPermissions`
- Mutations: `useApproveUser`, `useBulkApproveUsers`, `useSetProfileStatus`, `useBulkSetProfileStatus`, `useUpdateProfile`, `useSetUserRole`, `useRemoveFromTeam`, `useGrantPermission`, `useRevokePermission`
- `team.tsx` و `hr.tsx` صفر `supabase.from` مباشر — كل الـ mutations بتعمل invalidate تلقائى
- Dead code (Departments/JobTitles tabs) اتشال — الوظيفة موجودة فى `/settings/organization`

### المرحلة 1.6 — Trash (Settings) ✅
- `src/features/trash/api.ts` + `queries.ts`
- `useOwnerCheck`, `useDeletedRows`, `useRestoreRow`, `usePurgeRow`
- `settings.trash.tsx`: صفر `supabase.from` مباشر؛ التحديث بعد restore/purge عن طريق invalidateQueries

## ⏳ اللى لسه (نطاق كبير — يحتاج جلسات مخصّصة)

- **`settings.form-builder.tsx`** (1348 سطر) — feature module لـ `customer_field_definitions` + `customer_field_options`.
- **`settings.organization.tsx`** (1111 سطر) — feature module للـ org fields + مخطط الشركة.

## 🧪 التحقق

- كل تعديل عدّى `tsgo --noEmit` بدون أخطاء.
- الـ realtime في Notifications شغال والـ optimistic delete في العملاء شغال.
- كل الـ features الحالية اللى اتحوّلت (Notifications, Customers list/detail/delete, Workflows, Team) صفر `supabase.from` مباشر في الـ UI.

## 🗂️ الهيكل النهائي

```
src/features/
├── _shared/queryKeys.ts
├── notifications/  ← api.ts + queries.ts  ✅
├── customers/      ← api.ts + queries.ts  ✅
├── workflows/      ← api.ts + queries.ts  ✅
└── hr/             ← api.ts + queries.ts  ✅ (reads)
```
