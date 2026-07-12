-- 1) Revoke EXECUTE on privileged SECURITY DEFINER helpers from anon/authenticated.
--    These are used only inside RLS policies / other SECURITY DEFINER funcs,
--    where they run as the function owner regardless of grants.
DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.has_role(uuid, app_role)',
    'public.has_permission(uuid, app_permission)',
    'public.is_admin_or_owner(uuid)',
    'public.is_owner(uuid)',
    'public.has_any_user()',
    'public.current_user_status()',
    'public.current_profile_locked_fields()',
    'public.is_workflow_stage_approver(uuid, uuid)',
    'public.is_template_owner(uuid, uuid)',
    'public.is_workflow_approver(uuid, uuid)',
    'public.can_manage_workflow_stage_approvers(uuid, uuid)',
    'public.find_customer_by_tax_id(text)'
  ]
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', fn);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'skip: %', fn;
    END;
  END LOOP;
END$$;

-- 2) Missing FK indexes (safe, idempotent). Only creates when both table+column exist.
DO $$
DECLARE
  r record;
  idxname text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('customer_contacts',      'customer_id'),
      ('customer_banks',         'customer_id'),
      ('customer_attachments',   'customer_id'),
      ('customer_field_values',  'customer_id'),
      ('customer_field_values',  'field_id'),
      ('customer_field_options', 'field_id'),
      ('quote_approvals',        'quote_id'),
      ('quote_approvals',        'approver_id'),
      ('quote_attachments',      'quote_id'),
      ('quote_email_log',        'quote_id'),
      ('quotes',                 'customer_id'),
      ('workflow_stages',        'template_id'),
      ('workflow_stage_approvers','stage_id'),
      ('workflow_stage_approvers','approver_id'),
      ('profiles',               'department_id'),
      ('profiles',               'job_title_id'),
      ('profiles',               'manager_id'),
      ('notifications',          'user_id'),
      ('user_permissions',       'user_id'),
      ('user_roles',             'user_id'),
      ('audit_logs',             'user_id')
    ) AS t(tbl, col)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=r.tbl AND column_name=r.col
    ) THEN
      idxname := format('idx_%s_%s', r.tbl, r.col);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(%I)', idxname, r.tbl, r.col);
    END IF;
  END LOOP;
END$$;

-- 3) Trigram indexes for the columns used by public.global_search ILIKE '%q%' scans.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
DECLARE
  r record;
  idxname text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('customers','name'),
      ('customers','name_ar'),
      ('customers','name_en'),
      ('customers','email'),
      ('customers','phone'),
      ('customers','tax_id'),
      ('quotes','supplier_name'),
      ('quotes','reference_no'),
      ('quotes','description'),
      ('workflow_templates','name'),
      ('profiles','full_name'),
      ('profiles','email')
    ) AS t(tbl, col)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=r.tbl AND column_name=r.col
    ) THEN
      idxname := format('idx_%s_%s_trgm', r.tbl, r.col);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I USING gin (%I gin_trgm_ops)', idxname, r.tbl, r.col);
    END IF;
  END LOOP;
END$$;
