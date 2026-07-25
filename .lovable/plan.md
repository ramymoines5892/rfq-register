
# Architectural Refactor Plan — ERP-Ready Structure

The project already uses a module-based layout (`src/modules/*`), TanStack Query, RLS-backed services, and typed Supabase. The audit shows the real friction is concentrated in a few hotspots, not the whole codebase. A single "refactor everything" pass would be high-risk (12,586 LOC in `_authenticated/`, 26 routes, live business rules) and would likely break behavior. I'll do this in **safe, verifiable phases**, each shippable on its own.

## Scope guardrails
- No UI redesign, no behavior changes, no schema changes.
- Every phase ends with typecheck + targeted route smoke tests.
- Routes stay thin wrappers over module code (TanStack Start requires this).

## Current state (quick audit)
- Good: `src/modules/{partners,branches,inventory,...}` with `api.ts` / `queries.ts`; shared `hooks/`, `lib/`, `components/ui/`; permissions + i18n centralized.
- Hotspots:
  - `customers.tsx` (1846 LOC), `settings.form-builder.tsx` (1305), `settings.company.tsx` (923), `hr.tsx` (833), `partners.tsx` (761), `organization.tsx` (750) — mixed UI + business logic + direct Supabase.
  - 13 route files import `@/integrations/supabase/client` directly instead of going through a module service.
  - `as any` scattered across 15+ files.
  - No shared `types/`, `constants/`, `validation/`, `errors/` folders; validation lives inline; toast calls are ad-hoc.

## Target structure (additive, not disruptive)
```text
src/
  routes/                 # thin TanStack route files (unchanged locations)
  modules/<domain>/
    api.ts                # Supabase calls (service layer)
    queries.ts            # TanStack Query keys + hooks
    schema.ts             # zod validation
    types.ts              # domain types
    constants.ts          # enums, defaults
    components/           # domain-specific UI
    hooks/                # domain hooks
  shared/
    types/                # cross-domain interfaces
    constants/            # app-wide constants
    validation/           # shared zod primitives (bilingual, phone, etc.)
    errors/               # normalizeError, toastError, ErrorBoundary helpers
    notifications/        # toast wrappers (success/error/info/promise)
    ui/                   # existing shadcn primitives (moved from components/ui)
    loading/              # Skeletons, Spinner, PageLoader
  hooks/  contexts/  lib/ config/   # unchanged
```
`shared/` is added alongside existing folders; nothing is deleted until callers migrate.

## Phased execution

### Phase 1 — Shared foundations (low risk, no behavior change)
- Add `src/shared/errors/normalizeError.ts` + `toastError()` wrapping current toast calls.
- Add `src/shared/notifications/notify.ts` (success/error/promise wrappers around `sonner`).
- Add `src/shared/loading/` (`PageLoader`, `InlineSpinner`, `TableSkeleton`) built from existing skeleton primitives.
- Add `src/shared/validation/primitives.ts` (bilingual name, email, phone, national id — reuse `textFilters`, `countryFormats`).
- Add `src/shared/types/common.ts` (Id, Timestamped, Paginated<T>, ApiResult<T>).
- No existing file changes required; new files ready for adoption.

### Phase 2 — Service layer completeness
For each domain that still calls Supabase from a route (`documents`, `hr`, `adjustments`, `settings.features`, `settings.document-types`, `roles`, `settings.tsx`, `index.tsx`, `route.tsx`):
- Extract the calls into `modules/<domain>/api.ts` (create if missing).
- Add matching `queries.ts` with typed query keys and hooks.
- Routes import hooks only; no direct `supabase` in routes.
- Preserve exact query shapes to avoid behavior drift.

### Phase 3 — Decompose the 3 largest routes
Target: `customers.tsx`, `settings.form-builder.tsx`, `settings.company.tsx`.
- Split into `modules/<domain>/components/` (sub-panels, dialogs, tables).
- Move business logic (row mapping, derived totals, form transforms) into `modules/<domain>/logic.ts` with unit tests where cheap.
- Route file becomes a thin composition (< 200 LOC target).
- Others (`hr`, `partners`, `organization`) follow the same pattern in a later pass — flagged as remaining debt if time-bound.

### Phase 4 — Type-safety pass
- Replace `as any` in the 15 flagged files with generated Supabase row types or narrow interfaces in `modules/<d>/types.ts`.
- Introduce `Database['public']['Tables'][...]['Row']` aliases in each module's `types.ts`.

### Phase 5 — Validation consolidation
- Move ad-hoc validators in `partners`, `customers`, `company`, `setup` into `modules/<d>/schema.ts` using zod, backed by shared primitives from Phase 1.
- Forms call `schema.parse` / `safeParse`; error messages route through `shared/errors`.

### Phase 6 — Performance sweep (surgical)
- Add `React.memo` + stable selectors to heavy tables (partners docs, inventory, permission matrix).
- Convert expensive `useMemo` deps to primitive keys.
- Replace inline `useQuery` refetch spam with proper invalidation keys (audit hits found in HR/notifications already fixed; verify remaining).
- No speculative rewrites; only measurable hotspots.

### Phase 7 — Dead-code + duplication sweep
- Remove unused imports/files flagged by `tsgo` + `rg`.
- Consolidate duplicate helpers (bilingual formatters, date formatters, empty-state components).

## Verification per phase
- `tsgo` clean.
- `bunx vitest run` for touched modules.
- Playwright smoke on affected routes.
- Cache invalidation manually reviewed for each moved mutation.

## Deliverable after execution
`ARCHITECTURE_REFACTOR.md` at repo root:
- Improvements applied per phase
- Files changed / moved / added
- Final folder tree
- Remaining technical debt (routes not yet decomposed, `any` residue, etc.)
- Recommendations before adding new ERP modules (Purchases, Manufacturing, ISO 9001 QMS)

## What I need from you
This is 2–4 hours of focused work if done in one shot and will touch dozens of files. Options:
1. **Do all 7 phases now** in one pass, report at the end.
2. **Do Phases 1–2 first** (foundations + service layer, lowest risk, highest leverage), review, then continue.
3. **Pick specific phases** you care about (e.g., "only 1, 2, 4").

Reply "all", "1-2", or list the phases you want.
