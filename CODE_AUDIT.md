# CODE_AUDIT — Full-Project Review

_Generated: 2026-07-22_
_Scope: entire repository (`src/`, `supabase/migrations/`), 49 route files, 22 feature modules, 33 SQL migrations._
_Purpose: brutally honest architecture / correctness / security / performance review, with concrete remediation._

Legend: **[C]** critical · **[H]** high · **[M]** medium · **[L]** low · **[✓]** already fixed in this pass.

---

## 0. Executive summary

The project is well past “CRUD app”: real feature-based data layer, TanStack Query throughout, RLS on every public table, bilingual UX, dynamic form builder, approvals, inventory postings via RPCs, semantic search — this is enterprise territory. The biggest structural risks now are **fan-out queries in `usePartnerRelated`**, **client-side pagination on unbounded lists**, **`as any` scattered across schema-touching code**, and **inconsistent error surfaces** (some places still throw stringy errors that surface as raw `Failed` toasts). Nothing is on fire, but each of these becomes a production incident at N=10k rows or when a new module inherits the same patterns.

This audit ships alongside:
- pure utils extracted from `partners.tsx` DocsPanel → `src/features/partners/docs-utils.ts`
- pure utils extracted from `GlobalSearch` → `src/features/search/page-filter.ts`
- **38 passing unit tests** covering filter × sort × totals × pagination × range validation × access-gated page filtering
- edge-case handling in DocsPanel: invalid date range banner, disappearing-status fallback, `pageEnd` clamp

---

## 1. Relations & data model

### 1.1 Business Partners graph — **[H]** N+1 fan-out risk
`usePartnerRelated(partner)` (see `src/features/partners/queries.ts`) reads three domains (quotes, customers, stock_movements) sequentially per partner. On a partner with heavy history this is 3 round-trips before any render.
**Remediation**: expose a SQL view `v_partner_related` or an RPC `partner_related(_partner_id uuid, _limit int)` returning a unified row shape (`kind, id, title, subtitle, status, date, amount, currency, link`) with a `LIMIT`. Client keeps the same TypeScript shape (`RelatedDoc` — now formalised in `docs-utils.ts`).

### 1.2 Foreign-key sanity — **[M]**
Spot-checked FKs against tables list:
- `stock_transfer_lines` → `stock_transfers` ✓
- `partner_contacts/addresses/banks` → `business_partners` ✓
- `user_roles` (auth-only) ✓ and correctly read via `has_role` security-definer
- `quote_approvals` → `quotes` + `workflow_stages` ✓
- **Gap**: `notifications` has no FK-based cleanup for deleted actors — verify a `ON DELETE SET NULL` on `actor_user_id` and equivalent columns; otherwise removing a user leaves dangling ids that break UI joins.

### 1.3 Soft-delete consistency — **[M]**
`branches` uses “soft-delete + transfer”. Verify every downstream fetcher (`useBranches`, sidebar branch selector, warehouse editor) filters `deleted_at IS NULL` in the same place. A single unfiltered read reintroduces ghost rows. Recommend a `v_active_branches` view and route reads through it.

### 1.4 Approval matrix — **[L]**
`approval_matrix` (16 cols) + `workflow_stage_approvers` + `workflow_stages` + `workflow_templates` is powerful but under-documented. Add a short markdown in `src/features/workflows/README.md` explaining the resolution order (matrix → stage approvers → template), because the code path today is only obvious after reading three files.

---

## 2. Pagination & search performance

### 2.1 DocsPanel pagination — **[✓]**
Previously reimplemented ad-hoc; now delegates to `paginate()` with clamped page/size and stable `pageEnd`. Covers: last-page remainder, over-large page numbers, `pageSize=0/NaN`, empty rows. Tested.

### 2.2 Partners list pagination — **[H]** missing
`usePartners(role, search)` returns **the entire filtered set** into `filtered.map(...)`. At ~500 partners this becomes a visible jank on tab switching; at 5k it locks the main thread. The DocsPanel pattern (sort/paginate/totals) should be lifted into a shared `usePagedList` hook or reused directly for the partner grid.

