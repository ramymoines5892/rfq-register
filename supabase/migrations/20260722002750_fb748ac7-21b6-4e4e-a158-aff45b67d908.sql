
-- Admin/warehouse-manager tier: all inventory/approval permissions
INSERT INTO public.role_permissions (role_id, permission)
SELECT r.id, p.perm
FROM public.roles r
CROSS JOIN (VALUES
  ('warehouses.view'::public.app_permission),
  ('warehouses.manage'::public.app_permission),
  ('bins.manage'::public.app_permission),
  ('inventory.view'::public.app_permission),
  ('inventory.transfer.create'::public.app_permission),
  ('inventory.transfer.post'::public.app_permission),
  ('inventory.transfer.cancel'::public.app_permission),
  ('inventory.adjust.create'::public.app_permission),
  ('inventory.adjust.approve'::public.app_permission),
  ('approvals.view'::public.app_permission),
  ('approvals.decide'::public.app_permission)
) AS p(perm)
WHERE r.is_system = true
  AND r.name_en IN ('System Administrator','General Manager','Warehouse Manager','Procurement Manager')
ON CONFLICT DO NOTHING;

-- Clerk / engineer tier: view + create requests only
INSERT INTO public.role_permissions (role_id, permission)
SELECT r.id, p.perm
FROM public.roles r
CROSS JOIN (VALUES
  ('warehouses.view'::public.app_permission),
  ('inventory.view'::public.app_permission),
  ('inventory.transfer.create'::public.app_permission),
  ('inventory.adjust.create'::public.app_permission),
  ('approvals.view'::public.app_permission)
) AS p(perm)
WHERE r.is_system = true
  AND r.name_en IN ('Store Keeper','Purchasing Engineer','Sales Engineer')
ON CONFLICT DO NOTHING;

-- Viewer: read-only
INSERT INTO public.role_permissions (role_id, permission)
SELECT r.id, p.perm
FROM public.roles r
CROSS JOIN (VALUES
  ('warehouses.view'::public.app_permission),
  ('inventory.view'::public.app_permission)
) AS p(perm)
WHERE r.is_system = true AND r.name_en = 'Viewer'
ON CONFLICT DO NOTHING;
