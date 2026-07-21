
-- =====================================================
-- Company Documents feature
-- =====================================================

-- Notify repeat frequency
DO $$ BEGIN
  CREATE TYPE public.doc_notify_repeat AS ENUM ('none','daily','weekly','monthly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) Document types (per company; seeded defaults, editable)
CREATE TABLE public.company_document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description text,
  default_department_ids uuid[] NOT NULL DEFAULT '{}',
  notify_days_before integer NOT NULL DEFAULT 30,
  notify_repeat public.doc_notify_repeat NOT NULL DEFAULT 'weekly',
  is_system boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_document_types TO authenticated;
GRANT ALL ON public.company_document_types TO service_role;
ALTER TABLE public.company_document_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cdt_select_auth" ON public.company_document_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "cdt_admin_all" ON public.company_document_types FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid())) WITH CHECK (public.is_admin_or_owner(auth.uid()));
CREATE TRIGGER trg_cdt_updated BEFORE UPDATE ON public.company_document_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Documents (never deleted; new version marks previous as superseded)
CREATE TABLE public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type_id uuid NOT NULL REFERENCES public.company_document_types(id) ON DELETE RESTRICT,
  doc_number text,
  issue_date date,
  expiry_date date,
  notes text,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Optional per-document overrides (NULL = inherit from type)
  department_ids uuid[],
  notify_days_before integer,
  notify_repeat public.doc_notify_repeat,
  -- Versioning
  superseded_by uuid REFERENCES public.company_documents(id) ON DELETE SET NULL,
  superseded_at timestamptz,
  -- Notification state
  last_notified_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_documents TO authenticated;
GRANT ALL ON public.company_documents TO service_role;
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cd_select_auth" ON public.company_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "cd_admin_all" ON public.company_documents FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid())) WITH CHECK (public.is_admin_or_owner(auth.uid()));
CREATE INDEX idx_cd_company_type ON public.company_documents (company_id, type_id);
CREATE INDEX idx_cd_current ON public.company_documents (type_id) WHERE superseded_at IS NULL;
CREATE INDEX idx_cd_expiry ON public.company_documents (expiry_date) WHERE superseded_at IS NULL;
CREATE TRIGGER trg_cd_updated BEFORE UPDATE ON public.company_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Files (multiple attachments per document)
CREATE TABLE public.company_document_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.company_documents(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_document_files TO authenticated;
GRANT ALL ON public.company_document_files TO service_role;
ALTER TABLE public.company_document_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cdf_select_auth" ON public.company_document_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "cdf_admin_all" ON public.company_document_files FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid())) WITH CHECK (public.is_admin_or_owner(auth.uid()));
CREATE INDEX idx_cdf_document ON public.company_document_files (document_id);

-- Storage policies for the private company-documents bucket
CREATE POLICY "company_documents_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'company-documents');
CREATE POLICY "company_documents_admin_write" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'company-documents' AND public.is_admin_or_owner(auth.uid()))
  WITH CHECK (bucket_id = 'company-documents' AND public.is_admin_or_owner(auth.uid()));

-- 4) Helper: get current document for a type (latest non-superseded)
CREATE OR REPLACE FUNCTION public.current_company_document(_type_id uuid)
RETURNS public.company_documents
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT * FROM public.company_documents
  WHERE type_id = _type_id AND superseded_at IS NULL
  ORDER BY created_at DESC LIMIT 1
$$;

-- 5) Seed default document types for existing (single) company, if any
INSERT INTO public.company_document_types
  (company_id, code, name_ar, name_en, default_department_ids, notify_days_before, notify_repeat, is_system, position)
SELECT c.id, s.code, s.name_ar, s.name_en,
       ARRAY(
         SELECT d.id FROM public.departments d
         WHERE d.deleted_at IS NULL
           AND (d.name_ar = ANY(s.dept_names) OR d.name = ANY(s.dept_names) OR d.name_en = ANY(s.dept_names))
       ),
       s.notify_days, s.repeat_kind::public.doc_notify_repeat, true, s.pos
