-- 1) customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tax_id TEXT,
  currency TEXT NOT NULL DEFAULT 'EGP',
  terms TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Global unique tax_id (nullable allowed, uniqueness only when set)
CREATE UNIQUE INDEX customers_tax_id_unique ON public.customers (tax_id) WHERE tax_id IS NOT NULL;
CREATE INDEX customers_user_id_idx ON public.customers (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own customers"
  ON public.customers FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Lookup function for tax_id (security definer so it can peek across users, returns only the owning customer's name)
CREATE OR REPLACE FUNCTION public.find_customer_by_tax_id(_tax_id TEXT)
RETURNS TABLE (id UUID, name TEXT, owner_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.user_id AS owner_id
  FROM public.customers c
  WHERE c.tax_id IS NOT NULL AND c.tax_id = _tax_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.find_customer_by_tax_id(TEXT) TO authenticated;

-- 3) Extend quotes
ALTER TABLE public.quotes
  ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN terms_override TEXT;

CREATE INDEX quotes_customer_id_idx ON public.quotes (customer_id);