# CODE AUDIT — Principal Architect Review

**Project:** TanStack Start + Supabase (Lovable Cloud) CRM/HR app
**Date:** 2026-07-12
**Reviewer:** Principal Software Architect
**Scope:** Every source file, every migration, every config.

> Brutally honest. No sugar-coating. Findings are ordered by section, each with severity, file, line, problem, impact, and fix.

---

## EXECUTIVE SUMMARY

This is a working **prototype** shipped as a production candidate. The domain logic is real, the RLS layer is mostly present, and the UI is bilingual and coherent — but the codebase is dominated by **giant "God" route files** (1,873 / 1,348 / 1,111 / 876 lines), **151 raw `supabase.from(...)` calls** scattered across components, **45 `useEffect` data-fetches** with only **5 React Query usages** in a stack whose entire point is server-state via TanStack Query, and **60+ `as any` / `as unknown as` casts** that erase the type safety `strict: true` was supposed to guarantee.

The router-level architecture is fine. Everything below it — data access, state management, component composition, typing discipline — needs a systematic refactor before this can be called production-ready.

### Final Scores

| Dimension              | Score  | Notes                                                                 |
| ---------------------- | ------ | --------------------------------------------------------------------- |
| Architecture           | 4/10   | No data layer, no feature modules, God components                     |
| Code Quality           | 4/10   | Files >1k LOC, heavy `any`, duplication across routes                 |
| Security               | 6/10   | RLS present but 10+ `SECURITY DEFINER` funcs open to anon; client-side role checks |
| Performance            | 5/10   | N+1 patterns, no query caching, refetch storms, unmemoized lists      |
| Maintainability        | 3/10   | Bilingual name pickers duplicated in every route, no shared hooks     |
| Scalability            | 4/10   | Every screen re-implements pagination/filter/sort by hand             |
| Production Readiness   | 4/10   | No tests, no error boundaries on routes, no CI, 20 linter warnings   |
| **Overall**            | **4.3/10** | Solid prototype; not shippable to paying customers as-is         |

---

## 1. PROJECT ARCHITECTURE

### 1.1 [CRITICAL] No data-access layer — Supabase is called directly from 20+ components
- **Files:** every route in `src/routes/_authenticated/*.tsx`, `src/components/**`, `src/hooks/useAccess.ts`
- **Evidence:** 151 direct `supabase.from(...)` / `supabase.rpc(...)` call sites in `src/` (see grep).
- **Problem:** Business logic, query shape, error handling and RLS assumptions are duplicated inline in UI components. Changing a column name means touching 15 files. There is no repository, no query-key convention, no single place to add caching, retries, telemetry, or auth-refresh handling.
- **Failure mode:** column rename ⇒ silent runtime error only found by clicking every screen. Adding pagination requires rewriting each component.
- **Fix:** create `src/features/<domain>/api.ts` per aggregate (customers, departments, jobTitles, quotes, workflows, notifications, form-fields). Export typed functions that wrap `supabase` and return `Result<T>`. Expose them through TanStack Query `queryOptions` (see 3.6).

### 1.2 [CRITICAL] God route files
| File | LOC |
| --- | --- |
| `src/routes/_authenticated/customers.tsx` | **1,873** |
| `src/routes/_authenticated/settings.form-builder.tsx` | **1,348** |
| `src/routes/_authenticated/settings.organization.tsx` | **1,111** |
| `src/routes/_authenticated/index.tsx` | **876** |
| `src/routes/_authenticated/hr.tsx` | **747** |
| `src/components/ui/sidebar.tsx` | 744 (vendored shadcn — acceptable) |

- **Problem:** Each file mixes routing, data fetching, form state, validation, drag-drop, dialogs, table rendering, i18n, and business rules. Cyclomatic complexity in each is well above sane thresholds. `customers.tsx` alone imports 26 icons and holds 28 `useState/useEffect` hooks.
- **Fix:** split each into `route.tsx` (route boilerplate only) + `<Page>` + `components/` + `hooks/` + `api.ts` under `src/features/<domain>/`. Target ≤300 LOC per file.

