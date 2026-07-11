CREATE OR REPLACE FUNCTION public.add_workflow_stage(_template_id uuid, _name text DEFAULT NULL)
RETURNS public.workflow_stages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _next_position integer;
  _stage public.workflow_stages;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_template_owner(auth.uid(), _template_id) THEN
    RAISE EXCEPTION 'Not allowed to add stages to this workflow template'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_template_id::text, 0));

  SELECT COALESCE(MAX(position), 0) + 1
  INTO _next_position
  FROM public.workflow_stages
  WHERE template_id = _template_id;

  INSERT INTO public.workflow_stages (template_id, position, name)
  VALUES (_template_id, _next_position, COALESCE(NULLIF(BTRIM(_name), ''), 'Stage ' || _next_position))
  RETURNING * INTO _stage;

  RETURN _stage;
END;
$$;

REVOKE ALL ON FUNCTION public.add_workflow_stage(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_workflow_stage(uuid, text) TO authenticated;