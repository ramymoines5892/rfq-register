ALTER TABLE public.business_partners
  ADD COLUMN IF NOT EXISTS discount_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_scheme text,
  ADD COLUMN IF NOT EXISTS tax_exempt_no text;

ALTER TABLE public.partner_contacts
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS mobile_is_whatsapp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_is_whatsapp boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.partner_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.business_partners(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'other',
  label text,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_attachments TO authenticated;
GRANT ALL ON public.partner_attachments TO service_role;

ALTER TABLE public.partner_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pat_read_auth" ON public.partner_attachments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pat_write_admin_or_perm" ON public.partner_attachments
  FOR ALL TO authenticated
  USING (is_admin_or_owner(auth.uid()) OR has_permission(auth.uid(), 'customers.manage'::app_permission))
  WITH CHECK (is_admin_or_owner(auth.uid()) OR has_permission(auth.uid(), 'customers.manage'::app_permission));

CREATE INDEX IF NOT EXISTS partner_attachments_partner_idx ON public.partner_attachments(partner_id);