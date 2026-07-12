
-- Drop legacy unique constraint on departments.name (blocks re-creating names, even soft-deleted)
ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS departments_name_key;

-- Seed default departments and job titles when none exist (ignoring soft-deleted)
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

    INSERT INTO public.job_titles (name, name_ar, name_en, code, level, department_id, is_system, position)
    SELECT * FROM (VALUES
      ('مدير النظام','مدير النظام','System Administrator','SYS_ADMIN', 1, NULL::uuid, true, 1),
      ('مدير عام','مدير عام','General Manager','GM', 1, NULL::uuid, true, 2),
      ('مدير الموارد البشرية','مدير الموارد البشرية','HR Manager','HR_MGR', 2, _hr, true, 3),
      ('مدير المبيعات','مدير المبيعات','Sales Manager','SLS_MGR', 2, _sales, true, 4),
      ('مدير المشتريات','مدير المشتريات','Procurement Manager','PRC_MGR', 2, _purch, true, 5),
      ('مدير المالية','مدير المالية','Finance Manager','FIN_MGR', 2, _fin, true, 6),
      ('أمين مخزن','أمين مخزن','Warehouse Keeper','WH_KEEP', 3, _wh, true, 7),
      ('محاسب','محاسب','Accountant','ACC', 3, _fin, true, 8),
      ('مندوب مبيعات','مندوب مبيعات','Sales Representative','SLS_REP', 4, _sales, true, 9)
    ) AS v(name, name_ar, name_en, code, level, department_id, is_system, position)
    WHERE NOT EXISTS (SELECT 1 FROM public.job_titles jt WHERE jt.code = v.code);
  END IF;
END $$;