### 1.3 [HIGH] Feature organisation
- `src/components/` contains only `notifications`, `organization`, `search`, and `ui`. Everything else is inlined into route files.
- No `src/features/`, no `src/domain/`, no barrel exports.
- **Fix:** adopt feature-sliced or standard `features/<name>/{api,ui,hooks,types}` layout.

### 1.4 [MEDIUM] Duplication
- Bilingual name pickers repeated ~10 times: `pickLangValue(x as any, "name", lang).value || x.name` — appears in `hr.tsx`, `customers.tsx`, `settings.organization.tsx`, `index.tsx`. Extract `useLocalizedName()`.
- `deptName` / `jobName` helpers built inline everywhere they are needed.
- Fetch-then-map-then-setState pattern re-implemented in every route.

### 1.5 [MEDIUM] Dependency direction
- `hooks/useAccess.ts` reaches directly into Supabase. Fine, but it also duplicates access logic that also exists in `settings.tsx` (SettingsLayout re-fetches roles/permissions itself instead of reusing `useAccess`). Two sources of truth for permissions ⇒ drift guaranteed.

### 1.6 [LOW] Dead code / redirects
- `src/routes/_authenticated/admin.customer-fields.tsx` is a 7-line redirect stub — harmless but should be deleted after all inbound links are audited.

### 1.7 [MEDIUM] SOLID violations
- **SRP:** every route file violates it (see 1.2).
- **OCP:** adding a new field type in the form-builder requires editing at least 6 switch/if branches across the same file.
- **DIP:** UI depends on the concrete Supabase client, not an abstraction.

### 1.8 [LOW] Anti-patterns present
- Fetch in `useEffect` with `setState` (React 18/19 SSR anti-pattern; TanStack Query is already installed and unused).
- "God hook" `useAccess` doing 5 RPC + 1 select in a single effect with `cancelled` flag — no request dedupe.
- Manual localStorage reads inside `useState` initialisers with `typeof window` guards → hydration mismatch risk (`route.tsx:29`, `index.tsx:108`, `i18n.tsx:210`, `GlobalSearch.tsx:92`).

---

## 2. TYPESCRIPT

`tsconfig` has `strict: true`, `noUnusedLocals: false`, `noUnusedParameters: false`. Strict mode is neutralised by the volume of casts below.

### 2.1 [HIGH] Rampant `as any` / `as unknown as`
Non-exhaustive list from grep (excluding auto-generated `routeTree.gen.ts` which is fine):

| File | Line(s) | Cast |
| --- | --- | --- |
| `src/components/notifications/NotificationBell.tsx` | 40 | `(window as any).AudioContext` — use `webkitAudioContext` typing shim |
| `src/components/organization/OrgChart.tsx` | 33, 112, 137 | double casts through `unknown` to squeeze XY-Flow node data types |
| `src/components/organization/OrgChartImage.tsx` | 99 | `(dept as any).icon` |
| `src/routes/_authenticated/customers.tsx` | 285, 402, 413, 1241, 1294 | `as any`, `as unknown as Contact/Bank` on typed rows |
| `src/routes/_authenticated/hr.tsx` | 125, 126, 260, 460, 472, 614, 628–631, 707, 725, 727, 733–736 | 16 casts, all avoidable with a `LocalizedRow` helper type |
| `src/routes/_authenticated/settings.organization.tsx` | 97, 116, 131, 235, 243, 244, 686, 873, 875, 885, 895, 901, 908, 912 | includes `payload: any`, `metadata: {} as any`, `catch (e: any)` |
| `src/routes/_authenticated/workflows.tsx` | 135, 201 | `(row: any)`, `(a as any).position` |
| `src/routes/_authenticated/settings.form-builder.tsx` | 946 | `rules as unknown as Json` — could import correct `Json` union directly |
| `src/lib/semantic-search.functions.ts` | 44, 177 | `vec as unknown as string` — comment claims serialisation; wrap in a helper with a documented type |

**Fix:** define real interfaces (`Customer`, `Department`, `JobTitle`, `Contact`, `Bank`, `WorkflowStage`) in `src/features/*/types.ts` derived from `Database` in `types.ts`. Ban `as any` in eslint.

