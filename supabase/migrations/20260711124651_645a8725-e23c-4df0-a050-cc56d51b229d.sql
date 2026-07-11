
-- ============ 1) Wipe existing users (cascade removes profiles/user_roles/etc) ============
DELETE FROM auth.users;

-- ============ 2) Extend profiles with status + HR links ============
DO $$ BEGIN
  CREATE TYPE public.profile_status AS ENUM ('pending', 'active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status public.profile_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS department_id uuid,
  ADD COLUMN IF NOT EXISTS job_title_id uuid,
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ============ 3) Departments ============
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- ============ 4) Job titles ============
CREATE TABLE IF NOT EXISTS public.job_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, department_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_titles TO authenticated;
GRANT ALL ON public.job_titles TO service_role;
ALTER TABLE public.job_titles ENABLE ROW LEVEL SECURITY;

-- FKs on profiles (now that tables exist)
DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_department_fk FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_job_title_fk FOREIGN KEY (job_title_id) REFERENCES public.job_titles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ 5) Custom permissions ============
DO $$ BEGIN
  CREATE TYPE public.app_permission AS ENUM (
    'customers.view', 'customers.manage',
    'quotes.view', 'quotes.manage', 'quotes.approve',
    'workflows.view', 'workflows.manage',
    'hr.view', 'hr.manage',
    'team.view', 'team.manage',
    'reports.view'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission public.app_permission NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- ============ 6) Helper functions ============
-- Public function: any user exists?
CREATE OR REPLACE FUNCTION public.has_any_user()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM auth.users) $$;
GRANT EXECUTE ON FUNCTION public.has_any_user() TO anon, authenticated;

-- Current user's status
CREATE OR REPLACE FUNCTION public.current_user_status()
RETURNS public.profile_status
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT status FROM public.profiles WHERE id = auth.uid() $$;
GRANT EXECUTE ON FUNCTION public.current_user_status() TO authenticated;

-- Has permission (owner/admin => true for all; else check user_permissions)
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _perm public.app_permission)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_admin_or_owner(_user_id)
    OR EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = _user_id AND permission = _perm)
$$;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) TO authenticated;

-- ============ 7) Triggers: first user => owner+active; else pending, no role ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _is_first boolean;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO _is_first;
  INSERT INTO public.profiles (id, email, full_name, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NULL),
    CASE WHEN _is_first THEN 'active'::public.profile_status ELSE 'pending'::public.profile_status END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Only the very first user gets a role automatically (owner). All others: no role until approved.
  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure triggers exist on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_departments_updated_at ON public.departments;
CREATE TRIGGER trg_departments_updated_at BEFORE UPDATE ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_job_titles_updated_at ON public.job_titles;
CREATE TRIGGER trg_job_titles_updated_at BEFORE UPDATE ON public.job_titles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ 8) RLS policies ============

-- profiles: drop old admin/owner-visibility if any, recreate cleanly
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "profiles_select_self" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin_or_owner(auth.uid()));
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- prevent self-elevation: cannot change status/department/job/manager on own row
    AND status = (SELECT status FROM public.profiles WHERE id = auth.uid())
    AND department_id IS NOT DISTINCT FROM (SELECT department_id FROM public.profiles WHERE id = auth.uid())
    AND job_title_id IS NOT DISTINCT FROM (SELECT job_title_id FROM public.profiles WHERE id = auth.uid())
    AND manager_id IS NOT DISTINCT FROM (SELECT manager_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- departments
DROP POLICY IF EXISTS "departments_select" ON public.departments;
DROP POLICY IF EXISTS "departments_write_admin" ON public.departments;
CREATE POLICY "departments_select" ON public.departments
  FOR SELECT TO authenticated USING (public.current_user_status() = 'active');
CREATE POLICY "departments_write_admin" ON public.departments
  FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- job_titles
DROP POLICY IF EXISTS "job_titles_select" ON public.job_titles;
DROP POLICY IF EXISTS "job_titles_write_admin" ON public.job_titles;
CREATE POLICY "job_titles_select" ON public.job_titles
  FOR SELECT TO authenticated USING (public.current_user_status() = 'active');
CREATE POLICY "job_titles_write_admin" ON public.job_titles
  FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- user_permissions: user can view their own; admin/owner manage all
DROP POLICY IF EXISTS "user_permissions_select_self" ON public.user_permissions;
DROP POLICY IF EXISTS "user_permissions_select_admin" ON public.user_permissions;
DROP POLICY IF EXISTS "user_permissions_write_admin" ON public.user_permissions;
CREATE POLICY "user_permissions_select_self" ON public.user_permissions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_permissions_select_admin" ON public.user_permissions
  FOR SELECT TO authenticated USING (public.is_admin_or_owner(auth.uid()));
CREATE POLICY "user_permissions_write_admin" ON public.user_permissions
  FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));
