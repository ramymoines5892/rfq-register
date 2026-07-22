
-- ================================================================
-- 1) NEW PERMISSIONS
-- ================================================================
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'warehouses.view';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'warehouses.manage';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'bins.manage';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'inventory.view';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'inventory.transfer.create';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'inventory.transfer.post';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'inventory.transfer.cancel';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'inventory.adjust.create';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'inventory.adjust.approve';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'approvals.view';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'approvals.decide';

-- ================================================================
-- 2) NEW ENUMS
-- ================================================================
DO $$ BEGIN
  CREATE TYPE public.stock_adjustment_reason AS ENUM ('count','damage','loss','found','correction','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.stock_adjustment_status AS ENUM ('draft','pending_approval','approved','posted','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_status AS ENUM ('pending','approved','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_entity AS ENUM ('stock_transfer','stock_adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_action AS ENUM ('post','cancel','delete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
