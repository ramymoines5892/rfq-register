
-- ========= 1) FISCAL YEARS =========
CREATE TABLE public.fiscal_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_closed boolean NOT NULL DEFAULT false,
  is_current boolean NOT NULL DEFAULT false,
  closed_at timestamptz,
  closed_by uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fiscal_years_dates_chk CHECK (end_date > start_date),
  CONSTRAINT fiscal_years_company_name_uniq UNIQUE (company_id, name)
);
CREATE INDEX fiscal_years_company_idx ON public.fiscal_years(company_id);
CREATE UNIQUE INDEX fiscal_years_one_current_per_company
  ON public.fiscal_years(company_id) WHERE is_current;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_years TO authenticated;
GRANT ALL ON public.fiscal_years TO service_role;
ALTER TABLE public.fiscal_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view fiscal years"
  ON public.fiscal_years FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage fiscal years insert"
  ON public.fiscal_years FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_owner(auth.uid()));
CREATE POLICY "Admins manage fiscal years update"
  ON public.fiscal_years FOR UPDATE TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));
CREATE POLICY "Admins manage fiscal years delete"
  ON public.fiscal_years FOR DELETE TO authenticated
  USING (public.is_admin_or_owner(auth.uid()));

CREATE TRIGGER trg_fiscal_years_updated_at
  BEFORE UPDATE ON public.fiscal_years
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========= 2) EXTEND company_numbering =========
DO $$ BEGIN
  CREATE TYPE public.numbering_reset_policy AS ENUM ('never', 'yearly', 'monthly', 'daily');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.company_numbering
  ADD COLUMN IF NOT EXISTS reset_policy public.numbering_reset_policy NOT NULL DEFAULT 'yearly',
  ADD COLUMN IF NOT EXISTS format_template text NOT NULL DEFAULT '{prefix}-{year}-{seq}',
  ADD COLUMN IF NOT EXISTS last_reset_period text,
  ADD COLUMN IF NOT EXISTS label_ar text,
  ADD COLUMN IF NOT EXISTS label_en text;

-- Atomic sequence generator honoring reset policy
CREATE OR REPLACE FUNCTION public.next_document_number(
  _company_id uuid,
  _doc_type text,
  _branch_id uuid DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.company_numbering;
  _period text;
  _seq bigint;
  _formatted text;
BEGIN
  IF _branch_id IS NULL THEN
    SELECT * INTO _row FROM public.company_numbering
      WHERE company_id = _company_id AND doc_type = _doc_type AND branch_id IS NULL
      FOR UPDATE;
  ELSE
    SELECT * INTO _row FROM public.company_numbering
      WHERE company_id = _company_id AND doc_type = _doc_type AND branch_id = _branch_id
      FOR UPDATE;
  END IF;
  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'No numbering series for doc_type=%', _doc_type;
  END IF;

  _period := CASE _row.reset_policy
    WHEN 'yearly'  THEN to_char(now(), 'YYYY')
    WHEN 'monthly' THEN to_char(now(), 'YYYY-MM')
    WHEN 'daily'   THEN to_char(now(), 'YYYY-MM-DD')
    ELSE 'ALL' END;

  IF _row.reset_policy <> 'never' AND (_row.last_reset_period IS DISTINCT FROM _period) THEN
    _seq := 1;
    UPDATE public.company_numbering
      SET next_seq = 2, last_reset_period = _period, updated_at = now()
      WHERE id = _row.id;
  ELSE
    _seq := _row.next_seq;
    UPDATE public.company_numbering
      SET next_seq = _row.next_seq + 1, last_reset_period = _period, updated_at = now()
      WHERE id = _row.id;
  END IF;

  _formatted := _row.format_template;
  _formatted := replace(_formatted, '{prefix}', _row.prefix);
  _formatted := replace(_formatted, '{year}',   to_char(now(), 'YYYY'));
  _formatted := replace(_formatted, '{month}',  to_char(now(), 'MM'));
  _formatted := replace(_formatted, '{day}',    to_char(now(), 'DD'));
  _formatted := replace(_formatted, '{seq}',    lpad(_seq::text, _row.padding, '0'));
  RETURN _formatted;
END $$;

GRANT EXECUTE ON FUNCTION public.next_document_number(uuid, text, uuid) TO authenticated;

-- ========= 3) APPROVAL MATRIX =========
CREATE TABLE public.approval_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entity_type text NOT NULL,               -- e.g. 'purchase_order','sales_order','stock_transfer','stock_adjustment'
  action text NOT NULL DEFAULT 'post',     -- 'post' | 'cancel' | 'delete' | 'update'
  currency text,                           -- NULL = all currencies
  min_amount numeric(18,4),                -- NULL = 0
  max_amount numeric(18,4),                -- NULL = infinity
  stage_no integer NOT NULL DEFAULT 1,     -- 1..N sequential
  required_role_id uuid REFERENCES public.roles(id) ON DELETE RESTRICT,
  required_app_role public.app_role,       -- alternative: match by app_role
  requires_all_approvers boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approval_matrix_role_target_chk
    CHECK (required_role_id IS NOT NULL OR required_app_role IS NOT NULL),
  CONSTRAINT approval_matrix_amounts_chk
    CHECK (min_amount IS NULL OR max_amount IS NULL OR max_amount >= min_amount)
);
CREATE INDEX approval_matrix_lookup_idx
  ON public.approval_matrix(company_id, entity_type, action, stage_no);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_matrix TO authenticated;