### 2.3 Global search — **[M]**
`GlobalSearchTrigger` debounces at 180ms and caps at 6 hits per entity — fine. Two issues:
1. The `search_history` insert on every navigation is fire-and-forget with no error boundary; a failing RLS returns a rejected promise that appears in the console. Wrap in `.catch(() => {})`.
2. The Popover result list has no keyboard nav (arrow keys / enter). Users have to click. Low effort to add with `cmdk`.

### 2.4 Filter combinations — **[✓]**
Invalid date range (`from > to`) previously silently returned an empty list. Now surfaced with an inline destructive banner + tested (`isValidRange`, `filterDocs` invalid-range case).

### 2.5 Semantic search — **[M]**
`semanticSearch` server function runs an embedding + pgvector query. Confirm the underlying index is `ivfflat` with a reasonable `lists=100` and analyzed after seed. Also confirm the RPC exposes a hard `LIMIT` server-side (defensive against a caller passing `limit: 10000`).

---

## 3. RLS / data dependencies

### 3.1 GRANT hygiene — **[L]**
Table list shows every public table has policies (`profiles` 7, `customer_field_definitions` 6, etc.). Spot audit of recent migrations passed. Watch-out: `search_embeddings` has **only 1 policy** — verify it’s an authenticated-only SELECT with a tenant/company filter, otherwise semantic search leaks titles across companies.

### 3.2 `has_role` / `has_permission` pattern — **[✓]**
Correct SECURITY DEFINER + `SET search_path = public` usage confirmed. Do NOT let anyone add a `WHERE` against `user_roles` from a client-side query — always route through the security-definer helper (already the convention).

### 3.3 Role → permission resolution — **[M]**
Permissions flow: `employees → job_titles(role_ids) + user_roles → role_permissions`. There is no test covering “user with two roles gets the union of permissions and does not get denied by a stricter role.” Add a Postgres regression using pgTAP or a lightweight `SELECT public.has_permission(...)` matrix in a migration comment.

### 3.4 Company-scoped isolation — **[H]**
Almost every table has a `company_id`. Confirm every SELECT policy references `company_id = public.current_company_id()` (or equivalent). Any policy that uses only `auth.uid()` on a company-scoped table leaks rows to users who happen to be in a different company but authenticated. Search suggestion:

```
rg "USING \(auth\.uid\(\)" supabase/migrations | rg -v company_id
```

Every hit is a candidate leak.

### 3.5 `service_role` misuse — **[L]**
No `supabaseAdmin` usage detected in client-reachable modules. Good. Keep it that way — the audit tag would be `import.*client\.server` outside `*.server.ts`.

---

## 4. Type safety & correctness

### 4.1 `as any` proliferation — **[H]**
`rg "as any" src | wc -l` returns ~40+. Concentrated in:
- `partners.tsx` label maps (`{...} as any` — harmless but replaceable with a typed `Record`)
- `useUpsert*` hooks generic escape hatches
- `supabase.rpc("global_search", ...) as Hit[]`

Prefer `Database["public"]["Functions"]["global_search"]["Returns"]` from the generated types. Each `as any` is a place where a schema drift will not fail at compile time.

### 4.2 Null vs `""` — **[M]**
Several `defaultValue={x ?? ""}` + `onBlur → upsert({ field: e.target.value })` patterns overwrite `null` with empty string. That is not the same value for uniqueness constraints or reporting. Prefer `e.target.value.trim() || null` before mutation.

### 4.3 Optimistic updates — **[M]**
Optimistic writes assume mutation success; the queries do not consistently roll back on error (`onError` handler absent in most `useMutation`s in `src/features/*/queries.ts`). Add a `onMutate → snapshot → onError → rollback → onSettled → invalidate` pattern once in a helper and reuse.

---

## 5. UX / accessibility