### 2.2 [HIGH] `catch (e: any)`
- `settings.organization.tsx:235` — masks error typing. Use `catch (e) { const msg = e instanceof Error ? e.message : String(e) }`.

### 2.3 [MEDIUM] Missing return types
- No function in the audited routes declares a return type. Under strict mode inference works, but public API functions (server functions, hooks like `useAccess`, exported utils in `lib/`) should declare explicit return types for contract stability.

### 2.4 [MEDIUM] `noUnusedLocals` / `noUnusedParameters` disabled
- `tsconfig.json` disables both — hides real dead code.
- **Fix:** re-enable, then fix; ESLint's unused-vars is also `off` in `eslint.config.js` (line 30) so nothing is catching this.

### 2.5 [LOW] `Json` casts
- `settings.form-builder.tsx:946` casts through `unknown` to `Json` — Supabase's generated `Json` type is available; the cast is a code smell, not a bug.

---

## 3. REACT

### 3.1 [CRITICAL] TanStack Query is installed but almost unused
- 45 `useEffect` fetch patterns vs **5** occurrences of `useQuery`/`useMutation`/`queryClient` in the whole repo.
- The template's `router.tsx` sets `defaultPreloadStaleTime: 0` and the docs state the canonical shape is `ensureQueryData` in loaders + `useSuspenseQuery` in components. This is skipped entirely.
- **Failure mode:** double network requests on every route change, no caching between routes, no refetch-on-focus, no dedupe. Users on slow connections see loading spinners for data they already loaded 5 seconds ago.
- **Fix:** for every list/detail view convert to:
  ```ts
  const customersQO = queryOptions({
    queryKey: ["customers", filters],
    queryFn: () => listCustomers(filters),
  });
  ```
  Use in `loader: ({ context }) => context.queryClient.ensureQueryData(customersQO)` and `useSuspenseQuery(customersQO)`.

### 3.2 [HIGH] `useEffect` with async fetch + `cancelled` flag everywhere
- `useAccess.ts:20-67`, `settings.tsx:44-58`, `hr.tsx`, `customers.tsx`, etc.
- Correct in mechanics but wrong tool. Race conditions on rapid prop changes are still possible when the effect depends on inputs — `useAccess` runs once, but `settings.tsx`'s effect has `[]` deps and re-fetches on every mount.

### 3.3 [HIGH] Missing memoisation
- `customers.tsx:285` recomputes `displayName` per render for every row (used in `map`). Wrap in `useMemo`, or push into a selector.
- Deep list re-renders: giant customer table has no `React.memo` on row components; every keystroke in the search box re-renders the entire list.

### 3.4 [HIGH] Missing error boundaries / not-found on routes
- Only `__root.tsx` might set them; the individual auth-protected routes (`customers`, `hr`, etc.) do not declare `errorComponent`, `notFoundComponent`, or `pendingComponent`. Per the project's own `tanstack-errors-notfound` guidance this is required, not optional.

### 3.5 [MEDIUM] Missing keys / bad keys
- Not systematically audited but the `settings.form-builder.tsx` at ~800 lines maps drag-drop items; verify keys are stable IDs, not array indices. `hr.tsx:260/460/707` uses `d.id` — good.

### 3.6 [HIGH] `useState` initialisers reading `localStorage`
- `src/routes/_authenticated/route.tsx:29` — reads `localStorage` in `useState` initialiser. Under SSR this executes in Node, throwing or returning a wrong value. The `typeof window` guard fixes the crash but the server render will render one state and the client will hydrate another → hydration mismatch warning + flash.
- Same in `i18n.tsx:210`, `index.tsx:108`, `GlobalSearch.tsx:92`.
- **Fix:** initialise with default, sync from `localStorage` inside `useEffect`, and gate render behind a `useHydrated()` hook where flicker matters.

### 3.7 [MEDIUM] Context / re-render scope
- `i18n.tsx` looks fine, but every consumer that only needs `lang` will re-render when `dir` changes because the provider value is not memoised (needs verification, but memoising `{ lang, dir, setLang }` via `useMemo` is standard).

### 3.8 [LOW] Suspense / lazy
- No `React.lazy` splits. Route-level splitting via TanStack Router is automatic, but 1.8k-LOC route files defeat the point.

