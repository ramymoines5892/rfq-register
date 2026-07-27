GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_stages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_stage_approvers TO authenticated;
GRANT ALL ON public.workflow_templates TO service_role;
GRANT ALL ON public.workflow_stages TO service_role;
GRANT ALL ON public.workflow_stage_approvers TO service_role;
GRANT EXECUTE ON FUNCTION public.add_workflow_stage(uuid, text) TO authenticated;