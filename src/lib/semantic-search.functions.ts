import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const MODEL = "openai/text-embedding-3-small"; // 1536 dims

async function embed(text: string): Promise<number[]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model: MODEL, input: text, dimensions: 1536 }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embedding failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data[0].embedding;
}

export type SemanticHit = {
  entity: string;
  entity_id: string;
  title: string;
  subtitle: string | null;
  link: string;
  similarity: number;
};

export const semanticSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { q: string; limit?: number }) => {
    if (!data?.q || typeof data.q !== "string") throw new Error("q required");
    return { q: data.q.slice(0, 500), limit: Math.min(Math.max(data.limit ?? 8, 1), 20) };
  })
  .handler(async ({ data, context }) => {
    const vec = await embed(data.q);
    const { data: rows, error } = await context.supabase.rpc("match_search_embeddings", {
      _embedding: vec as unknown as string, // supabase-js serializes array to pgvector
      _limit: data.limit,
      _min_similarity: 0.15,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as SemanticHit[];
  });

// Reindex: pulls key rows from customers/quotes/workflow_templates/profiles,
// embeds them, and upserts into public.search_embeddings.
export const reindexSemanticSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { entity?: string } | undefined) => data ?? {})
  .handler(async ({ context }) => {
    // authorize: admin/owner only
    const { data: isAdmin } = await context.supabase.rpc("is_admin_or_owner", {
      _user_id: context.userId,
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const rows: {
      entity: string;
      entity_id: string;
      title: string;
      subtitle: string | null;
      link: string;
      content: string;
    }[] = [];

    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("id,name,name_ar,name_en,email,phone,tax_id,notes")
      .is("deleted_at", null)
      .limit(2000);
    for (const c of customers ?? []) {
      const title = c.name_ar || c.name_en || c.name || "";
      const subtitle = [c.email, c.phone, c.tax_id].filter(Boolean).join(" · ");
      const content = [title, c.name, c.name_ar, c.name_en, c.email, c.phone, c.tax_id, c.notes]
        .filter(Boolean)
        .join(" \n ");
      rows.push({
        entity: "customer",
        entity_id: c.id,
        title,
        subtitle: subtitle || null,
        link: `/customers?open=${c.id}`,
        content,
      });
    }

    const { data: quotes } = await supabaseAdmin
      .from("quotes")
      .select("id,supplier_name,reference_no,description")
      .is("deleted_at", null)
      .limit(2000);
    for (const q of quotes ?? []) {
      const title = q.supplier_name || q.reference_no || "Quote";
      rows.push({
        entity: "quote",
        entity_id: q.id,
        title,
        subtitle: q.reference_no || null,
        link: `/workflows?quote=${q.id}`,
        content: [q.supplier_name, q.reference_no, q.description].filter(Boolean).join(" \n "),
      });
    }

    const { data: templates } = await supabaseAdmin
      .from("workflow_templates")
      .select("id,name")
      .limit(2000);
    for (const t of templates ?? []) {
      rows.push({
        entity: "workflow",
        entity_id: t.id,
        title: t.name,
        subtitle: null,
        link: `/workflows?template=${t.id}`,
        content: t.name,
      });
    }

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name,email")
      .limit(2000);
    for (const p of profiles ?? []) {
      const title = p.full_name || p.email || "";
      rows.push({
        entity: "user",
        entity_id: p.id,
        title,
        subtitle: p.email,
        link: `/hr?user=${p.id}`,
        content: [p.full_name, p.email].filter(Boolean).join(" \n "),
      });
    }

    let indexed = 0;
    // Embed in batches of 96 (OpenAI supports arrays)
    const batchSize = 96;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize).filter((r) => r.content.trim());
      if (!batch.length) continue;

      const key = process.env.LOVABLE_API_KEY!;
      const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: MODEL,
          input: batch.map((r) => r.content.slice(0, 6000)),
          dimensions: 1536,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Embedding batch failed (${res.status}): ${body.slice(0, 200)}`);
      }
      const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };

      const upserts = json.data.map((d) => ({
        entity: batch[d.index].entity,
        entity_id: batch[d.index].entity_id,
        title: batch[d.index].title,
        subtitle: batch[d.index].subtitle,
        link: batch[d.index].link,
        content: batch[d.index].content.slice(0, 6000),
        embedding: d.embedding as unknown as string,
        model: MODEL,
        updated_at: new Date().toISOString(),
      }));

      const { error: upErr } = await supabaseAdmin
        .from("search_embeddings")
        .upsert(upserts, { onConflict: "entity,entity_id" });
      if (upErr) throw new Error(upErr.message);
      indexed += upserts.length;
    }

    return { indexed, total: rows.length };
  });
