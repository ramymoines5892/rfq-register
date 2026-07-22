
-- Grants (missing on this table)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated;
GRANT ALL ON public.warehouses TO service_role;

-- Tighten SELECT: user sees only warehouses in branches they can access
DROP POLICY IF EXISTS "Authenticated view warehouses" ON public.warehouses;
CREATE POLICY "View accessible warehouses"
  ON public.warehouses FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_owner(auth.uid())
    OR branch_id IS NULL
    OR public.can_access_branch(auth.uid(), branch_id)
  );

-- Ensure single "main" per branch/company via partial unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS warehouses_main_per_branch
  ON public.warehouses (branch_id) WHERE is_main = true AND branch_id IS NOT NULL;

-- Code uniqueness per company (when provided)
CREATE UNIQUE INDEX IF NOT EXISTS warehouses_code_per_company
  ON public.warehouses (company_id, lower(code)) WHERE code IS NOT NULL;

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_warehouses_updated_at ON public.warehouses;
CREATE TRIGGER trg_warehouses_updated_at
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