### 3.9 [MEDIUM] Cleanup / memory leaks
- `NotificationBell` creates an `AudioContext` (line 40) but never closes it on unmount.
- Real-time Supabase subscriptions: unclear whether any exist; search for `.subscribe(` returned 0. If features like notifications rely on polling instead of realtime, document it.

---

## 4. SUPABASE

### 4.1 [HIGH] 10 `SECURITY DEFINER` functions callable by `anon` / `authenticated`
Reported by `supabase--linter` (WARN 2–10, 20 findings total). These functions run as the definer role and bypass RLS by design — leaving `EXECUTE` open to `anon` is a common privilege-escalation vector.
- **Functions to audit:** `has_role`, `has_permission`, `is_admin_or_owner`, `is_owner`, `has_any_user`, `current_user_status`, `current_profile_locked_fields`, `is_workflow_stage_approver`, `is_template_owner`, `is_workflow_approver`, `find_customer_by_tax_id`, `notify_admins_*`.
- **Fix:** `REVOKE EXECUTE ... FROM anon;` for anything only used by RLS policies (they run as `postgres`, no grant needed). Keep `EXECUTE` for `authenticated` only where clients actually call them via `.rpc()`.

### 4.2 [MEDIUM] `pgvector` installed in `public` schema (linter WARN 1)
- **Fix:** move to `extensions` schema per Supabase best practice.

### 4.3 [HIGH] Client-side role checks
- `useAccess.ts` fetches `user_roles` directly and computes `isAdmin`/`isOwner` in the browser. Any authenticated user can query `user_roles` for themselves — fine — but the UI trusts this for gating destructive actions. **Real enforcement must be RLS**, which appears present, but never rely on `useAccess` for authorisation, only for UX visibility. Document this explicitly.

### 4.4 [HIGH] N+1 patterns
- `hr.tsx` computes `deptName` / `jobName` by scanning arrays for each row (lines 125–126). OK because both arrays are pre-fetched, but the pattern of "fetch everything, filter in JS" is used throughout — it breaks the moment tables exceed a few hundred rows.
- `global_search` RPC uses `ILIKE '%...%'` on 4 tables; with growth this is a sequential scan. Add `pg_trgm` GIN indexes on the searched columns (`customers.name`, `customers.name_ar`, `customers.name_en`, `quotes.supplier_name`, `profiles.full_name`).

### 4.5 [MEDIUM] No pagination on list queries
- `customers.tsx` loads all customers. `hr.tsx` loads all profiles/departments/job-titles. Add `.range()` + server-side search or virtualisation.

### 4.6 [LOW] `supabaseAdmin` usage
- Correctly gated to `.server.ts` files. Good.

### 4.7 [MEDIUM] `search_path` in some SECURITY DEFINER funcs
- Most functions set `search_path = public`. Verify every SECURITY DEFINER function in the DB does — the linter flags this separately when missing.

---

## 5. DATABASE / MIGRATIONS

31 migrations in `supabase/migrations/`. Chronology is dense (11 on 2026-07-11 alone). Full per-migration review would exceed this document, but recurring findings:

### 5.1 [HIGH] Migration hygiene
- 31 migrations in ~24 hours suggests many corrective patches. Squash before shipping.
- Verify every `CREATE TABLE public.*` has matching `GRANT` statements per the project's own rule (`public-schema-grants`). Any missing GRANT leaves the table inaccessible via PostgREST.

### 5.2 [MEDIUM] Missing indexes
- Foreign keys on `customer_contacts.customer_id`, `customer_banks.customer_id`, `customer_attachments.customer_id`, `quote_approvals.quote_id`, `workflow_stages.template_id`, `workflow_stage_approvers.stage_id` MUST have btree indexes; without them every parent delete/update scans the child table.
- `profiles.department_id`, `profiles.job_title_id`, `profiles.manager_id` — same.
- **Fix:** add `CREATE INDEX IF NOT EXISTS ... ON public.<child>(<fk>);` for every FK column.

