-- ============================================================
-- Organization Structure v2 — Step 1: schema only
-- ============================================================

-- New permissions ('org.manage','org.view') will be added in a follow-up migration
-- because Postgres cannot use freshly-added enum values inside the same transaction.
-- Until then, org policies gate writes on is_admin_or_owner + hr.manage.

-- Enums for org units and assignments
DO $$ BEGIN
  CREATE TYPE public.org_unit_status AS ENUM
    ('planning','draft','active','inactive','merged','closed','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.employee_assignment_type AS ENUM
    ('primary','secondary','temporary','project');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 1) Enterprises (forward-looking, optional)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.enterprises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_ar text,
  name_en text,
  code text UNIQUE,
  description text,
  logo_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.enterprises TO authenticated;
GRANT ALL ON public.enterprises TO service_role;

ALTER TABLE public.enterprises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enterprises_read_authenticated" ON public.enterprises
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "enterprises_admin_all" ON public.enterprises
  FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

CREATE TRIGGER trg_enterprises_updated_at
  BEFORE UPDATE ON public.enterprises
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Nullable link on companies (no data change, no enforcement)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS enterprise_id uuid REFERENCES public.enterprises(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_companies_enterprise ON public.companies(enterprise_id);

-- ============================================================
-- 2) Org level definitions (per-company configurable catalog)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.org_level_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description text,
  depth integer NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  icon text,
  color text,
  position integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_level_definitions TO authenticated;
GRANT ALL ON public.org_level_definitions TO service_role;

ALTER TABLE public.org_level_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_levels_read_authenticated" ON public.org_level_definitions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "org_levels_manage_admin" ON public.org_level_definitions
  FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

CREATE TRIGGER trg_org_levels_updated_at
  BEFORE UPDATE ON public.org_level_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_org_levels_company ON public.org_level_definitions(company_id, depth);

