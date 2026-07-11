CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT USAGE ON SCHEMA app_private TO service_role;

CREATE OR REPLACE FUNCTION app_private.is_template_owner(_user_id uuid, _template_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workflow_templates t
    WHERE t.id = _template_id
      AND t.owner_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION app_private.is_workflow_approver(_user_id uuid, _template_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workflow_stages s
    JOIN public.workflow_stage_approvers a ON a.stage_id = s.id
    WHERE s.template_id = _template_id
      AND a.approver_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION app_private.is_workflow_stage_approver(_user_id uuid, _stage_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workflow_stage_approvers a
    WHERE a.stage_id = _stage_id
      AND a.approver_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION app_private.can_manage_workflow_stage_approvers(_user_id uuid, _stage_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workflow_stages s
    JOIN public.workflow_templates t ON t.id = s.template_id
    WHERE s.id = _stage_id
      AND t.owner_id = _user_id
  )
$$;

REVOKE ALL ON FUNCTION app_private.is_template_owner(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.is_workflow_approver(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.is_workflow_stage_approver(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.can_manage_workflow_stage_approvers(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_template_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_workflow_approver(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_workflow_stage_approver(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.can_manage_workflow_stage_approvers(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_template_owner(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION app_private.is_workflow_approver(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION app_private.is_workflow_stage_approver(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION app_private.can_manage_workflow_stage_approvers(uuid, uuid) TO service_role;

DROP POLICY IF EXISTS "workflow approvers can read templates" ON public.workflow_templates;
DROP POLICY IF EXISTS "workflow template owner can manage stages" ON public.workflow_stages;
DROP POLICY IF EXISTS "workflow approvers can read stages" ON public.workflow_stages;
DROP POLICY IF EXISTS "workflow template owner can manage approvers" ON public.workflow_stage_approvers;

CREATE POLICY "workflow approvers can read templates"
ON public.workflow_templates
FOR SELECT
TO authenticated
USING (app_private.is_workflow_approver(auth.uid(), id));

CREATE POLICY "workflow template owner can manage stages"
ON public.workflow_stages
FOR ALL
TO authenticated
USING (app_private.is_template_owner(auth.uid(), template_id))
WITH CHECK (app_private.is_template_owner(auth.uid(), template_id));

CREATE POLICY "workflow approvers can read stages"
ON public.workflow_stages
FOR SELECT
TO authenticated
USING (app_private.is_workflow_stage_approver(auth.uid(), id));

CREATE POLICY "workflow template owner can manage approvers"
ON public.workflow_stage_approvers
FOR ALL
TO authenticated
USING (app_private.can_manage_workflow_stage_approvers(auth.uid(), stage_id))
WITH CHECK (app_private.can_manage_workflow_stage_approvers(auth.uid(), stage_id));

CREATE OR REPLACE FUNCTION public.add_workflow_stage(_template_id uuid, _name text DEFAULT NULL)
RETURNS public.workflow_stages
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, app_private
AS $$
DECLARE
  _next_position integer;
  _stage public.workflow_stages;
BEGIN
  IF auth.uid() IS NULL OR NOT app_private.is_template_owner(auth.uid(), _template_id) THEN
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
REVOKE ALL ON FUNCTION public.add_workflow_stage(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.add_workflow_stage(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.add_workflow_stage(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_workflow_stage(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.is_template_owner(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_template_owner(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_workflow_approver(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_workflow_approver(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_workflow_stage_approver(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_workflow_stage_approver(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.can_manage_workflow_stage_approvers(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_workflow_stage_approvers(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.find_customer_by_tax_id(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_customer_by_tax_id(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.find_customer_by_tax_id(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_customer_by_tax_id(text) TO service_role;