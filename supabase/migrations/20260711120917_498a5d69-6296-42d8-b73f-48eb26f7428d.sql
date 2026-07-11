
DROP POLICY IF EXISTS "profiles readable by team" ON public.profiles;
CREATE POLICY "profiles readable by team" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = profiles.id)
    OR public.is_admin_or_owner(auth.uid())
  );
