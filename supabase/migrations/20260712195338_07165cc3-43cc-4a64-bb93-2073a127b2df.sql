DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.handle_new_user()',
    'public.handle_new_user_role()',
    'public.notify_admins_new_pending_user()',
    'public.notify_admins_profile_status_pending()',
    'public.set_updated_at()',
    'public.update_updated_at_column()',
    'public.add_workflow_stage(uuid, text)',
    'public.global_search(text, integer)',
    'public.match_search_embeddings(vector, integer, double precision)'
  ]
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'skip: %', fn;
    END;
  END LOOP;

  -- These two are called from the client via .rpc() — keep authenticated EXECUTE.
  BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.global_search(text, integer) TO authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.match_search_embeddings(vector, integer, double precision) TO authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.add_workflow_stage(uuid, text) TO authenticated'; EXCEPTION WHEN undefined_function THEN NULL; END;
END$$;
