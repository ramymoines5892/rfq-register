
-- =========================================================
-- COMPANIES
-- =========================================================
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- General
  name TEXT NOT NULL,
  name_ar TEXT,
  short_name TEXT,
  code TEXT NOT NULL UNIQUE,
  tax_no TEXT,
  cr_no TEXT,
  vat_no TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  website TEXT,
  logo_url TEXT,
  -- Address
  country TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  address TEXT,
  -- Regional
  default_language TEXT DEFAULT 'ar',
  timezone TEXT DEFAULT 'Africa/Cairo',
  date_format TEXT DEFAULT 'DD/MM/YYYY',
  number_format TEXT DEFAULT '#,##0.00',
  -- Financial
  base_currency TEXT DEFAULT 'EGP',
  fiscal_year_start DATE,
  fiscal_year_end DATE,
  -- Contacts
  gm_name TEXT,
  purchasing_manager TEXT,
  sales_manager TEXT,
  finance_manager TEXT,
  -- Extras
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can create the FIRST company (bootstrap).
-- After that, only owner/admin can insert more.
CREATE POLICY "Bootstrap first company or admin creates" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM public.companies)
    OR public.is_admin_or_owner(auth.uid())
  );

CREATE POLICY "Authenticated can view companies" ON public.companies
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can update companies" ON public.companies
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

CREATE POLICY "Admins can delete companies" ON public.companies
  FOR DELETE TO authenticated
  USING (public.is_admin_or_owner(auth.uid()));

CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- COMPANY FEATURES
-- =========================================================
CREATE TABLE public.company_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  multi_branch BOOLEAN NOT NULL DEFAULT true,
  multi_warehouse BOOLEAN NOT NULL DEFAULT true,
  multi_currency BOOLEAN NOT NULL DEFAULT true,
  approval_workflow BOOLEAN NOT NULL DEFAULT true,
  audit_log BOOLEAN NOT NULL DEFAULT true,
  inventory BOOLEAN NOT NULL DEFAULT true,
  procurement BOOLEAN NOT NULL DEFAULT true,
  sales BOOLEAN NOT NULL DEFAULT true,
  finance BOOLEAN NOT NULL DEFAULT true,
  quality BOOLEAN NOT NULL DEFAULT true,
  traceability BOOLEAN NOT NULL DEFAULT true,
  heat_number BOOLEAN NOT NULL DEFAULT true,
  lot_number BOOLEAN NOT NULL DEFAULT true,
  batch_control BOOLEAN NOT NULL DEFAULT true,
  attachments BOOLEAN NOT NULL DEFAULT true,
  e_signatures BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_features TO authenticated;
GRANT ALL ON public.company_features TO service_role;
ALTER TABLE public.company_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bootstrap or admin insert features" ON public.company_features
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT count(*) FROM public.companies) <= 1
    OR public.is_admin_or_owner(auth.uid())
  );
CREATE POLICY "Authenticated view features" ON public.company_features
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin update features" ON public.company_features
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));
CREATE POLICY "Admin delete features" ON public.company_features
  FOR DELETE TO authenticated
  USING (public.is_admin_or_owner(auth.uid()));

CREATE TRIGGER trg_company_features_updated_at
  BEFORE UPDATE ON public.company_features
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- COMPANY NUMBERING
-- =========================================================
CREATE TABLE public.company_numbering (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  prefix TEXT NOT NULL,
  year_segment BOOLEAN NOT NULL DEFAULT true,
  padding INT NOT NULL DEFAULT 6,
  next_seq BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, doc_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_numbering TO authenticated;
GRANT ALL ON public.company_numbering TO service_role;
ALTER TABLE public.company_numbering ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bootstrap or admin insert numbering" ON public.company_numbering
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT count(*) FROM public.companies) <= 1
    OR public.is_admin_or_owner(auth.uid())
  );
CREATE POLICY "Authenticated view numbering" ON public.company_numbering
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin update numbering" ON public.company_numbering
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));
CREATE POLICY "Admin delete numbering" ON public.company_numbering
  FOR DELETE TO authenticated
  USING (public.is_admin_or_owner(auth.uid()));

CREATE TRIGGER trg_company_numbering_updated_at
  BEFORE UPDATE ON public.company_numbering
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- BRANCHES
-- =========================================================
CREATE TABLE public.branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ar TEXT,
  code TEXT,
  is_head_office BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bootstrap or admin insert branches" ON public.branches
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT count(*) FROM public.companies) <= 1
    OR public.is_admin_or_owner(auth.uid())
  );
CREATE POLICY "Authenticated view branches" ON public.branches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin update branches" ON public.branches
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));
CREATE POLICY "Admin delete branches" ON public.branches
  FOR DELETE TO authenticated
  USING (public.is_admin_or_owner(auth.uid()));

CREATE TRIGGER trg_branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- WAREHOUSES
-- =========================================================
CREATE TABLE public.warehouses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  name_ar TEXT,
  code TEXT,
  is_main BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated;
GRANT ALL ON public.warehouses TO service_role;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bootstrap or admin insert warehouses" ON public.warehouses
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT count(*) FROM public.companies) <= 1
    OR public.is_admin_or_owner(auth.uid())
  );
CREATE POLICY "Authenticated view warehouses" ON public.warehouses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin update warehouses" ON public.warehouses
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));
CREATE POLICY "Admin delete warehouses" ON public.warehouses
  FOR DELETE TO authenticated
  USING (public.is_admin_or_owner(auth.uid()));

CREATE TRIGGER trg_warehouses_updated_at
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Helper: has_any_company()
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_any_company()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.companies) $$;

GRANT EXECUTE ON FUNCTION public.has_any_company() TO authenticated, anon;
