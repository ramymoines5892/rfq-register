
-- Departments: add hierarchy, code, color, and flexible metadata for custom fields
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS extension text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_departments_parent ON public.departments(parent_id);

-- Job titles: level, code, description, department link already exists, plus metadata
ALTER TABLE public.job_titles
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Custom field templates so users can add extra fields to departments / job_titles
-- Stored values live in the `metadata` jsonb column keyed by the field key.
CREATE TABLE IF NOT EXISTS public.org_field_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL CHECK (entity IN ('department','job_title')),
  key text NOT NULL,
  label_ar text NOT NULL,
  label_en text,
  field_type text NOT NULL DEFAULT 'text' CHECK (field_type IN ('text','number','email','phone','url','textarea','date')),
  required boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_field_templates TO authenticated;
GRANT ALL ON public.org_field_templates TO service_role;

ALTER TABLE public.org_field_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can read org field templates"
  ON public.org_field_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage org field templates"
  ON public.org_field_templates FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

CREATE TRIGGER trg_org_field_templates_updated
  BEFORE UPDATE ON public.org_field_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default departments (only if table is empty)
DO $$
DECLARE _empty boolean;
DECLARE _sales uuid; _purch uuid; _wh uuid; _fin uuid; _hr uuid;
BEGIN
  SELECT NOT EXISTS(SELECT 1 FROM public.departments WHERE deleted_at IS NULL) INTO _empty;
  IF _empty THEN
    INSERT INTO public.departments (name, name_ar, name_en, code, color, is_system, position)
    VALUES ('المبيعات','المبيعات','Sales','SLS','#3b82f6', true, 1) RETURNING id INTO _sales;
    INSERT INTO public.departments (name, name_ar, name_en, code, color, is_system, position)
    VALUES ('المشتريات','المشتريات','Procurement','PRC','#8b5cf6', true, 2) RETURNING id INTO _purch;
    INSERT INTO public.departments (name, name_ar, name_en, code, color, is_system, position)
    VALUES ('المخازن','المخازن','Warehouse','WH','#f59e0b', true, 3) RETURNING id INTO _wh;
    INSERT INTO public.departments (name, name_ar, name_en, code, color, is_system, position)
    VALUES ('المالية','المالية','Finance','FIN','#10b981', true, 4) RETURNING id INTO _fin;
    INSERT INTO public.departments (name, name_ar, name_en, code, color, is_system, position)
    VALUES ('الموارد البشرية','الموارد البشرية','Human Resources','HR','#ec4899', true, 5) RETURNING id INTO _hr;

    INSERT INTO public.job_titles (name, name_ar, name_en, code, level, department_id, is_system, position) VALUES
      ('مدير النظام','مدير النظام','System Administrator','SYS_ADMIN', 1, NULL, true, 1),
      ('مدير عام','مدير عام','General Manager','GM', 1, NULL, true, 2),
      ('مدير الموارد البشرية','مدير الموارد البشرية','HR Manager','HR_MGR', 2, _hr, true, 3),
      ('مدير المبيعات','مدير المبيعات','Sales Manager','SLS_MGR', 2, _sales, true, 4),
      ('مدير المشتريات','مدير المشتريات','Procurement Manager','PRC_MGR', 2, _purch, true, 5),
      ('مدير المالية','مدير المالية','Finance Manager','FIN_MGR', 2, _fin, true, 6),
      ('أمين مخزن','أمين مخزن','Warehouse Keeper','WH_KEEP', 3, _wh, true, 7),
      ('محاسب','محاسب','Accountant','ACC', 3, _fin, true, 8),
      ('مندوب مبيعات','مندوب مبيعات','Sales Representative','SLS_REP', 4, _sales, true, 9);
  END IF;
END $$;

-- Seed default extra field templates (examples the user mentioned)
INSERT INTO public.org_field_templates (entity, key, label_ar, label_en, field_type, position, is_system) VALUES
  ('department','internal_ext','رقم داخلي','Internal Extension','text',1,true),
  ('department','budget','الميزانية السنوية','Annual Budget','number',2,false),
  ('job_title','reports_to','يتبع لـ','Reports To','text',1,false)
ON CONFLICT (entity, key) DO NOTHING;
