
DROP POLICY IF EXISTS "restrictive_hide_deleted"     ON public.customer_field_options;
DROP POLICY IF EXISTS "restrictive_hide_hidden"      ON public.customer_field_options;
DROP POLICY IF EXISTS "restrictive_only_owner_delete" ON public.customer_field_options;
DROP POLICY IF EXISTS "restrictive_no_update_deleted" ON public.customer_field_options;