### 5.1 Native prompts — **[✓]**
All confirmed removed for the partners flow. Verified via `rg "confirm\(|window\.confirm|window\.prompt" src` — zero hits inside `src/routes/**` and `src/features/**`. `useConfirm` + `usePrompt` are the single entry points.

### 5.2 Bilingual coverage — **[L]**
Every string in `DocsPanel` and `GlobalSearchTrigger` audited manually. All AR/EN branches present. Recommend a `pnpm run i18n:missing` script that greps `ar ? .. : ..` and warns when only one side is filled — cheap to add.

### 5.3 Keyboard flow — **[M]**
`TabFlowManager` skips buttons — great for form nav, but breaks discoverability of the primary action. Consider a `data-tabflow-include` opt-in on the “Save”/“Next” button of every wizard step.

### 5.4 RTL / mirroring — **[L]**
`me-1`, `ms-2`, `start-2` classes are correct. Icons like `«` / `»` in pagination are locale-neutral characters — good.

---

## 6. State / caching

### 6.1 `router.invalidate()` after auth — **[✓]**
Root wires `onAuthStateChange` filtered to identity events per guidance — no thrash.

### 6.2 Query keys — **[M]**
Some feature modules use ad-hoc keys (`["partner", id]`) while others include role/search (`["partners", role, search]`). Adopt a `partnersKeys` factory (à la React Query best practice) per feature to make invalidation surgical.

### 6.3 `search:v1` localStorage keys — **[L]**
Multiple `localStorage` keys exist (`partners:savedFilters:v1`, `search.ai.enabled`, drafts). Central `LS_KEYS` const would prevent typos and make deletion trivial when a user asks to “reset my preferences”.

---

## 7. Server functions & edge

- ✓ No `supabase/functions/*` new edge functions — TanStack `createServerFn` used correctly.
- ✓ No admin client leakage into client bundles.
- **[L]** `semanticSearch` should be under `_authenticated/` gate for the calling route, or the middleware should attach the bearer explicitly — verified via `requireSupabaseAuth`, OK.

---

## 8. Build, lint, tests

- Build: passes (harness).
- Lint: no new violations from this pass.
- **Tests: 38 passing** across 2 files (was 0). Coverage today = the two riskiest pure-logic paths (partners docs list + global search page filter). Extend next to: `validatePartner`, `requiredFieldsFor`, inventory `post_stock_transfer` boundary math (JS-side), CSV export/import round-trip.

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

(Left as recommendation to avoid touching build tooling in this pass.)

---

## 9. Prioritized backlog

| # | Item | Sev | Effort |
|---|---|---|---|
| 1 | Consolidate `usePartnerRelated` into a single RPC/view | H | M |
| 2 | Paginate `usePartners` grid (reuse `paginate()`) | H | S |
| 3 | Audit `USING (auth.uid()` policies missing `company_id` | H | M |
| 4 | Type-safety pass to remove top-level `as any` in queries | H | M |
| 5 | Central mutation error/rollback helper | M | S |
| 6 | Query-key factories per feature | M | S |
| 7 | Keyboard nav in `GlobalSearchTrigger` popover | M | S |
| 8 | Empty-string vs null normalization on blur-save inputs | M | S |
| 9 | Notifications FK cleanup on user delete | M | S |
| 10 | i18n missing-branch grep script | L | S |

---

## 10. What this pass changed

- `src/features/partners/docs-utils.ts` — pure filter/sort/totals/paginate + range validator.
- `src/features/search/page-filter.ts` — pure access-gated page filter.
- `src/features/partners/docs-utils.test.ts` — 29 tests.
- `src/features/search/page-filter.test.ts` — 9 tests.
- `vitest.config.ts` + `vitest.setup.ts` — jsdom + testing-library setup.
- `src/routes/_authenticated/partners.tsx` — DocsPanel now consumes the pure utils, shows an invalid-range banner, resets a stale status filter automatically, uses `pageEnd` from `paginate()` for the “Showing X–Y” copy.

All changes are additive; no behavior regressed. Every added unit is under test.
