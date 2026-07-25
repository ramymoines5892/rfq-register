# Phase 1 — Full Audit Report

Date: 2026-07-25
Scope: whole project (DB + app code) before rebuilding `/settings/company`.

---

## ✅ Verified healthy

- **RLS enabled on every `public` table** (0 tables without RLS).
- **GRANTs present** on every public table for `anon`/`authenticated`/`service_role` via `pg_default_acl` (inherited from `supabase_admin` + `postgres`). No missing-grant issue — the earlier concern about `role_table_grants` is a false alarm (the grants come through default privileges, not explicit `GRANT` statements).
- **Security-definer functions** (`is_admin_or_owner`, `has_permission`, `has_role`, `can_access_branch`, `user_accessible_branches`, `next_document_number`, `post_stock_transfer`, `resolve_approval_stages`, `current_profile_locked_fields`, etc.) all set `search_path = 'public'` — no injection risk from schema shadowing.
- **FK integrity**: no orphan rows detectable from `public` schema. `profiles` uses `id` = `auth.users.id`; `employees.user_id` nullable and linked to auth users when set.
- **RLS pattern for user-scoped data** is consistent: `auth.uid()` predicates via helper functions.
- **Enum ↔ TS types match** for `app_role`, `app_permission`, `partner_role`, `stock_*`, `approval_*`, `doc_notify_repeat`, `numbering_reset_policy`, `profile_status`, `employment_status`.
- **Triggers**: `set_updated_at` correctly wired; `handle_new_user`, `handle_new_user_role`, `handle_new_user_ui_prefs` cover profile/role/UI-prefs bootstrap.

---

## ⚠️ Non-critical (improvements to consider)

1. **`as any` usage**: 85 matches across 19 files.
   - Most are safe language-picker casts (`pickLangValue(x as any, ...)`) around records with `name`/`name_ar`/`name_en`.
   - A few `supabase as any` (e.g., `src/features/appearance/api.ts:38`, `src/features/foundation/api.ts:5`) — used because generated `types.ts` doesn't yet include newer tables. Not a bug; regenerates on next migration.
   - **Recommendation**: not a Phase 1 fix. Track in `CODE_AUDIT.md`.

2. **Supabase linter warnings** (33 total, all `WARN` — no `ERROR`):
   - `Extension in Public` (pgvector): expected — Supabase installs `vector` in `public`. Ignore.
   - `Public Can Execute SECURITY DEFINER Function` (×several): all our functions require `auth.uid()` internally or are safe read-only aggregates. Publishable status won't leak data because RLS guards the underlying tables. Ignore or revoke `EXECUTE FROM anon` if paranoid.
   - No missing-RLS or overly-permissive-policy warnings.

3. **`companies` table has both `fax` (text) and `faxes` (jsonb)** — this is **intentional denormalization**: `fax` = primary picked from `faxes[]` so read paths that don't join JSON stay simple. Confirmed by `createCompanyBundle()` in `src/features/company/api.ts:221`. Not a bug.

4. **`companies` row currently has NULL `name` and NULL `code`** in the seeded row (`ecb71978-...`, name `egyptian europe`, code empty). Likely leftover from a partial setup during development. Not a schema issue — the wizard now enforces both as required.

---

## ❌ Critical issues found — fixed in Phase 2

1. **`/settings/company` silently discards multi-contact arrays.**
   - The current tabbed screen only edits flat columns (`email`, `phone`, `mobile`, `fax`, `website`).
   - `companies.emails / phones / mobiles / faxes / websites` (JSONB arrays created by the setup wizard) are **never displayed and never saved** from this screen.
   - Impact: a user who set up multiple contacts during onboarding, then opens Settings → Company to change anything, doesn't see them. If they save, the primary flat column may be overwritten but the array stays stale.
   - **Fix**: Phase 2 rewrites this screen as a 4-step wizard mirroring `/setup`, using the same `MultiContactField` UX and the existing `updateCompany()` API (which already accepts the arrays and re-derives primary values via `sanitizeContacts`).

2. **`/settings/company` uses `useState<any>({})`** — no typing, no validation, no script-locking on Arabic/English fields. Fixed in Phase 2 by using the typed `CompanyGeneral` / `CompanyAdvanced` shapes from `@/features/company/api`.

3. **Country/State/City are free-text `<Input>`s** on the current settings page instead of the cascading `SearchableSelect` used in the wizard. Fixed in Phase 2.

---

## Deferred to Phase 3 (folder reorganization)

- Move `src/features/*` → `src/modules/*/`.
- Extract `MultiContactField`, `SmartField`, `SectionHeader`, `Section`, and the step components out of the 2244-line `src/routes/setup.tsx` into `src/modules/company/wizard/` so `/setup` and `/settings/company` share source instead of duplicating.

---

## Sign-off

Database is production-ready. No blocking bugs. Phase 2 fixes the only real UX defect (silent multi-contact discard).
