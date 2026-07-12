
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS customers_name_trgm ON public.customers USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS customers_name_ar_trgm ON public.customers USING gin (name_ar extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS customers_name_en_trgm ON public.customers USING gin (name_en extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS customers_email_trgm ON public.customers USING gin (email extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS customers_phone_trgm ON public.customers USING gin (phone extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS customers_tax_id_trgm ON public.customers USING gin (tax_id extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS quotes_supplier_trgm ON public.quotes USING gin (supplier_name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS quotes_reference_trgm ON public.quotes USING gin (reference_no extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS quotes_description_trgm ON public.quotes USING gin (description extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS workflow_templates_name_trgm ON public.workflow_templates USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_full_name_trgm ON public.profiles USING gin (full_name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_email_trgm ON public.profiles USING gin (email extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS customers_user_created_idx ON public.customers (user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS quotes_user_created_idx ON public.quotes (user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS quotes_customer_created_idx ON public.quotes (customer_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS quotes_status_created_idx ON public.quotes (status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.global_search(_q text, _limit int DEFAULT 8)
RETURNS TABLE(entity text, id text, title text, subtitle text, link text, rank real)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  WITH q AS (SELECT COALESCE(NULLIF(BTRIM(_q), ''), '') AS s),
  cust AS (
    SELECT 'customer'::text AS entity, c.id::text AS id,
      COALESCE(c.name_ar, c.name_en, c.name) AS title,
      COALESCE(c.email, c.phone, c.tax_id, '') AS subtitle,
      '/customers?open=' || c.id::text AS link,
      GREATEST(
        similarity(COALESCE(c.name,''), (SELECT s FROM q)),
        similarity(COALESCE(c.name_ar,''), (SELECT s FROM q)),
        similarity(COALESCE(c.name_en,''), (SELECT s FROM q)),
        similarity(COALESCE(c.email,''), (SELECT s FROM q)),
        similarity(COALESCE(c.phone,''), (SELECT s FROM q)),
        similarity(COALESCE(c.tax_id,''), (SELECT s FROM q))
      )::real AS rank
    FROM public.customers c, q
    WHERE c.deleted_at IS NULL AND q.s <> '' AND (
      c.name ILIKE '%'||q.s||'%' OR c.name_ar ILIKE '%'||q.s||'%' OR c.name_en ILIKE '%'||q.s||'%'
      OR c.email ILIKE '%'||q.s||'%' OR c.phone ILIKE '%'||q.s||'%' OR c.tax_id ILIKE '%'||q.s||'%'
    )
    ORDER BY rank DESC LIMIT _limit
  ),
  qts AS (
    SELECT 'quote'::text, qu.id::text, qu.supplier_name,
      COALESCE(qu.reference_no, qu.description, ''),
      '/workflows?quote=' || qu.id::text,
      GREATEST(
        similarity(COALESCE(qu.supplier_name,''), (SELECT s FROM q)),
        similarity(COALESCE(qu.reference_no,''), (SELECT s FROM q)),
        similarity(COALESCE(qu.description,''), (SELECT s FROM q))
      )::real
    FROM public.quotes qu, q
    WHERE qu.deleted_at IS NULL AND q.s <> '' AND (
      qu.supplier_name ILIKE '%'||q.s||'%' OR qu.reference_no ILIKE '%'||q.s||'%' OR qu.description ILIKE '%'||q.s||'%'
    )
    ORDER BY 6 DESC LIMIT _limit
  ),
  wf AS (
    SELECT 'workflow'::text, wt.id::text, wt.name, ''::text,
      '/workflows?template=' || wt.id::text,
      similarity(COALESCE(wt.name,''), (SELECT s FROM q))::real
    FROM public.workflow_templates wt, q
    WHERE q.s <> '' AND wt.name ILIKE '%'||q.s||'%'
    ORDER BY 6 DESC LIMIT _limit
  ),
  usr AS (
    SELECT 'user'::text, p.id::text,
      COALESCE(p.full_name, p.email),
      COALESCE(p.email, ''),
      '/hr?user=' || p.id::text,
      GREATEST(
        similarity(COALESCE(p.full_name,''), (SELECT s FROM q)),
        similarity(COALESCE(p.email,''), (SELECT s FROM q))
      )::real
    FROM public.profiles p, q
    WHERE q.s <> '' AND (p.full_name ILIKE '%'||q.s||'%' OR p.email ILIKE '%'||q.s||'%')
    ORDER BY 6 DESC LIMIT _limit
  )
  SELECT * FROM cust
  UNION ALL SELECT * FROM qts
  UNION ALL SELECT * FROM wf
  UNION ALL SELECT * FROM usr;
$$;

GRANT EXECUTE ON FUNCTION public.global_search(text, int) TO authenticated;

CREATE TABLE IF NOT EXISTS public.search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query text NOT NULL,
  clicked_entity text,
  clicked_id text,
  clicked_link text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.search_history TO authenticated;
GRANT ALL ON public.search_history TO service_role;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own search history read" ON public.search_history;
DROP POLICY IF EXISTS "own search history insert" ON public.search_history;
DROP POLICY IF EXISTS "own search history delete" ON public.search_history;
CREATE POLICY "own search history read" ON public.search_history FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own search history insert" ON public.search_history FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own search history delete" ON public.search_history FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS search_history_user_created_idx ON public.search_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS search_history_user_link_idx ON public.search_history (user_id, clicked_link);
