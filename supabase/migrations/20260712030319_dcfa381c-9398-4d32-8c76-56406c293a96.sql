
-- Add layout columns for grid-based form builder
ALTER TABLE public.customer_field_definitions
  ADD COLUMN IF NOT EXISTS row_index INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS col_span INTEGER NOT NULL DEFAULT 12 CHECK (col_span BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS entity_key TEXT NOT NULL DEFAULT 'customers';

CREATE INDEX IF NOT EXISTS idx_customer_field_defs_entity_layout
  ON public.customer_field_definitions(entity_key, row_index, position);

-- Backfill row_index from existing position (group of 12-col rows)
UPDATE public.customer_field_definitions
SET row_index = position, col_span = 12
WHERE row_index = 0 AND position > 0;

-- Add unified permission alongside existing one
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'manage_form_fields';
