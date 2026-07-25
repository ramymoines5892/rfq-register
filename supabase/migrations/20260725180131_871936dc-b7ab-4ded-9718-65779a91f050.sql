
-- 1) Expand employment_status enum
ALTER TYPE employment_status ADD VALUE IF NOT EXISTS 'planned';
ALTER TYPE employment_status ADD VALUE IF NOT EXISTS 'probation';
ALTER TYPE employment_status ADD VALUE IF NOT EXISTS 'retired';
ALTER TYPE employment_status ADD VALUE IF NOT EXISTS 'resigned';
ALTER TYPE employment_status ADD VALUE IF NOT EXISTS 'archived';

-- 2) Create employment_type enum
DO $$ BEGIN
  CREATE TYPE employment_type AS ENUM ('full_time','part_time','contract','temporary','intern','consultant','freelancer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Create persons table
CREATE TABLE IF NOT EXISTS public.persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  national_id text,
  passport_no text,
  first_name text,
  middle_name text,
  last_name text,
  full_name text,
  full_name_ar text,
  full_name_en text,
  birth_date date,
  gender text CHECK (gender IN ('male','female','other') OR gender IS NULL),
  nationality text,
  personal_email text,
  personal_phone text,
  photo_url text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.persons TO authenticated;
GRANT ALL ON public.persons TO service_role;

ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "persons_select_auth" ON public.persons FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "persons_insert_admin" ON public.persons FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_owner(auth.uid()));
CREATE POLICY "persons_update_admin" ON public.persons FOR UPDATE TO authenticated USING (public.is_admin_or_owner(auth.uid())) WITH CHECK (public.is_admin_or_owner(auth.uid()));
CREATE POLICY "persons_delete_admin" ON public.persons FOR DELETE TO authenticated USING (public.is_admin_or_owner(auth.uid()));

CREATE TRIGGER persons_set_updated_at BEFORE UPDATE ON public.persons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS persons_national_id_unique ON public.persons(national_id) WHERE national_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS persons_passport_unique ON public.persons(passport_no) WHERE passport_no IS NOT NULL AND deleted_at IS NULL;

-- 4) Extend employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.persons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS employee_number text,
  ADD COLUMN IF NOT EXISTS employment_type employment_type,
  ADD COLUMN IF NOT EXISTS termination_date date,
  ADD COLUMN IF NOT EXISTS cost_center text;

CREATE UNIQUE INDEX IF NOT EXISTS employees_number_per_company_unique
  ON public.employees(company_id, employee_number)
  WHERE employee_number IS NOT NULL AND deleted_at IS NULL;

-- 5) Backfill persons from existing employees
INSERT INTO public.persons (id, full_name, full_name_ar, full_name_en, national_id, passport_no, personal_email, personal_phone, photo_url, created_at, updated_at)
SELECT gen_random_uuid(), e.full_name, e.full_name_ar, e.full_name_en, e.national_id, e.passport_no, e.email, e.phone, e.photo_url, e.created_at, e.updated_at
FROM public.employees e
WHERE e.person_id IS NULL;

UPDATE public.employees e
SET person_id = p.id
FROM public.persons p
WHERE e.person_id IS NULL
  AND COALESCE(e.full_name,'') = COALESCE(p.full_name,'')
  AND COALESCE(e.national_id,'') = COALESCE(p.national_id,'')
  AND COALESCE(e.passport_no,'') = COALESCE(p.passport_no,'')
  AND e.created_at = p.created_at;
