
-- Extend customers with more business details
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS payment_terms text;

-- Contact persons per customer
CREATE TABLE IF NOT EXISTS public.customer_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  title text,
  email text,
  phone text,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_contacts TO authenticated;
GRANT ALL ON public.customer_contacts TO service_role;

ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own customer contacts" ON public.customer_contacts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer ON public.customer_contacts(customer_id);

CREATE TRIGGER trg_customer_contacts_updated_at
  BEFORE UPDATE ON public.customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Bank accounts per customer
CREATE TABLE IF NOT EXISTS public.customer_banks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_name text,
  account_number text,
  iban text,
  swift text,
  currency text NOT NULL DEFAULT 'EGP',
  branch text,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_banks TO authenticated;
GRANT ALL ON public.customer_banks TO service_role;

ALTER TABLE public.customer_banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own customer banks" ON public.customer_banks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_customer_banks_customer ON public.customer_banks(customer_id);

CREATE TRIGGER trg_customer_banks_updated_at
  BEFORE UPDATE ON public.customer_banks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
