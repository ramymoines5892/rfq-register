# Architecture Refactor — Progress Report

Status: **Phase 1 shipped**. Phases 2–7 planned in `.lovable/plan.md` and
awaiting your go-ahead. This document is the running log — each phase
appends a section.

---

## Guardrails held on every phase

- No UI redesign.
- No behavior changes.
- No schema changes.
- Each phase ends with `tsgo` clean.
- Additive first, migrate callers opportunistically — no big-bang rewrites.

---

## Phase 1 — Shared foundations (DONE)

New folder `src/shared/` created. Every module — existing and future — now
has a single home for cross-cutting primitives.

### Files added

| Path                                        | Purpose                                                     |
| ------------------------------------------- | ----------------------------------------------------------- |
| `src/shared/errors/normalizeError.ts`       | `normalizeError()` + `AppError` type. Maps PostgREST codes, auth errors, native `Error`, strings, `unknown` → one stable shape. |
| `src/shared/notifications/notify.ts`        | `notify.success / info / warning / error / promise`. Wraps `sonner`; auto-normalizes errors. |
| `src/shared/loading/index.tsx`              | `InlineSpinner`, `PageLoader`, `TableSkeleton`, `CardsSkeleton`. |
| `src/shared/validation/primitives.ts`       | Zod primitives: `arabicName`, `englishName`, `email`, `optionalEmail`, `phone`, `optionalPhone`, `url`, `nationalIdEG`, `uuid`, `positiveInt`, `nonNegativeNumber`. Reuses existing `textFilters`. |
| `src/shared/types/common.ts`                | `Id`, `IsoTimestamp`, `Timestamped`, `CompanyScoped`, `BranchScoped`, `Paginated<T>`, `ApiResult<T,E>`, plus generic `Row<T>`/`Insert<T>`/`Update<T>`/`Enum<T>` helpers backed by the generated Supabase `Database` type. |
| `src/shared/constants/app.ts`               | `APP_NAME`, `DEFAULT_PAGE_SIZE`, `PAGE_SIZE_OPTIONS`, `SEARCH_DEBOUNCE_MS`, `STALE_TIME`, `LOCALES`. |
| `src/shared/README.md`                      | Rules of the road for `shared/`. |

### Adoption

- **Zero existing files were changed.** Nothing broke.
- New/modified code MUST use `shared/`.
- Existing code migrates opportunistically as it's touched.

---

## Phase 2 — Service layer completeness (IN PROGRESS)

Extracted reusable services and migrated the smallest, highest-leverage routes off direct `supabase` calls.

### New modules

| Path                                | Purpose                                              |
| ----------------------------------- | ---------------------------------------------------- |
| `src/modules/auth/api.ts`           | `getCurrentUser`, `getCurrentUserRoles`, `getCurrentUserPermissions`, `sendPasswordReset`. |
| `src/modules/auth/queries.ts`       | `useCurrentUser`, `useCurrentUserRoles`, `useCurrentUserPermissions` with proper stale times. |
| `src/modules/lookups/api.ts`        | Reference-data lookups: `listDepartments/JobTitles/Branches/Users` + batched `getXxxByIds`. |
| `src/modules/lookups/queries.ts`    | `useDepartmentsLookup`, `useJobTitlesLookup`, `useBranchesLookup`, `useUsersLookup`. |
| `src/modules/dashboard/api.ts`      | `getDashboardCounts` — parallel KPI counts, extracted from the route. |
| `src/modules/dashboard/queries.ts`  | `useDashboardCounts` with input-scoped keys. |

### Routes migrated

| Route                                        | Change |
| -------------------------------------------- | ------ |
| `_authenticated/index.tsx` (Dashboard)       | Dropped 2× `useEffect` + 6 raw Supabase calls → `useCurrentUser` + `useDashboardCounts`. Cache-shared across the app. |
| `_authenticated/documents.tsx`               | Departments lookup now via `useDepartmentsLookup` (shared cache). |
| `_authenticated/settings.tsx`                | Roles + permissions loading now via `useCurrentUserRoles` / `useCurrentUserPermissions`. Removed manual `useState`/`useEffect`. |
| `_authenticated/settings.features.tsx`       | Admin role check via `useCurrentUserRoles`. Toasts switched to `notify.*`. |
| `_authenticated/roles.tsx`                   | 8 inline Supabase queries collapsed to `modules/lookups` calls. |
| `_authenticated/hr.tsx`                      | `resetPasswordForEmail` moved into `modules/auth/api.ts#sendPasswordReset`. |

