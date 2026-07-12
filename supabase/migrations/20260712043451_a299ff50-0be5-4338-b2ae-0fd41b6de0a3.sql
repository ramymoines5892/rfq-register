
-- pgvector for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Embeddings table: one row per (entity, entity_id)
CREATE TABLE public.search_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id text NOT NULL,
  title text NOT NULL,
  subtitle text,
  link text NOT NULL,
  content text NOT NULL,
  embedding vector(1536) NOT NULL,
  model text NOT NULL DEFAULT 'openai/text-embedding-3-small',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity, entity_id)
);

GRANT SELECT ON public.search_embeddings TO authenticated;
GRANT ALL ON public.search_embeddings TO service_role;

ALTER TABLE public.search_embeddings ENABLE ROW LEVEL SECURITY;

-- Signed-in users can read (results are already restricted server-side to non-sensitive fields).
CREATE POLICY "Authenticated can read embeddings"
  ON public.search_embeddings FOR SELECT TO authenticated USING (true);

-- Writes are service-role only (server functions load supabaseAdmin).

CREATE INDEX search_embeddings_hnsw
  ON public.search_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE INDEX search_embeddings_entity_idx ON public.search_embeddings (entity);

-- Semantic match RPC
CREATE OR REPLACE FUNCTION public.match_search_embeddings(
  _embedding vector(1536),
  _limit int DEFAULT 8,
  _min_similarity float DEFAULT 0.2
)
RETURNS TABLE (
  entity text,
  entity_id text,
  title text,
  subtitle text,
  link text,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT e.entity, e.entity_id, e.title, e.subtitle, e.link,
         1 - (e.embedding <=> _embedding) AS similarity
  FROM public.search_embeddings e
  WHERE 1 - (e.embedding <=> _embedding) >= _min_similarity
  ORDER BY e.embedding <=> _embedding
  LIMIT _limit;
$$;
