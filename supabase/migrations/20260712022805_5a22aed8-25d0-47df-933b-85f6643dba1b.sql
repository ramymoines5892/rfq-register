
-- Enum for attachment category
DO $$ BEGIN
  CREATE TYPE public.customer_attachment_category AS ENUM (
    'company_profile',
    'commercial_register',
    'tax_card',
    'bank_letter',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.customer_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category public.customer_attachment_category NOT NULL DEFAULT 'other',
  label TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_attachments_customer_id ON public.customer_attachments(customer_id);
CREATE INDEX idx_customer_attachments_user_id ON public.customer_attachments(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_attachments TO authenticated;
GRANT ALL ON public.customer_attachments TO service_role;

ALTER TABLE public.customer_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own customer attachments"
  ON public.customer_attachments
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_customer_attachments_updated_at
  BEFORE UPDATE ON public.customer_attachments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket policies (bucket itself is created via storage tool)
CREATE POLICY "Users can view own customer files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'customer-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own customer files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'customer-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own customer files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'customer-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own customer files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'customer-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