### 5.3 [MEDIUM] Cascade rules
- Confirm `ON DELETE` behaviour on every FK. Deleting a `department` while `profiles.department_id` references it should either restrict (safer) or set null; silent cascade could nuke user assignments.

### 5.4 [LOW] Naming inconsistencies
- Tables mix `_id` (correct) with occasional non-standard columns; verify all timestamp columns are `created_at` / `updated_at` and that `updated_at` triggers exist where mutations happen.

### 5.5 [LOW] Duplicate/legacy tables
- `customer_field_definitions`, `customer_field_options`, `customer_field_values` alongside `org_field_templates` — is the "form builder" migrating from the customer-specific tables to the org-wide one? If yes, mark the old tables deprecated in a comment and plan a data migration.

---

## 6. SECURITY

### 6.1 [HIGH] `anon` execute on privileged RPCs
- See 4.1. Revoke.

### 6.2 [MEDIUM] Client-side session storage
- Supabase JS default is `localStorage` (see `client.ts`). Acceptable for SPA but vulnerable to XSS token theft. Given the project uses SSR (TanStack Start), consider `@supabase/ssr` with httpOnly cookies for hardened deployments.

### 6.3 [HIGH] `dangerouslySetInnerHTML`
- `src/components/ui/chart.tsx:73` — vendored shadcn chart injects a `<style>` string. Values come from a `ChartConfig` prop the developer controls, not user input. **Not exploitable today**, but if any dashboard ever renders user-provided colour tokens it becomes an XSS vector. Sanitise or CSP-restrict.

### 6.4 [MEDIUM] No CSP / security headers
- No `Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy` configured for the Worker responses. Add via a request middleware in `src/start.ts`.

### 6.5 [LOW] Hardcoded credentials
- Only publishable (anon) Supabase keys in `.env`. Correct.

### 6.6 [MEDIUM] CSRF
- Server functions rely on bearer tokens (JWT in `Authorization`). Not cookie-based → CSRF surface small. But `api/public/*` routes (webhooks) must verify signatures — none exist yet, so noted for the future.

### 6.7 [MEDIUM] Rate limiting
- None. Add on `global_search` and any AI-gateway calls.

---

## 7. PERFORMANCE

### 7.1 [HIGH] No query caching → refetch storms
- See 3.1.

### 7.2 [HIGH] Large single-chunk routes
- `customers.tsx` at 1,873 LOC (with 26 icons and 26 supabase call sites) will bloat the route chunk. Split components, tree-shake icons via `lucide-react/icons/<name>` imports (single-icon paths).

### 7.3 [MEDIUM] Unmemoised heavy computations
- `hr.tsx`'s org-tree recursion runs on every render. Memoise with `useMemo([departments])`.
- `orgLayout.ts` (dagre) — layout must be memoised per node/edge signature.

### 7.4 [MEDIUM] Full-table `select *` implied by unqualified `.select("*")`
- Grep every `.from(...).select(` and enumerate the columns you actually need. Reduces payload.

### 7.5 [LOW] `html-to-image` in `OrgChartImage`
- Heavy dependency; ensure it's lazy-loaded only when the export button is clicked.

---

## 8. UI/UX

### 8.1 [MEDIUM] Forms & validation
- Zod is a dep but the form-builder route validates manually. Standardise on `react-hook-form` + `zodResolver` for every form.

### 8.2 [HIGH] Accessibility
- Auto-focus on dialog open is now implemented (from prior turns) — good.
- Verify every icon-only button has an `aria-label` (spot-check needed on `hr.tsx`, `customers.tsx` action columns).
- Colour contrast in RTL mode not audited.

### 8.3 [MEDIUM] Loading / empty / error states
- Many routes just render `null` or `[]` while loading. Add skeletons and empty-state components (a shared `<EmptyState/>` in `components/ui`).

### 8.4 [LOW] Keyboard navigation
- Custom drag-drop in form-builder — check keyboard-accessible via `@dnd-kit`'s `KeyboardSensor` (should be default).

### 8.5 [MEDIUM] Responsive
- Prior fix made the form-builder card footer responsive. Do the same audit for `customers.tsx` table columns and `settings.organization.tsx` tree.

---

## 9. CODE QUALITY

