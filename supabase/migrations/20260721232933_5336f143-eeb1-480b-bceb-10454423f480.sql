
-- =========================================================================
-- Phase 1: Organization Structure
-- =========================================================================

-- 1) MANAGEMENTS -----------------------------------------------------------
CREATE TABLE public.managements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_ar text,
  name_en text,
  code text,
  description text,
  director_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  color text,
  icon text,
  position integer NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_managements_company ON public.managements(company_id);
CREATE INDEX idx_managements_not_deleted ON public.managements(deleted_at) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.managements TO authenticated;
GRANT ALL ON public.managements TO service_role;

ALTER TABLE public.managements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managements_select" ON public.managements FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND current_user_status() = 'active'::public.profile_status);
CREATE POLICY "managements_admin_write" ON public.managements FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

CREATE TRIGGER trg_managements_updated_at BEFORE UPDATE ON public.managements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) DEPARTMENTS: link to management ---------------------------------------
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS management_id uuid REFERENCES public.managements(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_departments_management ON public.departments(management_id);

-- 3) EMPLOYEES -------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.employment_status AS ENUM ('active','on_leave','suspended','terminated','probation');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_code text,
  full_name text NOT NULL,
  full_name_ar text,
  full_name_en text,
  national_id text,
  passport_no text,
  phone text,
  email text,
  joining_date date,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  management_id uuid REFERENCES public.managements(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  position_id uuid REFERENCES public.job_titles(id) ON DELETE SET NULL,
  direct_manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  employment_status public.employment_status NOT NULL DEFAULT 'active',
  photo_url text,
  signature_url text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, employee_code)
);
CREATE UNIQUE INDEX idx_employees_user ON public.employees(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_employees_company ON public.employees(company_id);
CREATE INDEX idx_employees_branch ON public.employees(branch_id);
CREATE INDEX idx_employees_management ON public.employees(management_id);
CREATE INDEX idx_employees_department ON public.employees(department_id);
CREATE INDEX idx_employees_manager ON public.employees(direct_manager_id);
CREATE INDEX idx_employees_not_deleted ON public.employees(deleted_at) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_select_active" ON public.employees FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (
    public.is_admin_or_owner(auth.uid())
    OR user_id = auth.uid()
    OR current_user_status() = 'active'::public.profile_status
  ));
CREATE POLICY "employees_admin_write" ON public.employees FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) ROLES -----------------------------------------------------------------
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_ar text,
  name_en text,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_roles_company ON public.roles(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_select" ON public.roles FOR SELECT TO authenticated
  USING (current_user_status() = 'active'::public.profile_status);
CREATE POLICY "roles_admin_write" ON public.roles FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) ROLE_PERMISSIONS ------------------------------------------------------
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission public.app_permission NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission)
);
CREATE INDEX idx_role_permissions_role ON public.role_permissions(role_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_permissions_select" ON public.role_permissions FOR SELECT TO authenticated
  USING (current_user_status() = 'active'::public.profile_status);
CREATE POLICY "role_permissions_admin_write" ON public.role_permissions FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- 6) EMPLOYEE_ROLES --------------------------------------------------------
CREATE TABLE public.employee_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, role_id)
);
CREATE INDEX idx_employee_roles_employee ON public.employee_roles(employee_id);
CREATE INDEX idx_employee_roles_role ON public.employee_roles(role_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_roles TO authenticated;
GRANT ALL ON public.employee_roles TO service_role;

ALTER TABLE public.employee_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_roles_select" ON public.employee_roles FOR SELECT TO authenticated
  USING (current_user_status() = 'active'::public.profile_status);
CREATE POLICY "employee_roles_admin_write" ON public.employee_roles FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- 7) has_permission(): extend to include role-based permissions ------------
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _perm public.app_permission)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_admin_or_owner(_user_id)
    OR EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = _user_id AND permission = _perm)
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      JOIN public.employee_roles er ON er.employee_id = e.id
      JOIN public.role_permissions rp ON rp.role_id = er.role_id
      WHERE e.user_id = _user_id
        AND e.deleted_at IS NULL
        AND rp.permission = _perm
    )
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) TO authenticated;

