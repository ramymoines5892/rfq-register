
-- Partner roles enum
DO $$ BEGIN
  CREATE TYPE public.partner_role AS ENUM (
    'customer','supplier','manufacturer','freight_forwarder',
    'inspection','shipping','bank','insurance','agent'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Main partners table
CREATE TABLE IF NOT EXISTS public.business_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  code text,
  name_ar text,
  name_en text,
  legal_name text,
  roles public.partner_role[] NOT NULL DEFAULT '{}',
  tax_id text,
  commercial_reg text,
  industry text,
  category text,
  country text,
  city text,
  state text,
  address text,
  website text,
  email text,
  phone text,
  mobile text,
  fax text,
  currency text NOT NULL DEFAULT 'EGP',
  payment_terms text,
  credit_limit numeric(18,2) DEFAULT 0,
  price_list text,
  incoterm text,
  rating smallint,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS bp_code_company_uk
  ON public.business_partners(company_id, code) WHERE code IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS bp_roles_gin ON public.business_partners USING gin (roles);
CREATE INDEX IF NOT EXISTS bp_name_ar_trgm ON public.business_partners USING gin (name_ar extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS bp_name_en_trgm ON public.business_partners USING gin (name_en extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS bp_active_idx ON public.business_partners(created_at DESC) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_partners TO authenticated;
GRANT ALL ON public.business_partners TO service_role;
ALTER TABLE public.business_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bp_read_auth" ON public.business_partners FOR SELECT TO authenticated USING (true);
CREATE POLICY "bp_write_admin_or_perm" ON public.business_partners FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()) OR public.has_permission(auth.uid(),'customers.manage'::public.app_permission))
  WITH CHECK (public.is_admin_or_owner(auth.uid()) OR public.has_permission(auth.uid(),'customers.manage'::public.app_permission));

CREATE TRIGGER trg_bp_updated_at BEFORE UPDATE ON public.business_partners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Contacts
CREATE TABLE IF NOT EXISTS public.partner_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.business_partners(id) ON DELETE CASCADE,
  name text NOT NULL,
  title text,
  email text,
  phone text,
  mobile text,
  is_default boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pc_partner_idx ON public.partner_contacts(partner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_contacts TO authenticated;
GRANT ALL ON public.partner_contacts TO service_role;
ALTER TABLE public.partner_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pc_read_auth" ON public.partner_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "pc_write_admin_or_perm" ON public.partner_contacts FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()) OR public.has_permission(auth.uid(),'customers.manage'::public.app_permission))
  WITH CHECK (public.is_admin_or_owner(auth.uid()) OR public.has_permission(auth.uid(),'customers.manage'::public.app_permission));
CREATE TRIGGER trg_pc_updated_at BEFORE UPDATE ON public.partner_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Addresses
CREATE TABLE IF NOT EXISTS public.partner_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.business_partners(id) ON DELETE CASCADE,
  label text,
  address_type text NOT NULL DEFAULT 'billing',
  address text,
  city text,
  state text,
  country text,
  postal_code text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pa_partner_idx ON public.partner_addresses(partner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_addresses TO authenticated;
GRANT ALL ON public.partner_addresses TO service_role;
ALTER TABLE public.partner_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa_read_auth" ON public.partner_addresses FOR SELECT TO authenticated USING (true);
CREATE POLICY "pa_write_admin_or_perm" ON public.partner_addresses FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()) OR public.has_permission(auth.uid(),'customers.manage'::public.app_permission))
  WITH CHECK (public.is_admin_or_owner(auth.uid()) OR public.has_permission(auth.uid(),'customers.manage'::public.app_permission));
CREATE TRIGGER trg_pa_updated_at BEFORE UPDATE ON public.partner_addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Bank accounts
CREATE TABLE IF NOT EXISTS public.partner_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.business_partners(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  branch text,
  account_name text,
  account_no text,
  iban text,
  swift text,
  currency text NOT NULL DEFAULT 'EGP',
  is_default boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pb_partner_idx ON public.partner_banks(partner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_banks TO authenticated;
GRANT ALL ON public.partner_banks TO service_role;
ALTER TABLE public.partner_banks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pb_read_auth" ON public.partner_banks FOR SELECT TO authenticated USING (true);
CREATE POLICY "pb_write_admin_or_perm" ON public.partner_banks FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()) OR public.has_permission(auth.uid(),'customers.manage'::public.app_permission))
  WITH CHECK (public.is_admin_or_owner(auth.uid()) OR public.has_permission(auth.uid(),'customers.manage'::public.app_permission));
CREATE TRIGGER trg_pb_updated_at BEFORE UPDATE ON public.partner_banks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
