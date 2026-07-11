
-- Fix infinite recursion between workflow_templates <-> workflow_stages policies
CREATE OR REPLACE FUNCTION public.is_workflow_approver(_user_id uuid, _template_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM workflow_stages s
    JOIN workflow_stage_approvers a ON a.stage_id = s.id
    WHERE s.template_id = _template_id AND a.approver_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_template_owner(_user_id uuid, _template_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM workflow_templates t WHERE t.id = _template_id AND t.owner_id = _user_id)
$$;

DROP POLICY IF EXISTS "approvers can read templates they belong to" ON public.workflow_templates;
DROP POLICY IF EXISTS "approvers can read stages" ON public.workflow_stages;
DROP POLICY IF EXISTS "template owner manages stages" ON public.workflow_stages;
DROP POLICY IF EXISTS "template owner manages approvers" ON public.workflow_stage_approvers;

CREATE POLICY "approvers can read templates they belong to" ON public.workflow_templates
FOR SELECT USING (public.is_workflow_approver(auth.uid(), id));

CREATE POLICY "template owner manages stages" ON public.workflow_stages
FOR ALL USING (public.is_template_owner(auth.uid(), template_id))
WITH CHECK (public.is_template_owner(auth.uid(), template_id));

CREATE POLICY "approvers can read stages" ON public.workflow_stages
FOR SELECT USING (EXISTS (
  SELECT 1 FROM workflow_stage_approvers a
  WHERE a.stage_id = workflow_stages.id AND a.approver_id = auth.uid()
));

CREATE POLICY "template owner manages approvers" ON public.workflow_stage_approvers
FOR ALL USING (public.is_template_owner(auth.uid(), (SELECT template_id FROM workflow_stages WHERE id = workflow_stage_approvers.stage_id)))
WITH CHECK (public.is_template_owner(auth.uid(), (SELECT template_id FROM workflow_stages WHERE id = workflow_stage_approvers.stage_id)));
