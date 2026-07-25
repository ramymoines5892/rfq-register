# End-to-End Scenario Audit & Fixes

Date: 2026-07-25
Scope: full walk-through of the ERP from first launch through daily operations, hunting for weak points, broken links, stale caches, and RLS/grant gaps.

## Summary

- **Fixed in this pass**: 6 concrete issues (5 code, 1 database).
- **Verified healthy**: routing/sidebar (33 routes, zero dead links), table grants (all `public` tables correctly granted to `authenticated` + `service_role`), most mutations (60+/65 correctly invalidate query keys).
- **Recommended follow-ups**: 3 UX simplifications listed at the end — need your call before I rewrite them.

---

## Scenarios

### 1. First launch (empty system) — **PASS**
Flow: `/` → `_authenticated/route.tsx:beforeLoad` calls `has_any_company` RPC → no company → `redirect('/setup')` → 4-step wizard → auto sign-out → sign-in → dashboard. Draft persistence in `localStorage`, immediate upload of files to `_drafts/`, doc tiles, numbering uniqueness — all working. No way to skip past setup.

### 2. First admin / owner — **PASS**
`handle_new_user`, `handle_new_user_role`, `handle_new_user_ui_prefs` triggers fire on sign-up. UI prefs seed row exists. `is_admin_or_owner` grant already in place from earlier fix.

### 3. Building the org — **PASS**
`/organization` tabs Branches → Depts & Jobs → Employees, deep-link `?tab=` via `parseOrgTab`, shared config in `src/modules/organization/tabs.ts`, `/settings/organization` is intentional redirect shim (`<Navigate to="/organization">`). Org chart renders with per-dept icons.

### 4. Roles & permissions — **FAIL → FIXED**
- **Bug (found today)**: `current_profile_locked_fields` was not executable by `authenticated`; department picker in `/hr` drawer threw. Grant applied earlier this session.
- **Same class swept**: 5 more SECURITY DEFINER helpers used by RLS policies were missing EXECUTE for `authenticated`. Grants added in this pass:
  - `find_customer_by_tax_id` — duplicate-detection in Partners/Customers
  - `is_template_owner`, `is_workflow_approver`, `is_workflow_stage_approver` — workflow RLS policies
  - `can_manage_workflow_stage_approvers` — stage-approver UI
- **Cache gap fixed**: `useGrantPermission` / `useRevokePermission` in `src/modules/hr/queries.ts` only invalidated the per-user key. Now also invalidates `["perms","effective",userId]`, `["perms","audit"]`, and `["hr"]` so the Permissions module and audit tabs refresh in sync.

### 5. Pending user approval — **PASS**
`/pending` route exists, admin sees requests in `/hr` "Join Requests" tab, approve triggers `member` role via existing mutations.

### 6. Warehouses & inventory — **IMPROVE → FIXED**
- **Cache gap fixed**: `useCancelTransfer` in `src/modules/transfers/api.ts` didn't invalidate the transfer's detail cache. Now invalidates both `qk.transfers.all` and `qk.transfers.detail(id)` so the detail view reflects the cancelled status immediately.
- Adjustments flow (draft → pending → approved → posted) correctly invalidates `adjustments`, `approvals`, and `inventory`.

### 7. Partners → Quotes → Approvals — **PASS**
Workflow templates, stages, approvers all properly invalidate scoped keys.

### 8. Bilingual + responsive + a11y — **PASS**
Elegant scrollbar is global in `src/styles.css`. `ScriptInput` enforces AR/EN. `TabFlowManager` skips buttons. Responsive rules documented in `mem://design/ui-baseline`.

### 9. Trash / soft delete / restore — **FAIL → FIXED**
- **Cache gap fixed**: `useRestoreRow` in `src/modules/trash/queries.ts` only invalidated `qk.trash.list(tableKey)`. Restoring a customer/branch/employee/department did NOT invalidate the origin module's list, so users had to hard-refresh to see the restored row. Now maps every `tableKey` → its origin module's query key(s) (customers, quotes, partners, branches, warehouses, bins, products, departments, job_titles, employees, workflows, and their sub-tables).