### 9.1 [HIGH] File length
- See 1.2. Any file >300 LOC is a code smell; >1000 is a defect.

### 9.2 [MEDIUM] Magic strings
- Route paths, storage keys (`"cs.sidebar.pinned"`, `"dashboard.kpi.order.v1"`, `"search.ai.enabled"`, `"lang"`), permission keys (`"manage_form_fields"`, `"users.manage_roles"`, `"quotes.approve"`) are stringly-typed everywhere. Centralise into `src/config/keys.ts` and `src/config/permissions.ts` as const unions.

### 9.3 [MEDIUM] Comments
- Some files are heavily commented (good), others (giant routes) have zero JSDoc. Inconsistent.

### 9.4 [MEDIUM] Cyclomatic complexity
- Not measured, but any function >50 lines in the big routes will fail a reasonable threshold. Extract.

---

## 10. BUGS (potential)

### 10.1 [HIGH] Hydration mismatch on language / theme / sidebar-pinned
- `useState(() => localStorage.getItem(...))` under SSR renders default on server, real value on client → mismatch. See 3.6.

### 10.2 [MEDIUM] `useAccess` "cancelled" race
- If `useAccess` unmounts mid-`Promise.all`, `setAccess` is guarded. But `useEffect` runs on mount only (`[]` deps); if auth state changes (login/logout) the hook won't refresh. Add a `supabase.auth.onAuthStateChange` subscription and refetch.

### 10.3 [MEDIUM] Timezone
- All date rendering uses `date-fns` default (browser locale). For an Arabic app with global users, be explicit about timezone (`Africa/Cairo`?). Verify quotes' approval dates aren't off-by-one.

### 10.4 [MEDIUM] Optimistic updates absent
- Every mutation is followed by a full refetch. On slow connections the UI feels laggy. Wrap in TanStack Query mutations with `onMutate`/`onError` rollback.

### 10.5 [LOW] `AudioContext` created without user gesture
- `NotificationBell.tsx:40` — Chrome will suspend it. Guard by creating on the first click/gesture.

### 10.6 [MEDIUM] `handle_new_user_role` grants OWNER to whoever registers first
- Migration function `handle_new_user_role` (see DB functions) assigns `owner` to the first row in `user_roles`. If ever seeded via edge function first, a real user could become admin unexpectedly. Verify seeding order.

---

## 11. DEPENDENCIES

### 11.1 [MEDIUM] Version drift risk
- `react ^19.2.0`, `react-day-picker ^9`, `zod ^3.24` — all current, but confirm `recharts ^2.15` and `react` 19 compatibility (recharts historically lags on major React releases).

### 11.2 [LOW] Unused (suspected)
- `nitro` in devDependencies — TanStack Start bundles its own runtime; verify it's actually needed.
- `input-otp`, `vaul`, `embla-carousel-react`, `react-resizable-panels`, `cmdk` — verify each has a consumer. `cmdk` is used by shadcn `command.tsx` (ok). Audit the rest.

### 11.3 [MEDIUM] Missing scripts
- No `test`, no `typecheck`, no `format:check`. Add:
  ```json
  "typecheck": "tsc --noEmit",
  "test": "vitest",
  "test:e2e": "playwright test"
  ```

### 11.4 [LOW] `bun` vs `npm`
- `bunfig.toml` present. Ensure `packageManager` field is set in `package.json` so CI uses the same toolchain.

---

## 12. BUILD / CONFIG

### 12.1 [HIGH] ESLint neutered
- `eslint.config.js:30`: `"@typescript-eslint/no-unused-vars": "off"` — combined with `tsconfig`'s `noUnusedLocals: false`, dead code accumulates freely. Re-enable.

### 12.2 [MEDIUM] No CI
- No `.github/workflows/` visible in the file listing. Add a workflow running `bun install && bun run lint && bun run typecheck && bun run build`.

### 12.3 [MEDIUM] `tsconfig` `strict: true` — good; but soften below with disabled unused-vars. See 2.4.

### 12.4 [LOW] `prettier` present, no CI enforcement.

### 12.5 [LOW] Nothing in `.env.example` for local onboarding.

---

## 13. FILE-BY-FILE HIGHLIGHTS

