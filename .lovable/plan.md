# End-to-End System Scenarios, Audit & Cohesion Pass

Goal: walk through the ERP the way a real user would, from first launch to daily operations, find weak points, and fix them so every module is connected, consistent, and effortless to use.

## Scenarios to Test

1. **First launch (empty system)**
   - `/` with no company → `/setup` wizard (Company → Advanced → Documents → Numbering) → auto sign-out → sign-in → dashboard.
   - Verify: draft persistence, logo delete, doc tiles, numbering uniqueness, no way to skip to app before setup.

2. **First admin / owner**
   - Sign-up → auto owner role → dashboard tiles unlock progressively.
   - Verify: `handle_new_user`, `handle_new_user_role`, UI prefs seeded.

3. **Building the org**
   - Branches → Managements → Departments → Job Titles → Employees → link Employee to Auth User.
   - Verify: `/organization` tabs order (Branches → Depts & Jobs → Employees), deep-link `?tab=`, org chart renders, icons per dept.

4. **Roles & permissions**
   - Create custom role → attach permissions → assign to dept / job / branch / user.
   - Open `/hr` → user drawer → change dept → **must not throw** (just fixed `current_profile_locked_fields`) → view effective perms with source badges → diff dialog before save.
   - Verify audit log entries in `permission_audit_log` + `custom_roles` audit.

5. **Pending user approval**
   - New sign-up lands on `/pending` → admin sees join request in `/hr` → approve → user gets `member` role and lands on dashboard.

6. **Warehouses & inventory**
   - Warehouses → Bins → Opening balances → Transfers (draft → in_transit → completed) → Adjustments (draft → pending → approved → posted).
   - Verify approval matrix routing, movement history, CSV export.

7. **Partners → Quotes → Approvals**
   - Create supplier + customer → quote with workflow template → approver decides → email log → docs tab shows the quote.

8. **Bilingual + responsive + a11y**
   - Toggle AR/EN, RTL flip, ScriptInput rejects wrong script, mobile/tablet layouts, elegant scrollbar everywhere, Tab key skips buttons (TabFlowManager).

9. **Trash / soft delete / restore** across customers, quotes, workflows, branches, departments, employees.

10. **Global search & notifications** — search from sidebar returns entities across modules; doc-expiry notifications fire for Admin/Owner.

## Weakness Hunt (what I'll actively look for)

- Server functions or RPCs missing `GRANT EXECUTE` (like today's `current_profile_locked_fields`).
- Tables in `public` without GRANTs for `authenticated` / `service_role`.
- Routes that call protected server fns from a public loader.
- Broken links / dead sidebar entries after the `features` → `modules` reorg.
- Duplicated concepts (e.g. Settings > Organization vs `/organization`) and stale sub-routes.
- Places still hardcoded that should read from Feature Flags / Company settings.
- Screens missing responsive treatment or custom scrollbars.
- Query cache invalidation gaps after mutations (stale lists after create/edit/delete).
- Missing `errorComponent` / `notFoundComponent` on routes with loaders.

## Deliverables

- `AUDIT_SCENARIOS.md`: each scenario, expected flow, observed result, verdict (PASS / FAIL / IMPROVE), and the exact fix applied.
- Code fixes applied in the same turn for every FAIL and every quick IMPROVE (permissions, grants, cache invalidations, broken links, responsive gaps, unified navigation).
- A short "Recommended UX simplifications" section for larger changes that need your approval before I rewrite flows (e.g. merging Settings-Organization into `/organization` for good, collapsing overlapping HR/Roles screens, first-run wizard order changes).
- Playwright smoke run across the key routes to confirm nothing regressed.

## Technical Notes

- Use `supabase--read_query` + `supabase--linter` to sweep for missing grants, RLS gaps, SECURITY DEFINER exposure.
- Use `acp_subagent--explore` in parallel for: (a) route/loader audit, (b) RPC/grant audit, (c) query-invalidation audit.
- Drive Playwright headless against `http://localhost:8080` with the injected Supabase session to reproduce each scenario and capture screenshots into `/tmp/browser/scenarios/`.
- Fix categories, not instances: when one RPC lacks EXECUTE, sweep all SECURITY DEFINER functions; when one list doesn't refresh, sweep sibling mutations.

## Out of Scope (will flag, not build)

- New modules (Sales orders, Purchase orders, Finance) — brief only mentions them; I won't scaffold without your go-ahead.
- Redesigning the dashboard widgets beyond wiring fixes.
- Data migrations that would destroy existing rows.

Reply "go" to run the full pass, or tell me which scenarios to prioritise first (e.g. "start with 1–4").