-- 8) SEED DEFAULT ROLES (system, per-company null = global template) ------
INSERT INTO public.roles (name, name_ar, name_en, description, is_system) VALUES
  ('System Administrator', 'مسؤول النظام', 'System Administrator', 'Full system access', true),
  ('General Manager', 'المدير العام', 'General Manager', 'Executive access across all modules', true),
  ('Procurement Manager', 'مدير المشتريات', 'Procurement Manager', 'Manages procurement operations', true),
  ('Purchasing Engineer', 'مهندس مشتريات', 'Purchasing Engineer', 'Handles RFQs and purchase orders', true),
  ('Warehouse Manager', 'مدير المخازن', 'Warehouse Manager', 'Manages warehouse operations', true),
  ('Store Keeper', 'أمين مخزن', 'Store Keeper', 'Handles inventory operations', true),
  ('Sales Manager', 'مدير المبيعات', 'Sales Manager', 'Manages sales operations', true),
  ('Sales Engineer', 'مهندس مبيعات', 'Sales Engineer', 'Handles customer quotes and sales', true),
  ('Finance Manager', 'المدير المالي', 'Finance Manager', 'Manages financial operations', true),
  ('Accountant', 'محاسب', 'Accountant', 'Handles accounting transactions', true),
  ('Viewer', 'مشاهد', 'Viewer', 'Read-only access', true)
ON CONFLICT DO NOTHING;

-- Assign default permissions to seeded roles
WITH r AS (SELECT id, name FROM public.roles WHERE is_system = true AND company_id IS NULL)
INSERT INTO public.role_permissions (role_id, permission)
SELECT r.id, p::public.app_permission
FROM r
CROSS JOIN LATERAL (
  SELECT unnest(CASE r.name
    WHEN 'System Administrator' THEN ARRAY[
      'customers.view','customers.manage','customers.create','customers.edit','customers.delete','customers.view_payment_info',
      'quotes.view','quotes.manage','quotes.approve','quotes.view_all','quotes.create','quotes.edit','quotes.delete','quotes.assign',
      'workflows.view','workflows.manage','hr.view','hr.manage','team.view','team.manage','reports.view',
      'users.manage_roles','templates.manage','notifications.view','manage_customer_fields','manage_form_fields'
    ]
    WHEN 'General Manager' THEN ARRAY[
      'customers.view','customers.view_payment_info','quotes.view_all','quotes.approve',
      'workflows.view','hr.view','team.view','reports.view','notifications.view'
    ]
    WHEN 'Procurement Manager' THEN ARRAY[
      'customers.view','quotes.view_all','quotes.approve','quotes.assign','workflows.view','workflows.manage','reports.view','notifications.view'
    ]
    WHEN 'Purchasing Engineer' THEN ARRAY[
      'customers.view','quotes.view_own','quotes.view_team','quotes.create','quotes.edit','workflows.view','notifications.view'
    ]
    WHEN 'Warehouse Manager' THEN ARRAY['workflows.view','workflows.manage','reports.view','notifications.view']
    WHEN 'Store Keeper' THEN ARRAY['workflows.view','notifications.view']
    WHEN 'Sales Manager' THEN ARRAY[
      'customers.view','customers.manage','customers.create','customers.edit','customers.view_payment_info',
      'quotes.view_all','quotes.create','quotes.edit','quotes.approve','quotes.assign','reports.view','notifications.view'
    ]
    WHEN 'Sales Engineer' THEN ARRAY[
      'customers.view','customers.create','customers.edit','quotes.view_own','quotes.create','quotes.edit','notifications.view'
    ]
    WHEN 'Finance Manager' THEN ARRAY[
      'customers.view','customers.view_payment_info','quotes.view_all','quotes.approve','reports.view','notifications.view'
    ]
    WHEN 'Accountant' THEN ARRAY['customers.view','customers.view_payment_info','quotes.view_all','reports.view','notifications.view']
    WHEN 'Viewer' THEN ARRAY['customers.view','quotes.view_own','workflows.view','team.view','reports.view','notifications.view']
    ELSE ARRAY[]::text[]
  END) AS p
) p
ON CONFLICT DO NOTHING;
