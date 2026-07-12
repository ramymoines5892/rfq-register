
-- 1) Owner helper
CREATE OR REPLACE FUNCTION public.is_owner(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role = 'owner'
  )
$$;

-- 2) Apply the soft-delete pattern to all listed tables
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'customer_field_definitions',
    'customer_field_options',
    'customers',
    'customer_contacts',
    'customer_banks',
    'customer_attachments',
    'quotes',
    'quote_attachments',
    'workflow_templates',
    'workflow_stages',
    'departments',
    'job_titles'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Add columns
    EXECUTE format($f$
      ALTER TABLE public.%I
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS hidden_at  TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS hidden_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL
    $f$, t);

    -- Index for fast active filtering
    EXECUTE format($f$
      CREATE INDEX IF NOT EXISTS %I ON public.%I (deleted_at) WHERE deleted_at IS NULL
    $f$, 'idx_' || t || '_not_deleted', t);

    -- Restrictive: hide deleted from everyone except the owner
    EXECUTE format($f$DROP POLICY IF EXISTS "restrictive_hide_deleted" ON public.%I$f$, t);
    EXECUTE format($f$
      CREATE POLICY "restrictive_hide_deleted"
        ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated
        USING (deleted_at IS NULL OR public.is_owner(auth.uid()))
    $f$, t);

    -- Restrictive: hide "hidden" rows from everyone except admin/owner
    EXECUTE format($f$DROP POLICY IF EXISTS "restrictive_hide_hidden" ON public.%I$f$, t);
    EXECUTE format($f$
      CREATE POLICY "restrictive_hide_hidden"
        ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated
        USING (hidden_at IS NULL OR public.is_admin_or_owner(auth.uid()))
    $f$, t);

    -- Restrictive: only owner can hard-delete
    EXECUTE format($f$DROP POLICY IF EXISTS "restrictive_only_owner_delete" ON public.%I$f$, t);
    EXECUTE format($f$
      CREATE POLICY "restrictive_only_owner_delete"
        ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated
        USING (public.is_owner(auth.uid()))
    $f$, t);

    -- Restrictive: cannot update a soft-deleted row (except owner restoring it)
    EXECUTE format($f$DROP POLICY IF EXISTS "restrictive_no_update_deleted" ON public.%I$f$, t);
    EXECUTE format($f$
      CREATE POLICY "restrictive_no_update_deleted"
        ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated
        USING (deleted_at IS NULL OR public.is_owner(auth.uid()))
    $f$, t);
  END LOOP;
END $$;