### 10. Global search & notifications — **IMPROVE → FIXED**
- **Cache gap fixed**: `useSaveNotificationPrefs` had no `invalidateQueries` and no `onError` rollback — if a server trigger normalized the row, cache silently diverged. Added both.
- **Soft correctness fix**: `useReorderDepartments` used `onSettled` (fires on error too, masking failures). Switched to `onSuccess` with an explicit `onError` resync so a failed drag surfaces the error and refetches to reset optimistic UI.

---

## Route/loader audit (from subagent sweep)

- 33 route files. **Zero use TanStack `loader`** — all data fetching happens in components via TanStack Query hooks. Auth gating lives entirely in `src/routes/_authenticated/route.tsx:beforeLoad` (checks session + `has_any_company` + profile status). This is safe because `requireSupabaseAuth` is never invoked from a loader (only two server fns use it: `semantic-search.functions.ts` and `send-quote-email.functions.ts`, both from user-initiated component code).
- **Only `__root.tsx` defines `errorComponent`/`notFoundComponent`.** Everything bubbles to root. Acceptable, but a per-subtree boundary on `_authenticated/route.tsx` would give protected-area errors a nicer recovery UX. Flagged, not fixed — needs your OK.
- **No dead sidebar links.** All `to:` targets in `_authenticated/route.tsx` resolve. `soon: true` placeholders (Sales/Purchase orders, invoices, suppliers) are intentional stubs.
- `documents.tsx` and `admin.customer-fields.tsx` exist but have no sidebar entry — reachable only by direct URL. Flag: intentional or oversight?

---

## Mutation audit (from subagent sweep)

- **65 mutations reviewed across `src/modules/*`.** Overwhelmingly consistent: nearly every one calls `qc.invalidateQueries` with the correct scoped key.
- **5 gaps found and fixed** (all listed above under their scenarios).
- **Accepted patterns**: `useMarkNotificationRead` / `useMarkAllNotificationsRead` use optimistic-only patching with no rollback — acceptable for low-stakes, per-user read flags.

---

## Database audit

- All `public` tables have correct `GRANT` to `authenticated` and `service_role`. Zero missing grants.
- SECURITY DEFINER function grants: 6 helpers were missing EXECUTE for `authenticated` (5 fixed in this pass + `current_profile_locked_fields` earlier this session). None remain.
- Supabase linter WARNs: 42 items, all noise from expected SECURITY DEFINER helpers backing our RLS design (`has_role`, `has_permission`, `is_admin_or_owner`, etc.). These are intentional — the alternative would be recursive RLS.

---

## Recommended UX simplifications (need your call before I ship)

1. **Delete `settings.organization.tsx` outright.** It's a redirect-only shim to `/organization`. Cleaner to point old links directly at `/organization?tab=…` and drop the extra route entry from `routeTree.gen.ts`. Zero user-visible change.

2. **Add `errorComponent` to `_authenticated/route.tsx`.** Right now, an RLS error inside any protected page bubbles all the way to the root boundary and blanks the whole shell (sidebar + header + content). A subtree boundary would keep the shell mounted and only replace the page area with a friendly retry.

3. **Sidebar-surface `documents.tsx` and `admin.customer-fields.tsx`**, or remove them if superseded. Both are functional but currently deep-link only.

Say the word ("do 1", "do all 3", "skip") and I'll ship.

---

## Files changed this pass

| File | Change |
|---|---|
| DB migration | GRANT EXECUTE on 5 SECURITY DEFINER helpers to `authenticated` |
| `src/modules/trash/queries.ts` | Restore now invalidates origin-module query keys |
| `src/modules/hr/queries.ts` | Grant/Revoke user permission invalidates effective-perms + audit + hr caches |
| `src/modules/transfers/api.ts` | Cancel transfer invalidates detail cache |
| `src/modules/notifications/queries.ts` | Save prefs invalidates + rolls back on error |
| `src/modules/organization/queries.ts` | Reorder depts uses `onSuccess` + `onError` resync |
