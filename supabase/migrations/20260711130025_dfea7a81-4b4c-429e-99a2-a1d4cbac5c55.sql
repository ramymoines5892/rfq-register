
-- Fix infinite recursion in profiles_update_self policy by using SECURITY DEFINER helpers

CREATE OR REPLACE FUNCTION public.current_profile_locked_fields()
RETURNS TABLE(status public.profile_status, department_id uuid, job_title_id uuid, manager_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT status, department_id, job_title_id, manager_id
  FROM public.profiles WHERE id = auth.uid()
$$;

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;

CREATE POLICY profiles_update_self ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND status         IS NOT DISTINCT FROM (SELECT f.status         FROM public.current_profile_locked_fields() f)
  AND department_id  IS NOT DISTINCT FROM (SELECT f.department_id  FROM public.current_profile_locked_fields() f)
  AND job_title_id   IS NOT DISTINCT FROM (SELECT f.job_title_id   FROM public.current_profile_locked_fields() f)
  AND manager_id     IS NOT DISTINCT FROM (SELECT f.manager_id     FROM public.current_profile_locked_fields() f)
);
