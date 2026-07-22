
-- ============ PRODUCTS ============
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_ar text,
  name_en text,
  category text,
  uom text NOT NULL DEFAULT 'PCS',
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT products_code_per_company UNIQUE (company_id, code)
);
CREATE INDEX IF NOT EXISTS idx_products_company ON public.products(company_id) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_read_authenticated" ON public.products FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "products_write_admin" ON public.products FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()) OR public.has_permission(auth.uid(), 'inventory.manage'::public.app_permission))
  WITH CHECK (public.is_admin_or_owner(auth.uid()) OR public.has_permission(auth.uid(), 'inventory.manage'::public.app_permission));

CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ WAREHOUSE BINS ============
CREATE TABLE IF NOT EXISTS public.warehouse_bins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_ar text,
  name_en text,
  aisle text,
  rack text,
  shelf text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bins_code_per_warehouse UNIQUE (warehouse_id, code)
);
CREATE INDEX IF NOT EXISTS idx_bins_warehouse ON public.warehouse_bins(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_bins_branch ON public.warehouse_bins(branch_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_bins TO authenticated;
GRANT ALL ON public.warehouse_bins TO service_role;
ALTER TABLE public.warehouse_bins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bins_read_branch_scoped" ON public.warehouse_bins FOR SELECT TO authenticated
  USING (public.can_access_branch(auth.uid(), branch_id));
CREATE POLICY "bins_write_admin" ON public.warehouse_bins FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()) OR (public.can_access_branch(auth.uid(), branch_id) AND public.has_permission(auth.uid(), 'inventory.manage'::public.app_permission)))
  WITH CHECK (public.is_admin_or_owner(auth.uid()) OR (public.can_access_branch(auth.uid(), branch_id) AND public.has_permission(auth.uid(), 'inventory.manage'::public.app_permission)));

