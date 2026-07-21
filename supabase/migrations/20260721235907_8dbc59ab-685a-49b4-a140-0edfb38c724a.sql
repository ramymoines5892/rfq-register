-- ─────────────────────────────────────────────────────────────
-- 1) Extend branches with geography + business-unit attributes
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS country        text,
  ADD COLUMN IF NOT EXISTS state          text,
  ADD COLUMN IF NOT EXISTS city           text,
  ADD COLUMN IF NOT EXISTS postal_code    text,
  ADD COLUMN IF NOT EXISTS address_line   text,
  ADD COLUMN IF NOT EXISTS phone          text,
  ADD COLUMN IF NOT EXISTS mobile         text,
  ADD COLUMN IF NOT EXISTS fax            text,
  ADD COLUMN IF NOT EXISTS email          text,
  ADD COLUMN IF NOT EXISTS website        text,
  ADD COLUMN IF NOT EXISTS timezone       text,
  ADD COLUMN IF NOT EXISTS base_currency  text,
  ADD COLUMN IF NOT EXISTS manager_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS position       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes          text,
  ADD COLUMN IF NOT EXISTS deleted_at     timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS branches_company_code_uniq
  ON public.branches (company_id, lower(code)) WHERE code IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS branches_company_position_idx
  ON public.branches (company_id, position);

-- ─────────────────────────────────────────────────────────────
-- 2) user_branches: per-user branch scoping (many-to-many)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_branches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id   uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, branch_id)
);

CREATE INDEX IF NOT EXISTS user_branches_user_idx   ON public.user_branches (user_id);
CREATE INDEX IF NOT EXISTS user_branches_branch_idx ON public.user_branches (branch_id);

-- only one default branch per user
CREATE UNIQUE INDEX IF NOT EXISTS user_branches_one_default_per_user
  ON public.user_branches (user_id) WHERE is_default = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_branches TO authenticated;
GRANT ALL ON public.user_branches TO service_role;

ALTER TABLE public.user_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own branch access" ON public.user_branches;
CREATE POLICY "Users read own branch access" ON public.user_branches
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "Admins manage user branch access" ON public.user_branches;
CREATE POLICY "Admins manage user branch access" ON public.user_branches
  FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

CREATE TRIGGER trg_user_branches_updated_at
  BEFORE UPDATE ON public.user_branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 3) Per-branch numbering support
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.company_numbering
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE;

-- Replace the old unique (company_id, doc_type) with a scope-aware pair
ALTER TABLE public.company_numbering
  DROP CONSTRAINT IF EXISTS company_numbering_company_id_doc_type_key;

CREATE UNIQUE INDEX IF NOT EXISTS company_numbering_company_doctype_uniq
  ON public.company_numbering (company_id, doc_type) WHERE branch_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS company_numbering_branch_doctype_uniq
  ON public.company_numbering (company_id, branch_id, doc_type) WHERE branch_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 4) Helper functions for branch access
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_accessible_branches(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Admin/owner sees everything
  SELECT b.id FROM public.branches b
   WHERE b.deleted_at IS NULL
     AND public.is_admin_or_owner(_user_id)
  UNION
  -- Users with explicit assignments see only those branches
  SELECT ub.branch_id FROM public.user_branches ub
   WHERE ub.user_id = _user_id
  UNION
  -- Users with NO assignment fall back to all active branches (safe default)
  SELECT b.id FROM public.branches b
   WHERE b.deleted_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.user_branches u WHERE u.user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.user_default_branch(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT branch_id FROM public.user_branches
      WHERE user_id = _user_id AND is_default = true LIMIT 1),
    (SELECT branch_id FROM public.user_branches
      WHERE user_id = _user_id ORDER BY created_at LIMIT 1),
    (SELECT id FROM public.branches
      WHERE is_head_office = true AND deleted_at IS NULL
      ORDER BY created_at LIMIT 1),
    (SELECT id FROM public.branches
      WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_branch(_user_id uuid, _branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_accessible_branches(_user_id) b WHERE b = _branch_id)
$$;

GRANT EXECUTE ON FUNCTION public.user_accessible_branches(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_default_branch(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_branch(uuid, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5) Tighten branches SELECT policy to respect user scoping
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated view branches" ON public.branches;
CREATE POLICY "Users view accessible branches" ON public.branches
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND id IN (SELECT public.user_accessible_branches(auth.uid()))
  );