FROM public.companies c
CROSS JOIN (VALUES
  ('CR',           'السجل التجاري',          'Commercial Registration', ARRAY['المالية','الحسابات','Finance']::text[],           45, 'weekly', 1),
  ('TAX_CARD',     'البطاقة الضريبية',       'Tax Card',                ARRAY['المالية','الحسابات','Finance']::text[],           45, 'weekly', 2),
  ('VAT_CERT',     'شهادة القيمة المضافة',   'VAT Certificate',         ARRAY['المالية','الحسابات','Finance']::text[],           45, 'weekly', 3),
  ('IMPORT_CARD',  'بطاقة الاستيراد',        'Import License',          ARRAY['المشتريات','الشحن','مشتريات خارجيه','المالية']::text[], 60, 'weekly', 4),
  ('EXPORT_CARD',  'بطاقة التصدير',          'Export License',          ARRAY['المبيعات','الشحن','المالية']::text[],             60, 'weekly', 5),
  ('INDUSTRIAL',   'السجل الصناعي',          'Industrial Registration', ARRAY['الجودة','الإنتاج','المالية']::text[],             60, 'monthly', 6),
  ('CHAMBER',      'عضوية الغرفة التجارية',  'Chamber Membership',      ARRAY['المالية','الحسابات']::text[],                     45, 'monthly', 7),
  ('CIVIL_DEF',    'شهادة الدفاع المدني',    'Civil Defense Cert.',     ARRAY['الموارد البشرية','التشغيل']::text[],              30, 'weekly', 8),
  ('SOCIAL_INS',   'شهادة التأمينات',        'Social Insurance Cert.',  ARRAY['الموارد البشرية','المالية']::text[],              30, 'weekly', 9),
  ('LEASE',        'عقد الإيجار',            'Lease Contract',          ARRAY['المالية','الإدارة']::text[],                      60, 'monthly', 10)
) AS s(code, name_ar, name_en, dept_names, notify_days, repeat_kind, pos)
ON CONFLICT (company_id, code) DO NOTHING;

-- 6) Notification generator (called by cron daily)
CREATE OR REPLACE FUNCTION public.generate_company_document_notifications()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _rec RECORD;
  _target RECORD;
  _days_left integer;
  _threshold integer;
  _repeat public.doc_notify_repeat;
  _depts uuid[];
  _min_gap interval;
  _should_notify boolean;
  _title text;
  _body text;
  _kind text;
  _priority text;
  _count integer := 0;
BEGIN
  FOR _rec IN
    SELECT DISTINCT ON (d.type_id)
      d.id, d.type_id, d.company_id, d.expiry_date, d.department_ids,
      d.notify_days_before, d.notify_repeat, d.last_notified_at,
      t.name_ar, t.name_en, t.default_department_ids,
      t.notify_days_before AS t_days, t.notify_repeat AS t_repeat
    FROM public.company_documents d
    JOIN public.company_document_types t ON t.id = d.type_id
    WHERE d.superseded_at IS NULL AND d.expiry_date IS NOT NULL
    ORDER BY d.type_id, d.created_at DESC
  LOOP
    _threshold := COALESCE(_rec.notify_days_before, _rec.t_days, 30);
    _repeat := COALESCE(_rec.notify_repeat, _rec.t_repeat, 'weekly'::public.doc_notify_repeat);
    _depts := COALESCE(NULLIF(_rec.department_ids, '{}'::uuid[]), _rec.default_department_ids);
    _days_left := (_rec.expiry_date - CURRENT_DATE);

    -- Only notify when within threshold or already expired
    IF _days_left > _threshold THEN CONTINUE; END IF;

    _min_gap := CASE _repeat
      WHEN 'daily'   THEN interval '20 hours'
      WHEN 'weekly'  THEN interval '6 days 20 hours'
      WHEN 'monthly' THEN interval '29 days'
      ELSE interval '100 years'
    END;
    _should_notify := _rec.last_notified_at IS NULL OR (now() - _rec.last_notified_at) >= _min_gap;
    IF NOT _should_notify THEN CONTINUE; END IF;

    IF _days_left < 0 THEN
      _title := 'مستند منتهي: ' || _rec.name_ar;
      _body := 'انتهت صلاحية "' || _rec.name_ar || '" منذ ' || abs(_days_left) || ' يوم. يرجى رفع النسخة الجديدة.';
      _kind := 'action_required'; _priority := 'high';
    ELSE
      _title := 'اقتراب انتهاء: ' || _rec.name_ar;
      _body := '"' || _rec.name_ar || '" ينتهي خلال ' || _days_left || ' يوم.';
      _kind := 'reminder'; _priority := CASE WHEN _days_left <= 7 THEN 'high' ELSE 'medium' END;
    END IF;

    -- Insert notifications for each user in the target departments + admins/owners
    FOR _target IN
      SELECT DISTINCT p.id AS user_id
      FROM public.profiles p
      WHERE p.status = 'active'::public.profile_status
        AND (
          (p.department_id = ANY(_depts))
          OR public.is_admin_or_owner(p.id)
        )
    LOOP
      INSERT INTO public.notifications (user_id, title, body, link, kind, category, priority, entity_type, entity_id)
      VALUES (_target.user_id, _title, _body, '/documents?doc=' || _rec.id::text,
              _kind, 'company_documents', _priority, 'company_document', _rec.id::text);
      _count := _count + 1;
    END LOOP;

    UPDATE public.company_documents SET last_notified_at = now() WHERE id = _rec.id;
  END LOOP;
  RETURN _count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.generate_company_document_notifications() TO authenticated, service_role;
