-- Scope enum
DO $$ BEGIN
  CREATE TYPE public.role_scope AS ENUM ('department','job_title','branch','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) custom_roles
CREATE TABLE public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  code text,
  name_ar text NOT NULL,
  name_en text,
  description text,
  color text,
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.custom_roles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.custom_roles TO authenticated;
GRANT ALL ON public.custom_roles TO service_role;
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custom_roles read" ON public.custom_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "custom_roles admin write" ON public.custom_roles FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid())) WITH CHECK (public.is_admin_or_owner(auth.uid()));

CREATE TRIGGER trg_custom_roles_updated BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) custom_role_permissions
CREATE TABLE public.custom_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  permission app_permission NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission)
);
GRANT SELECT, INSERT, DELETE ON public.custom_role_permissions TO authenticated;
GRANT ALL ON public.custom_role_permissions TO service_role;
ALTER TABLE public.custom_role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crp read" ON public.custom_role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "crp admin write" ON public.custom_role_permissions FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid())) WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- 3) custom_role_assignments
CREATE TABLE public.custom_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  scope public.role_scope NOT NULL,
  target_id uuid NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_id, scope, target_id)
);
CREATE INDEX idx_cra_scope_target ON public.custom_role_assignments(scope, target_id);
CREATE INDEX idx_cra_role ON public.custom_role_assignments(role_id);
GRANT SELECT, INSERT, DELETE ON public.custom_role_assignments TO authenticated;
GRANT ALL ON public.custom_role_assignments TO service_role;
ALTER TABLE public.custom_role_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cra read" ON public.custom_role_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "cra admin write" ON public.custom_role_assignments FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid())) WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- 4) Extend has_permission to include custom role grants
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _perm app_permission)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    public.is_admin_or_owner(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = _user_id AND permission = _perm
    )
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      JOIN public.job_title_permissions jp ON jp.job_title_id = e.position_id
      WHERE e.user_id = _user_id AND e.deleted_at IS NULL AND jp.permission = _perm
    )
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      JOIN public.department_permissions dp ON dp.department_id = e.department_id
      WHERE e.user_id = _user_id AND e.deleted_at IS NULL AND dp.permission = _perm
    )
    -- Custom roles: user-direct
    OR EXISTS (
      SELECT 1
      FROM public.custom_role_assignments a
      JOIN public.custom_role_permissions rp ON rp.role_id = a.role_id
      WHERE rp.permission = _perm
        AND a.scope = 'user' AND a.target_id = _user_id
    )
    -- Custom roles via department (profiles OR employees)
    OR EXISTS (
      SELECT 1
      FROM public.custom_role_assignments a
      JOIN public.custom_role_permissions rp ON rp.role_id = a.role_id
      LEFT JOIN public.profiles p ON p.id = _user_id
      LEFT JOIN public.employees e ON e.user_id = _user_id AND e.deleted_at IS NULL
      WHERE rp.permission = _perm
        AND a.scope = 'department'
        AND a.target_id IN (COALESCE(p.department_id, e.department_id), p.department_id, e.department_id)
    )
    -- Custom roles via job title (profiles.job_title_id OR employees.position_id)
    OR EXISTS (
      SELECT 1
      FROM public.custom_role_assignments a
      JOIN public.custom_role_permissions rp ON rp.role_id = a.role_id
      LEFT JOIN public.profiles p ON p.id = _user_id
      LEFT JOIN public.employees e ON e.user_id = _user_id AND e.deleted_at IS NULL
      WHERE rp.permission = _perm
        AND a.scope = 'job_title'
        AND a.target_id IN (p.job_title_id, e.position_id)
    )
    -- Custom roles via branch (user_branches)
    OR EXISTS (
      SELECT 1
      FROM public.custom_role_assignments a
      JOIN public.custom_role_permissions rp ON rp.role_id = a.role_id
      JOIN public.user_branches ub ON ub.branch_id = a.target_id AND ub.user_id = _user_id
      WHERE rp.permission = _perm AND a.scope = 'branch'
    )
$function$;