
-- 1. Role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. has_role helper (SECURITY DEFINER, avoids recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('owner', 'admin')
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_owner(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_owner(uuid) TO authenticated, service_role;

-- 4. RLS policies for user_roles
DROP POLICY IF EXISTS "users see their own roles" ON public.user_roles;
CREATE POLICY "users see their own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- 5. Auto-assign role on signup: first user = owner, others = member
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _role public.app_role;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'owner') THEN
    _role := 'owner';
  ELSE
    _role := 'member';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 6. Backfill: existing users get roles. First existing user → owner, rest → member.
INSERT INTO public.user_roles (user_id, role)
SELECT id,
  CASE WHEN row_number() OVER (ORDER BY created_at) = 1 THEN 'owner'::public.app_role
       ELSE 'member'::public.app_role END
FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.users.id)
ON CONFLICT (user_id, role) DO NOTHING;

-- 7. Restrict profiles visibility to team members (users with any role)
DROP POLICY IF EXISTS "profiles readable by team" ON public.profiles;
CREATE POLICY "profiles readable by team" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = profiles.id)
  );

-- 8. Ordering for approvers within a stage
ALTER TABLE public.workflow_stage_approvers
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 1;

-- Backfill position based on insertion order (id sort as fallback)
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY stage_id ORDER BY id) AS rn
  FROM public.workflow_stage_approvers
)
UPDATE public.workflow_stage_approvers a
SET position = r.rn
FROM ranked r WHERE r.id = a.id;
