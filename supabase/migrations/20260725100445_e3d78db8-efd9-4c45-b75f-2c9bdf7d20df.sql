
-- 1) department_permissions
CREATE TABLE public.department_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  permission app_permission NOT NULL,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, permission)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.department_permissions TO authenticated;
GRANT ALL ON public.department_permissions TO service_role;
ALTER TABLE public.department_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read dept perms" ON public.department_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage dept perms" ON public.department_permissions
  FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- 2) job_title_permissions
CREATE TABLE public.job_title_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_title_id uuid NOT NULL REFERENCES public.job_titles(id) ON DELETE CASCADE,
  permission app_permission NOT NULL,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_title_id, permission)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_title_permissions TO authenticated;
GRANT ALL ON public.job_title_permissions TO service_role;
ALTER TABLE public.job_title_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read job perms" ON public.job_title_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage job perms" ON public.job_title_permissions
  FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- 3) drop legacy role system (drop dependencies first)
ALTER TABLE public.approval_matrix DROP CONSTRAINT IF EXISTS approval_matrix_required_role_id_fkey;
ALTER TABLE public.approval_matrix DROP COLUMN IF EXISTS required_role_id;

DROP TABLE IF EXISTS public.employee_roles CASCADE;
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;

-- 4) rewrite has_permission with cascading source: user > job > department
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _perm app_permission)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      WHERE e.user_id = _user_id
        AND e.deleted_at IS NULL
        AND jp.permission = _perm
    )
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      JOIN public.department_permissions dp ON dp.department_id = e.department_id
      WHERE e.user_id = _user_id
        AND e.deleted_at IS NULL
        AND dp.permission = _perm
    )
$$;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, app_permission) TO authenticated;