Typecheck: **clean** (`tsgo --noEmit` → 0 errors).

### Still to migrate in Phase 2

| Route                                            | Remaining direct supabase calls |
| ------------------------------------------------ | -------------------------------- |
| `_authenticated/adjustments.tsx`                 | 1 (companies lookup) — trivial, kept for follow-up |
| `_authenticated/settings.document-types.tsx`     | 0 direct calls, but toast migration pending |
| `routes/setup.tsx`, `routes/auth.tsx`, `routes/pending.tsx`, `routes/reset-password.tsx` | Public auth surfaces — auth calls are appropriate here; will use `modules/auth` for anything shared. |
| Various files still importing `sonner` directly   | Migrate to `notify.*` as touched. |

---

## Current folder layout

```text
src/
  routes/                          # TanStack Start file routes (unchanged)
  modules/                         # business domains
    auth/  branches/  dashboard/  inventory/  lookups/  partners/  warehouses/ ...
    <each>/  api.ts   queries.ts   (some: components/, logic/, rules.ts)
  shared/                          # cross-domain primitives
    errors/  notifications/  loading/  validation/  types/  constants/
  components/                      # UI (shadcn) + shared widgets
  hooks/                           # cross-domain hooks (useAccess, ...)
  lib/                             # legacy utilities (candidates to move into shared/)
  integrations/supabase/           # generated client + types (do not edit)
  providers/  contexts/            # app-level providers
```

---

## Remaining technical debt

| Area | Debt | Recommended phase |
|------|------|-------------------|
| Service layer | ~5 route files still call `supabase` directly for isolated one-liners (`adjustments`, auth surfaces). | Phase 2 (tail) |
| Route size | `customers.tsx` (1846 LOC), `settings.form-builder.tsx` (1305), `settings.company.tsx` (923), `hr.tsx` (833), `partners.tsx` (761), `organization.tsx` (750). | Phase 3 |
| Type safety | `as any` present in ~15 files. | Phase 4 |
| Validation | Inline ad-hoc validators in `partners`, `customers`, `company`, `setup` should move to `modules/<d>/schema.ts` using shared primitives. | Phase 5 |
| Toasts | ~15 files still import `sonner` directly. Migrate to `notify.*`. | Phase 2 (piggyback) |
| Performance | `PermissionMatrix`, partners docs, inventory tables re-render on unrelated cache updates. | Phase 6 |
| Dead code | Some `lib/` helpers duplicate what now lives in `shared/`. Audit for more. | Phase 7 |


---

## Recommendations before adding new ERP modules

Before Purchases, Manufacturing, or ISO 9001 QMS ship, complete **at
minimum** Phases 2 + 4:

1. **Enforce the service layer**: every new module must ship
   `api.ts + queries.ts` from day one; routes never touch `supabase`
   directly. Add a lightweight lint rule / grep check in CI.
2. **Kill `any`**: new code uses `Row<'table'>` / `Insert<'table'>` from
   `shared/types/common.ts` — no exceptions.
3. **Adopt `shared/validation` for all forms**: consistent Arabic/English
   input rules across the whole ERP.
4. **Standardize toasts** via `notify.*` so we get a single place to add
   telemetry, retries, or i18n later.
5. **Follow the module template**:
   ```
   modules/<domain>/
     api.ts          # Supabase calls only (service layer)
     queries.ts      # query keys + hooks
     schema.ts       # zod
     types.ts        # domain types (extending shared/types)
     constants.ts    # domain constants
     logic/          # pure functions (unit tested)
     components/     # domain UI
   ```
6. **Route files stay < 250 LOC** — they compose module components; they
   don't contain business rules.
7. **Every new mutation must invalidate its exact query keys** — no
   `queryClient.invalidateQueries()` without a key.

---

## How to proceed

Reply with one of:

- **"phase 2"** → migrate the 13 routes still using `supabase` directly into their module service layers + swap `sonner` imports for `notify.*`.
- **"phase 3"** → decompose the top-3 largest routes (customers, form-builder, company settings) into sub-components + logic files.
- **"phase 4"** → type-safety pass, eliminate `as any`.
- **"all"** → execute phases 2 → 7 in sequence, one large PR.
- **"stop"** → keep the foundations, ship as-is.