CREATE TRIGGER trg_bins_updated BEFORE UPDATE ON public.warehouse_bins FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ STOCK MOVEMENTS ============
DO $$ BEGIN
  CREATE TYPE public.stock_movement_type AS ENUM ('receipt','issue','transfer_out','transfer_in','adjustment','opening');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  bin_id uuid REFERENCES public.warehouse_bins(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  movement_type public.stock_movement_type NOT NULL,
  qty numeric(18,4) NOT NULL,
  uom text,
  heat_no text,
  lot_no text,
  batch_no text,
  serial_no text,
  mtc_ref text,
  coo_ref text,
  reference_type text,
  reference_id uuid,
  transfer_id uuid,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mov_wh_prod ON public.stock_movements(warehouse_id, product_id);
CREATE INDEX IF NOT EXISTS idx_mov_prod ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_mov_branch ON public.stock_movements(branch_id);
CREATE INDEX IF NOT EXISTS idx_mov_transfer ON public.stock_movements(transfer_id);

GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mov_read_branch_scoped" ON public.stock_movements FOR SELECT TO authenticated
  USING (public.can_access_branch(auth.uid(), branch_id));
CREATE POLICY "mov_insert_scoped" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (public.can_access_branch(auth.uid(), branch_id) AND (public.is_admin_or_owner(auth.uid()) OR public.has_permission(auth.uid(), 'inventory.manage'::public.app_permission)));

-- ============ STOCK TRANSFERS ============
DO $$ BEGIN
  CREATE TYPE public.stock_transfer_status AS ENUM ('draft','in_transit','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  transfer_no text NOT NULL,
  from_branch_id uuid NOT NULL REFERENCES public.branches(id),
  to_branch_id uuid NOT NULL REFERENCES public.branches(id),
  from_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  to_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  status public.stock_transfer_status NOT NULL DEFAULT 'draft',
  shipped_at timestamptz,
  received_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transfer_no_per_company UNIQUE (company_id, transfer_no),
  CONSTRAINT transfer_diff_warehouses CHECK (from_warehouse_id <> to_warehouse_id)
);
CREATE INDEX IF NOT EXISTS idx_transfers_from ON public.stock_transfers(from_branch_id, from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to ON public.stock_transfers(to_branch_id, to_warehouse_id);

GRANT SELECT, INSERT, UPDATE ON public.stock_transfers TO authenticated;
GRANT ALL ON public.stock_transfers TO service_role;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfers_read_scoped" ON public.stock_transfers FOR SELECT TO authenticated
  USING (public.can_access_branch(auth.uid(), from_branch_id) OR public.can_access_branch(auth.uid(), to_branch_id));
CREATE POLICY "transfers_write_scoped" ON public.stock_transfers FOR ALL TO authenticated
  USING (public.is_admin_or_owner(auth.uid()) OR (public.can_access_branch(auth.uid(), from_branch_id) AND public.has_permission(auth.uid(), 'inventory.transfer'::public.app_permission)))
  WITH CHECK (public.is_admin_or_owner(auth.uid()) OR (public.can_access_branch(auth.uid(), from_branch_id) AND public.has_permission(auth.uid(), 'inventory.transfer'::public.app_permission)));

CREATE TRIGGER trg_transfers_updated BEFORE UPDATE ON public.stock_transfers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.stock_transfer_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  qty numeric(18,4) NOT NULL CHECK (qty > 0),
  uom text,
  from_bin_id uuid REFERENCES public.warehouse_bins(id),
  to_bin_id uuid REFERENCES public.warehouse_bins(id),
  heat_no text,
  lot_no text,
  batch_no text,
  serial_no text,
  mtc_ref text,
  coo_ref text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transfer_lines_transfer ON public.stock_transfer_lines(transfer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_transfer_lines TO authenticated;
GRANT ALL ON public.stock_transfer_lines TO service_role;
ALTER TABLE public.stock_transfer_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfer_lines_read" ON public.stock_transfer_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stock_transfers t WHERE t.id = transfer_id
    AND (public.can_access_branch(auth.uid(), t.from_branch_id) OR public.can_access_branch(auth.uid(), t.to_branch_id))));
CREATE POLICY "transfer_lines_write" ON public.stock_transfer_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stock_transfers t WHERE t.id = transfer_id
    AND (public.is_admin_or_owner(auth.uid()) OR (public.can_access_branch(auth.uid(), t.from_branch_id) AND t.status = 'draft'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stock_transfers t WHERE t.id = transfer_id
    AND (public.is_admin_or_owner(auth.uid()) OR (public.can_access_branch(auth.uid(), t.from_branch_id) AND t.status = 'draft'))));

-- ============ INVENTORY BALANCES VIEW ============
CREATE OR REPLACE VIEW public.inventory_balances
WITH (security_invoker=on) AS
SELECT
  m.company_id,
  m.branch_id,
  m.warehouse_id,
  m.product_id,
  SUM(m.qty)::numeric(18,4) AS balance,
  MAX(m.created_at) AS last_movement_at,
  COUNT(*)::int AS movement_count
FROM public.stock_movements m
GROUP BY m.company_id, m.branch_id, m.warehouse_id, m.product_id;

GRANT SELECT ON public.inventory_balances TO authenticated;

-- ============ POST TRANSFER RPC ============
CREATE OR REPLACE FUNCTION public.post_stock_transfer(_transfer_id uuid)
RETURNS public.stock_transfers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _t public.stock_transfers;
  _line RECORD;
BEGIN
  SELECT * INTO _t FROM public.stock_transfers WHERE id = _transfer_id FOR UPDATE;
  IF _t.id IS NULL THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF _t.status <> 'draft' THEN RAISE EXCEPTION 'Only draft transfers can be posted'; END IF;

  IF NOT (public.is_admin_or_owner(auth.uid())
       OR (public.can_access_branch(auth.uid(), _t.from_branch_id)
           AND public.has_permission(auth.uid(), 'inventory.transfer'::public.app_permission)))
  THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;

  FOR _line IN SELECT * FROM public.stock_transfer_lines WHERE transfer_id = _transfer_id LOOP
    INSERT INTO public.stock_movements
      (company_id, branch_id, warehouse_id, bin_id, product_id, movement_type, qty, uom,
       heat_no, lot_no, batch_no, serial_no, mtc_ref, coo_ref, reference_type, reference_id, transfer_id, notes, created_by)
    VALUES
      (_t.company_id, _t.from_branch_id, _t.from_warehouse_id, _line.from_bin_id, _line.product_id, 'transfer_out',
       -_line.qty, _line.uom, _line.heat_no, _line.lot_no, _line.batch_no, _line.serial_no, _line.mtc_ref, _line.coo_ref,
       'stock_transfer', _t.id, _t.id, _line.notes, auth.uid()),
      (_t.company_id, _t.to_branch_id, _t.to_warehouse_id, _line.to_bin_id, _line.product_id, 'transfer_in',
       _line.qty, _line.uom, _line.heat_no, _line.lot_no, _line.batch_no, _line.serial_no, _line.mtc_ref, _line.coo_ref,
       'stock_transfer', _t.id, _t.id, _line.notes, auth.uid());
  END LOOP;

  UPDATE public.stock_transfers
     SET status = 'completed', shipped_at = COALESCE(shipped_at, now()), received_at = now()
   WHERE id = _transfer_id
   RETURNING * INTO _t;

  RETURN _t;
END;
$$;

REVOKE ALL ON FUNCTION public.post_stock_transfer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_stock_transfer(uuid) TO authenticated;