-- ============================================================
-- 3) Org units (generic tree between Management and Department)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.org_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  management_id uuid REFERENCES public.managements(id) ON DELETE SET NULL,
  parent_unit_id uuid REFERENCES public.org_units(id) ON DELETE SET NULL,
  level_code text NOT NULL,
  code text,
  name text NOT NULL,
  name_ar text,
  name_en text,
  description text,
  manager_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  deputy_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status public.org_unit_status NOT NULL DEFAULT 'active',
  effective_date date,
  end_date date,
  position integer NOT NULL DEFAULT 0,
  color text,
  icon text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid,
  CONSTRAINT org_units_no_self_parent CHECK (parent_unit_id IS NULL OR parent_unit_id <> id),
  CONSTRAINT org_units_effective_window CHECK (end_date IS NULL OR effective_date IS NULL OR end_date >= effective_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_units TO authenticated;
GRANT ALL ON public.org_units TO service_role;

ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_units_read_authenticated" ON public.org_units
  FOR SELECT TO authenticated USING (deleted_at IS NULL OR public.is_admin_or_owner(auth.uid()));

CREATE POLICY "org_units_manage" ON public.org_units
  FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

CREATE TRIGGER trg_org_units_updated_at
  BEFORE UPDATE ON public.org_units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_org_units_company ON public.org_units(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_org_units_parent ON public.org_units(parent_unit_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_org_units_management ON public.org_units(management_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_org_units_branch ON public.org_units(branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_org_units_level ON public.org_units(company_id, level_code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_units_company_code
  ON public.org_units(company_id, level_code, code)
  WHERE code IS NOT NULL AND deleted_at IS NULL;

-- Guard against circular hierarchies
CREATE OR REPLACE FUNCTION public.check_org_unit_hierarchy()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE _cur uuid; _depth int := 0;
BEGIN
  IF NEW.parent_unit_id IS NULL THEN RETURN NEW; END IF;
  _cur := NEW.parent_unit_id;
  WHILE _cur IS NOT NULL AND _depth < 50 LOOP
    IF _cur = NEW.id THEN
      RAISE EXCEPTION 'Circular hierarchy detected on org_units'
        USING ERRCODE = '23514';
    END IF;
    SELECT parent_unit_id INTO _cur FROM public.org_units WHERE id = _cur;
    _depth := _depth + 1;
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_org_units_no_cycle
  BEFORE INSERT OR UPDATE OF parent_unit_id ON public.org_units
  FOR EACH ROW EXECUTE FUNCTION public.check_org_unit_hierarchy();

-- ============================================================
-- 4) Employee assignments (multiple assignments per employee)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  assignment_type public.employee_assignment_type NOT NULL DEFAULT 'primary',
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  management_id uuid REFERENCES public.managements(id) ON DELETE SET NULL,
  org_unit_id uuid REFERENCES public.org_units(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  job_title_id uuid REFERENCES public.job_titles(id) ON DELETE SET NULL,
  is_manager boolean NOT NULL DEFAULT false,
  is_deputy boolean NOT NULL DEFAULT false,
  is_acting boolean NOT NULL DEFAULT false,
  allocation_percent integer NOT NULL DEFAULT 100
    CHECK (allocation_percent BETWEEN 0 AND 100),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_assignments_window CHECK (end_date IS NULL OR end_date >= start_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_assignments TO authenticated;
GRANT ALL ON public.employee_assignments TO service_role;

ALTER TABLE public.employee_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_assignments_read_authenticated" ON public.employee_assignments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "employee_assignments_manage_hr" ON public.employee_assignments
  FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid())
      OR public.has_permission(auth.uid(), 'hr.manage'::public.app_permission))
  WITH CHECK (public.is_admin_or_owner(auth.uid())
      OR public.has_permission(auth.uid(), 'hr.manage'::public.app_permission));

CREATE TRIGGER trg_employee_assignments_updated_at
  BEFORE UPDATE ON public.employee_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_emp_assign_employee ON public.employee_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_assign_department ON public.employee_assignments(department_id);
CREATE INDEX IF NOT EXISTS idx_emp_assign_orgunit ON public.employee_assignments(org_unit_id);
CREATE INDEX IF NOT EXISTS idx_emp_assign_branch ON public.employee_assignments(branch_id);

-- Only one active PRIMARY assignment per employee
CREATE UNIQUE INDEX IF NOT EXISTS uq_emp_assign_one_active_primary
  ON public.employee_assignments(employee_id)
  WHERE assignment_type = 'primary' AND end_date IS NULL;

-- ============================================================
-- 5) Backfill: one primary assignment per existing employee
-- ============================================================
INSERT INTO public.employee_assignments
  (employee_id, assignment_type, branch_id, management_id, department_id, job_title_id, start_date)
SELECT
  e.id,
  'primary'::public.employee_assignment_type,
  e.branch_id,
  e.management_id,
  e.department_id,
  e.position_id,
  COALESCE(e.joining_date, CURRENT_DATE)
FROM public.employees e
WHERE e.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.employee_assignments a
    WHERE a.employee_id = e.id AND a.assignment_type = 'primary' AND a.end_date IS NULL
  );

-- ============================================================
-- 6) Seed default level catalog for existing companies
--    (all disabled by default except the two already in use)
-- ============================================================
INSERT INTO public.org_level_definitions
  (company_id, code, name_ar, name_en, depth, is_enabled, is_system, position, icon)
SELECT c.id, v.code, v.name_ar, v.name_en, v.depth, v.enabled, true, v.pos, v.icon
FROM public.companies c
CROSS JOIN (VALUES
  ('management',    'إدارة عامة',       'Management',    10,  true,  1, 'Building2'),
  ('business_unit', 'وحدة أعمال',       'Business Unit', 20,  false, 2, 'Briefcase'),
  ('division',      'قطاع',             'Division',      30,  false, 3, 'Layers'),
  ('section',       'قسم فرعي',         'Section',       40,  false, 4, 'GitBranch'),
  ('team',          'فريق',             'Team',          50,  false, 5, 'Users'),
  ('work_group',    'مجموعة عمل',       'Work Group',    60,  false, 6, 'UserCog'),
  ('department',    'إدارة',            'Department',    100, true,  7, 'FolderTree')
) AS v(code, name_ar, name_en, depth, enabled, pos, icon)
ON CONFLICT (company_id, code) DO NOTHING;