
-- Field type enum
DO $$ BEGIN
  CREATE TYPE public.customer_field_type AS ENUM (
    'text','number','email','phone','date','dropdown','textarea','checkbox','file','multiselect','bilingual_text'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Definitions table
CREATE TABLE IF NOT EXISTS public.customer_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label_ar TEXT NOT NULL,
  label_en TEXT NOT NULL,
  field_type public.customer_field_type NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  section_ar TEXT,
  section_en TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  placeholder_ar TEXT,
  placeholder_en TEXT,
  help_text_ar TEXT,
  help_text_en TEXT,
  validation_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_field_definitions TO authenticated;
GRANT ALL ON public.customer_field_definitions TO service_role;
ALTER TABLE public.customer_field_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "field_defs_read_all_authenticated" ON public.customer_field_definitions;
CREATE POLICY "field_defs_read_all_authenticated"
  ON public.customer_field_definitions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "field_defs_manage_permission" ON public.customer_field_definitions;
CREATE POLICY "field_defs_manage_permission"
  ON public.customer_field_definitions FOR ALL
  TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_customer_fields'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_customer_fields'));

DROP TRIGGER IF EXISTS trg_field_defs_updated_at ON public.customer_field_definitions;
CREATE TRIGGER trg_field_defs_updated_at
  BEFORE UPDATE ON public.customer_field_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Options table
CREATE TABLE IF NOT EXISTS public.customer_field_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES public.customer_field_definitions(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  label_ar TEXT NOT NULL,
  label_en TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (field_id, value)
);
CREATE INDEX IF NOT EXISTS idx_field_options_field ON public.customer_field_options(field_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_field_options TO authenticated;
GRANT ALL ON public.customer_field_options TO service_role;
ALTER TABLE public.customer_field_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "field_options_read_all_authenticated" ON public.customer_field_options;
CREATE POLICY "field_options_read_all_authenticated"
  ON public.customer_field_options FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "field_options_manage_permission" ON public.customer_field_options;
CREATE POLICY "field_options_manage_permission"
  ON public.customer_field_options FOR ALL
  TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_customer_fields'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_customer_fields'));

DROP TRIGGER IF EXISTS trg_field_options_updated_at ON public.customer_field_options;
CREATE TRIGGER trg_field_options_updated_at
  BEFORE UPDATE ON public.customer_field_options
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Values table
CREATE TABLE IF NOT EXISTS public.customer_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.customer_field_definitions(id) ON DELETE CASCADE,
  value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, field_id)
);
CREATE INDEX IF NOT EXISTS idx_customer_field_values_customer ON public.customer_field_values(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_field_values_field ON public.customer_field_values(field_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_field_values TO authenticated;
GRANT ALL ON public.customer_field_values TO service_role;
ALTER TABLE public.customer_field_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_field_values_owner_all" ON public.customer_field_values;
CREATE POLICY "customer_field_values_owner_all"
  ON public.customer_field_values FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_field_values.customer_id
        AND (c.user_id = auth.uid() OR public.has_permission(auth.uid(), 'customers.view'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_field_values.customer_id
        AND (c.user_id = auth.uid() OR public.has_permission(auth.uid(), 'customers.edit') OR public.has_permission(auth.uid(), 'customers.create'))
    )
  );

DROP TRIGGER IF EXISTS trg_customer_field_values_updated_at ON public.customer_field_values;
CREATE TRIGGER trg_customer_field_values_updated_at
  BEFORE UPDATE ON public.customer_field_values
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed system fields
INSERT INTO public.customer_field_definitions (key, label_ar, label_en, field_type, is_required, is_system, section_ar, section_en, position)
VALUES
  ('company_name', 'اسم الشركة', 'Company Name', 'bilingual_text', true, true, 'بيانات أساسية', 'Basic Info', 10),
  ('industry', 'النشاط', 'Industry', 'bilingual_text', false, true, 'بيانات أساسية', 'Basic Info', 20),
  ('address', 'العنوان', 'Address', 'bilingual_text', false, true, 'بيانات أساسية', 'Basic Info', 30),
  ('tax_id', 'الرقم الضريبي', 'Tax ID', 'text', false, true, 'بيانات ضريبية', 'Tax Info', 40),
  ('payment_terms', 'شروط الدفع', 'Payment Terms', 'bilingual_text', false, true, 'شروط', 'Terms', 50)
ON CONFLICT (key) DO NOTHING;