### `src/routes/_authenticated/customers.tsx` (1,873 LOC)
- Split into `pages/customers/List`, `Detail`, `AttachmentsPanel`, `ContactsPanel`, `BanksPanel`.
- Move Supabase reads to a `customers.api.ts`.
- Replace 5 `as any` casts with real `Customer` type.
- Add pagination.

### `src/routes/_authenticated/settings.form-builder.tsx` (1,348 LOC)
- Extract `FieldTypeSelector`, `OptionsEditor`, `RegexHelperPopover`, `ReferenceFieldConfig`.
- Move `handleSave` (contains 946-line `rules as unknown as Json`) into a typed API function.
- Wrap field CRUD in TanStack Query mutations.

### `src/routes/_authenticated/settings.organization.tsx` (1,111 LOC)
- Most `as any` in the codebase — 14 of them here. This file needs the most attention.
- Split department editor and job-title editor into separate components/routes.

### `src/routes/_authenticated/index.tsx` (876 LOC)
- Dashboard with `localStorage` KPI order → hydration risk.
- Split KPI cards into a `<KpiCard/>` and a `useKpiOrder()` hook that returns null until hydrated.

### `src/routes/_authenticated/hr.tsx` (747 LOC)
- 16 `as any` casts around `pickLangValue`. Fix once with a helper.
- Two duplicate department lookup functions.

### `src/hooks/useAccess.ts`
- Refetch on auth change (see 10.2). Consider making it a `useQuery(['access', userId])` so multiple consumers share the cache.

### `src/routes/__root.tsx`
- Ensure `<title>` and meta are set to real app-specific values, not the template defaults. Ensure `<Outlet />` is present.

### `src/components/ui/*`
- Vendored shadcn — leave alone unless bugs surface. Only exception: `chart.tsx:73` `dangerouslySetInnerHTML` — see 6.3.

### `src/lib/semantic-search.functions.ts`
- Server function returns `embedding: d.embedding as unknown as string`. Wrap in a helper `pgvectorFromArray()` with an explicit `Vector` branded type.

### `src/server.ts`, `src/start.ts`
- Clean, follow the docs. Good.

### `src/integrations/supabase/*`
- Auto-generated; do not edit. Good.

### `src/routeTree.gen.ts`
- Auto-generated; `as any` casts here are fine.

---

## 14. TOP 10 THINGS TO FIX FIRST

1. **Introduce a data layer** (`src/features/<domain>/api.ts`) and migrate all `supabase.from(...)` calls out of components.
2. **Adopt TanStack Query** for every read + mutation. Delete `useEffect(fetch)` patterns.
3. **Split the four God route files** (>700 LOC).
4. **Revoke `EXECUTE` on privileged SECURITY DEFINER functions from `anon`.**
5. **Add DB indexes** on every FK column and every `ILIKE` search target.
6. **Add `errorComponent` + `notFoundComponent` + `pendingComponent`** to every route.
7. **Kill `as any`** — add a real `LocalizedRow` type + `useLocalizedName()` hook.
8. **Fix hydration** on `localStorage`-backed state (language, sidebar, KPI order, AI-search toggle).
9. **Re-enable `no-unused-vars`** in ESLint and `noUnusedLocals` in tsconfig; clean up fallout.
10. **Add CI** (`lint`, `typecheck`, `build`) + `test` script scaffolding.

---

## 15. WHAT'S GOOD (credit where due)

- Clean Supabase client architecture (browser / server / admin split via `.server.ts`).
- Bilingual (AR/EN) infrastructure with RTL is well thought-out (`i18n.tsx`, `bilingual.tsx`).
- Auth-middleware pattern (`requireSupabaseAuth`) and server-function conventions are correct.
- RLS is present on 25 tables — most projects at this stage don't bother.
- Router directory structure follows TanStack Start conventions correctly.
- Prior iterations already fixed responsive card footers, auto-focus on dialogs, auto-generated option values, and hid system fields — good ergonomic instincts.

---

**End of audit.** Each finding above is fixable in isolation; work top-down through §14. Total refactor effort: ~2–3 focused sprints for one senior engineer, or one sprint with two.
