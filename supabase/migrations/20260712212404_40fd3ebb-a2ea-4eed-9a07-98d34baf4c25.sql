GRANT EXECUTE ON FUNCTION public.is_admin_or_owner(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_owner(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_status() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_any_user() TO authenticated, anon;