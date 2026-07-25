GRANT EXECUTE ON FUNCTION public.can_manage_workflow_stage_approvers(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_customer_by_tax_id(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_template_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workflow_approver(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workflow_stage_approver(uuid, uuid) TO authenticated;