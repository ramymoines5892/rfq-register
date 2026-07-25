# Organization Structure v2 — Flexible Hierarchy

Based on your answers:
- **Enterprise:** prepare the field but keep it optional (single company today, multi later)
- **Levels between Branch and Employee:** fully configurable per company, not hardcoded
- **Multiple Assignments:** required now
- **Cost Centers:** deferred to the Finance phase
- **Managements:** kept as-is (stays a first-class layer)

## Core idea

Instead of hardcoding 9 fixed levels (Business Unit, Division, Section, Team, Work Group), we introduce a **generic `org_units` table** whose depth is defined by a **company-configurable level catalog**. The admin decides how many layers exist and what each is called (AR/EN).

```text
Company
  └─ Branch
       └─ Management                     (kept, layer #1)
            └─ [any custom layers]       (Division / Section / Team ... optional)
                 └─ Department           (kept, terminal business unit)
                      └─ Job Title
                           └─ Employee (via assignments)
```

Existing `managements`, `departments`, `job_titles`, `employees` tables stay untouched. New layers slot **between Management and Department** as needed, driven by a per-company config.

## New database objects

### 1. `org_level_definitions` (company-scoped catalog)
Defines which levels exist and their order. Seeded with defaults but fully editable.

| field | purpose |
|---|---|
| company_id | scoping |
| code | stable key (e.g. `business_unit`, `division`, `section`, `team`) |
| name_ar / name_en | display |
| depth | integer ordering (Management=10, Division=20, Section=30, Team=40, Department=100) |
| is_enabled | toggle on/off per company |
| icon, color | UI |

### 2. `org_units` (generic node table)
Holds every unit that isn't a Company/Branch/Department (which keep their dedicated tables).

| field | purpose |
|---|---|
| company_id, branch_id | scope |
| level_code | FK to `org_level_definitions.code` |
| parent_unit_id | self-reference (nullable) |
| parent_management_id | when directly under a Management |
| code, name_ar, name_en, description | identity |
| manager_employee_id, deputy_employee_id | leadership |
| status | planning / draft / active / inactive / merged / closed / archived |
| effective_date, end_date | version window |
| position, metadata | ordering + extensibility |

### 3. `employee_assignments` (multiple assignments)
Replaces the single `employees.department_id + position_id` binding with a proper N:N model. The columns on `employees` are **kept for backward compatibility** and treated as "primary assignment" mirror.

| field | purpose |
|---|---|
| employee_id | who |
| assignment_type | `primary` / `secondary` / `temporary` / `project` |
| branch_id, management_id, org_unit_id, department_id, job_title_id | where (any combination) |
| is_manager, is_deputy, is_acting | leadership flags |
| allocation_percent | for split time (default 100) |
| start_date, end_date | validity window |
| notes |  |

Constraint: exactly one active `primary` assignment per employee at any moment.

### 4. `enterprises` (forward-looking, optional)
Minimal table (id, name, code). `companies.enterprise_id` becomes a nullable FK. Nothing enforced yet — activates when you add company #2.

### 5. Audit
All org units feed the existing `audit_logs` table via a shared trigger, capturing create / update / move / merge / split / close / manager change.

## RLS & Permissions

- Read: everyone in the same company sees the tree.
- Write: gated by a new `org.manage` permission (assignable through the existing Roles engine).
- Multiple-assignment writes: `hr.manage`.
- Never edit history rows; changes create new versions when `effective_date` differs.

## Frontend impact

**`/organization` page** gets a third-level tree between Managements and Departments:
- New "Structure Levels" tab under Settings → Organization to enable/rename/reorder custom levels.
- Tree view supports drag-to-reparent, showing only enabled levels.
- Department/Employee forms show a **dynamic breadcrumb picker** that adapts to enabled levels — if a company disables Division & Section, they simply don't appear in the picker.

**Employee editor** gains an "Assignments" tab with a list of active/historical assignments, primary flag, allocation %, and manager/deputy toggles.

**Permissions matrix, Approvals, Workflows** continue to reference Department + Job Title (unchanged). Custom layers are for **reporting and grouping only**, not for permission scope — matches your principle of keeping structure independent from authority.

## Migration strategy (safe rollout)

1. **Migration A — Schema only:** add tables, indexes, RLS, GRANTs. Zero data change. Nothing breaks.
2. **Backfill script:** copy each employee's current `department_id + position_id` into `employee_assignments` as `primary`. Idempotent.
3. **Migration B — Level catalog seeding:** insert default `org_level_definitions` rows per existing company, all `is_enabled = false` except Management & Department. Admin opts in per level when needed.
4. **UI phase 1:** Assignments tab + Structure Levels settings page.
5. **UI phase 2:** dynamic tree in `/organization` + breadcrumb picker.
6. **UI phase 3:** reports (Employee Distribution, Vacant Positions, Manager Report).

Each phase ships independently; you can stop after any of them and the app stays consistent.

## What we are explicitly NOT doing now

- Enterprise-level rollups, cross-company shared users, shared policies (deferred until company #2 exists).
- Cost Centers, Revenue/Profit/Investment centers (deferred to Finance module).
- Multiple parallel hierarchies (admin + functional + project) — single tree for now; project assignments handled through `employee_assignments.assignment_type='project'` instead.
- GPS/floor/building location fields — deferred, current address fields are enough.

## Deliverables of the first step

If you approve, I start with **Migration A + backfill only** (no UI). You review the schema, then we build the UI in the next turns. This keeps risk minimal and lets you sanity-check the shape before any screen depends on it.

Reply "approve step 1" and I'll issue the migration, or tell me what to adjust first.