GRANT ALL ON public.approval_matrix TO service_role;
ALTER TABLE public.approval_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view approval matrix"
  ON public.approval_matrix FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert approval matrix"
  ON public.approval_matrix FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_owner(auth.uid()));
CREATE POLICY "Admins update approval matrix"
  ON public.approval_matrix FOR UPDATE TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));
CREATE POLICY "Admins delete approval matrix"
  ON public.approval_matrix FOR DELETE TO authenticated
  USING (public.is_admin_or_owner(auth.uid()));

CREATE TRIGGER trg_approval_matrix_updated_at
  BEFORE UPDATE ON public.approval_matrix
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper: resolve required approval stages for a given request
CREATE OR REPLACE FUNCTION public.resolve_approval_stages(
  _company_id uuid,
  _entity_type text,
  _action text,
  _amount numeric,
  _currency text DEFAULT NULL
) RETURNS SETOF public.approval_matrix
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.approval_matrix
   WHERE company_id = _company_id
     AND entity_type = _entity_type
     AND action = _action
     AND is_active = true
     AND (currency IS NULL OR currency = COALESCE(_currency, currency))
     AND (min_amount IS NULL OR COALESCE(_amount,0) >= min_amount)
     AND (max_amount IS NULL OR COALESCE(_amount,0) <= max_amount)
   ORDER BY stage_no;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_approval_stages(uuid, text, text, numeric, text) TO authenticated;

-- ========= 4) PASSWORD POLICIES =========
CREATE TABLE public.password_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  min_length integer NOT NULL DEFAULT 8,
  require_uppercase boolean NOT NULL DEFAULT true,
  require_lowercase boolean NOT NULL DEFAULT true,
  require_number boolean NOT NULL DEFAULT true,
  require_symbol boolean NOT NULL DEFAULT false,
  expiry_days integer NOT NULL DEFAULT 0,           -- 0 = never
  prevent_reuse_last_n integer NOT NULL DEFAULT 3,
  lockout_attempts integer NOT NULL DEFAULT 5,
  lockout_minutes integer NOT NULL DEFAULT 15,
  session_timeout_minutes integer NOT NULL DEFAULT 480,
  require_2fa boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT password_policies_min_length_chk CHECK (min_length BETWEEN 4 AND 64)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.password_policies TO authenticated;
GRANT ALL ON public.password_policies TO service_role;
ALTER TABLE public.password_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view password policies"
  ON public.password_policies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage password policies"
  ON public.password_policies FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

CREATE TRIGGER trg_password_policies_updated_at
  BEFORE UPDATE ON public.password_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========= 5) LOGIN HISTORY =========
CREATE TABLE public.login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  ip_address inet,
  user_agent text,
  success boolean NOT NULL,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_history_user_idx ON public.login_history(user_id, created_at DESC);
CREATE INDEX login_history_created_idx ON public.login_history(created_at DESC);

GRANT SELECT, INSERT ON public.login_history TO authenticated;
GRANT ALL ON public.login_history TO service_role;
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own login history"
  ON public.login_history FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_owner(auth.uid()));
CREATE POLICY "Users insert own login history"
  ON public.login_history FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- ========= 6) BACKUP SETTINGS =========
CREATE TABLE public.backup_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  retention_days integer NOT NULL DEFAULT 30,
  notify_email text,
  last_backup_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT backup_settings_retention_chk CHECK (retention_days BETWEEN 1 AND 3650)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_settings TO authenticated;
GRANT ALL ON public.backup_settings TO service_role;
ALTER TABLE public.backup_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view backup settings"
  ON public.backup_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage backup settings"
  ON public.backup_settings FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

CREATE TRIGGER trg_backup_settings_updated_at
  BEFORE UPDATE ON public.backup_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
