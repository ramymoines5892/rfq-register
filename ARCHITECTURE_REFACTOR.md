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

## Current folder layout

```text
src/
  routes/                          # TanStack Start file routes (unchanged)
  modules/                         # business domains — already in place
    branches/  inventory/  partners/  warehouses/ ...
    <each>/  api.ts   queries.ts   (some: components/, logic/, rules.ts)
  shared/                          # NEW — cross-domain primitives
    errors/  notifications/  loading/  validation/  types/  constants/
  components/                      # UI (shadcn) + shared widgets
  hooks/                           # cross-domain hooks (useAccess, ...)
  lib/                             # legacy utilities (candidates to move into shared/)
  integrations/supabase/           # generated client + types (do not edit)
  providers/  contexts/            # app-level providers
```

---

## Remaining technical debt (unchanged — not yet addressed)

| Area | Debt | Recommended phase |
|------|------|-------------------|
| Service layer | 13 route files still `import { supabase } from "@/integrations/supabase/client"` directly instead of going through `modules/<d>/api.ts`. | Phase 2 |
| Route size | `customers.tsx` (1846 LOC), `settings.form-builder.tsx` (1305), `settings.company.tsx` (923), `hr.tsx` (833), `partners.tsx` (761), `organization.tsx` (750) mix rendering, business logic, and API calls. | Phase 3 |
| Type safety | `as any` present in ~15 files including `customers.tsx`, `partners.tsx`, `organization.tsx`, `products.tsx`, `warehouses.tsx`, `inventory.tsx`, `hr.tsx`. | Phase 4 |
| Validation | Inline ad-hoc validators in `partners`, `customers`, `company`, `setup` should move to `modules/<d>/schema.ts` using shared primitives. | Phase 5 |
| Toasts | Direct `sonner` imports scattered across 20+ files. Migrate to `notify.*`. | Phase 2 (piggyback) |
| Performance | `PermissionMatrix`, partners docs, inventory tables re-render on unrelated cache updates. | Phase 6 |
| Dead code | Some `lib/` helpers duplicate what now lives in `shared/`. Legacy `admin.customer-fields.tsx` removed previously; audit for more. | Phase 7 |

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
