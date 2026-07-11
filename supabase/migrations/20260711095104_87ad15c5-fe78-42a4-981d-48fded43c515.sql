CREATE OR REPLACE FUNCTION public.is_workflow_stage_approver(_user_id uuid, _stage_id uuid)
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

CREATE OR REPLACE FUNCTION public.can_manage_workflow_stage_approvers(_user_id uuid, _stage_id uuid)
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

REVOKE ALL ON FUNCTION public.is_workflow_stage_approver(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_workflow_stage_approvers(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_workflow_stage_approver(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_workflow_stage_approvers(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "approvers can read templates they belong to" ON public.workflow_templates;
DROP POLICY IF EXISTS "own templates" ON public.workflow_templates;
DROP POLICY IF EXISTS "approvers can read stages" ON public.workflow_stages;
DROP POLICY IF EXISTS "template owner manages stages" ON public.workflow_stages;
DROP POLICY IF EXISTS "approver can see own assignments" ON public.workflow_stage_approvers;
DROP POLICY IF EXISTS "template owner manages approvers" ON public.workflow_stage_approvers;

CREATE POLICY "workflow template owner can manage templates"
ON public.workflow_templates
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "workflow approvers can read templates"
ON public.workflow_templates
FOR SELECT
TO authenticated
USING (public.is_workflow_approver(auth.uid(), id));

CREATE POLICY "workflow template owner can manage stages"
ON public.workflow_stages
FOR ALL
TO authenticated
USING (public.is_template_owner(auth.uid(), template_id))
WITH CHECK (public.is_template_owner(auth.uid(), template_id));

CREATE POLICY "workflow approvers can read stages"
ON public.workflow_stages
FOR SELECT
TO authenticated
USING (public.is_workflow_stage_approver(auth.uid(), id));

CREATE POLICY "workflow approvers can read own assignments"
ON public.workflow_stage_approvers
FOR SELECT
TO authenticated
USING (approver_id = auth.uid());

CREATE POLICY "workflow template owner can manage approvers"
ON public.workflow_stage_approvers
FOR ALL
TO authenticated
USING (public.can_manage_workflow_stage_approvers(auth.uid(), stage_id))
WITH CHECK (public.can_manage_workflow_stage_approvers(auth.uid(), stage_id));