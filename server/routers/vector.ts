/**
 * Manus Brain — Vector Router
 * Semantic search, similar experiences, knowledge clusters
 * Używa pgvector (Supabase) + TF-IDF embeddings (bez zewnętrznych kluczy)
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── TF-IDF EMBEDDING ────────────────────────────────────────────────────────

const DOMAIN_KEYWORDS: Record<string, number[]> = {
  react: [0, 1, 2], component: [3, 4], hook: [5, 6], state: [7, 8],
  typescript: [9, 10], css: [11, 12], tailwind: [13, 14], vite: [15],
  api: [20, 21], server: [22, 23], database: [24, 25], sql: [26, 27],
  supabase: [28, 29], trpc: [30, 31], express: [32], node: [33],
  embedding: [40, 41], vector: [42, 43], model: [44, 45], llm: [46, 47],
  ai: [48, 49], neural: [50, 51], semantic: [52, 53], similarity: [54],
  security: [60, 61], auth: [62, 63], token: [64, 65], jwt: [66, 67],
  encryption: [68], password: [69], oauth: [70],
  performance: [80, 81], cache: [82, 83], optimization: [84, 85],
  speed: [86], latency: [87], memory: [88], cpu: [89],
  architecture: [100, 101], pattern: [102, 103], design: [104, 105],
  microservice: [106], monolith: [107], scalable: [108],
  deploy: [120, 121], docker: [122, 123], kubernetes: [124], ci: [125],
  github: [126], vercel: [127], manus: [128, 129],
  data: [140, 141], schema: [142, 143], migration: [144], index: [145],
  query: [146], join: [147], aggregate: [148],
  error: [160, 161], exception: [162], retry: [163], fallback: [164],
  debug: [165], log: [166], monitor: [167],
  test: [180, 181], vitest: [182], unit: [183], integration: [184],
  mock: [185], coverage: [186],
};

function generateTFIDFEmbedding(text: string, dim = 1536): number[] {
  const tokens = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const tf: Record<string, number> = {};
  for (const token of tokens) tf[token] = (tf[token] || 0) + 1;
  const maxTF = Math.max(...Object.values(tf), 1);

  const embedding = new Array(dim).fill(0);

  for (const [word, dims] of Object.entries(DOMAIN_KEYWORDS)) {
    const wordTF = (tf[word] || 0) / maxTF;
    if (wordTF > 0) {
      for (const d of dims) {
        if (d < dim) embedding[d] += wordTF;
      }
    }
  }

  let seed = 0;
  for (const token of tokens) {
    for (let i = 0; i < token.length; i++) {
      seed = (seed * 31 + token.charCodeAt(i)) & 0xffffffff;
    }
  }
  for (let i = 200; i < dim; i++) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    embedding[i] = ((seed & 0xffff) / 0x8000 - 1) * 0.1;
  }

  let norm = 0;
  for (const v of embedding) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return embedding.map((v) => v / norm);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

// ─── ROUTER ─────────────────────────────────────────────────────────────────

export const vectorRouter = router({
  // ── STATS — statystyki bazy wektorowej ───────────────────────────────────
  stats: publicProcedure.query(async () => {
    const supabase = getSupabase();
    if (!supabase) return { embeddings: 0, links: 0, clusters: 0, coverage: 0 };

    const [embCount, linkCount, clusterCount, expCount] = await Promise.all([
      supabase.from("manus_embeddings").select("id", { count: "exact", head: true }),
      supabase.from("manus_semantic_links").select("id", { count: "exact", head: true }),
      supabase.from("manus_vector_clusters").select("id", { count: "exact", head: true }),
      supabase.from("manus_experiences").select("id", { count: "exact", head: true }).eq("status", "active"),
    ]);

    const totalExp = expCount.count ?? 0;
    const indexedExp = embCount.count ?? 0;

    return {
      embeddings: indexedExp,
      links: linkCount.count ?? 0,
      clusters: clusterCount.count ?? 0,
      coverage: totalExp > 0 ? Math.round((indexedExp / totalExp) * 100) : 0,
    };
  }),

  // ── SEMANTIC SEARCH — szukaj podobnych doświadczeń ───────────────────────
  semanticSearch: publicProcedure
    .input(z.object({
      query: z.string().min(2).max(500),
      limit: z.number().min(1).max(20).default(5),
      threshold: z.number().min(0).max(1).default(0.1),
    }))
    .query(async ({ input }) => {
      const supabase = getSupabase();
      if (!supabase) return { results: [], query: input.query, totalFound: 0 };

      // Generuj embedding dla zapytania
      const queryEmbedding = generateTFIDFEmbedding(input.query);

      // Pobierz wszystkie embeddings
      const { data: embs, error } = await supabase
        .from("manus_embeddings")
        .select("id, source_id, source_type, embedding")
        .eq("source_type", "experience");

      if (error || !embs) return { results: [], query: input.query, totalFound: 0 };

      // Oblicz similarity dla każdego
      const scored = embs.map((emb) => {
        const vec = typeof emb.embedding === "string"
          ? JSON.parse(emb.embedding)
          : emb.embedding;
        const sim = cosineSimilarity(queryEmbedding, vec);
        return { embId: emb.id, sourceId: emb.source_id, similarity: sim };
      });

      // Filtruj i sortuj
      const filtered = scored
        .filter((s) => s.similarity > input.threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, input.limit);

      if (filtered.length === 0) return { results: [], query: input.query, totalFound: 0 };

      // Pobierz pełne dane doświadczeń
      const sourceIds = filtered.map((f) => f.sourceId);
      const { data: experiences } = await supabase
        .from("manus_experiences")
        .select("id, title, summary, domain, category, tags, confidence, helpful_count")
        .in("id", sourceIds);

      const results = filtered.map((f) => {
        const exp = experiences?.find((e) => e.id === f.sourceId);
        return {
          id: f.sourceId,
          embeddingId: f.embId,
          similarity: Math.round(f.similarity * 1000) / 1000,
          title: exp?.title ?? "Unknown",
          summary: exp?.summary ?? "",
          domain: exp?.domain ?? "",
          category: exp?.category ?? "",
          tags: exp?.tags ?? [],
          confidence: exp?.confidence ?? 0,
          helpfulCount: exp?.helpful_count ?? 0,
        };
      });

      return { results, query: input.query, totalFound: results.length };
    }),

  // ── SIMILAR — znajdź podobne do danego doświadczenia ─────────────────────
  findSimilar: publicProcedure
    .input(z.object({
      experienceId: z.string().uuid(),
      limit: z.number().min(1).max(10).default(5),
    }))
    .query(async ({ input }) => {
      const supabase = getSupabase();
      if (!supabase) return [];

      // Pobierz embedding dla danego doświadczenia
      const { data: sourceEmb } = await supabase
        .from("manus_embeddings")
        .select("id, embedding")
        .eq("source_type", "experience")
        .eq("source_id", input.experienceId)
        .single();

      if (!sourceEmb) return [];

      const sourceVec = typeof sourceEmb.embedding === "string"
        ? JSON.parse(sourceEmb.embedding)
        : sourceEmb.embedding;

      // Pobierz wszystkie inne embeddings
      const { data: allEmbs } = await supabase
        .from("manus_embeddings")
        .select("id, source_id, embedding")
        .eq("source_type", "experience")
        .neq("source_id", input.experienceId);

      if (!allEmbs) return [];

      const scored = allEmbs.map((emb) => {
        const vec = typeof emb.embedding === "string"
          ? JSON.parse(emb.embedding)
          : emb.embedding;
        return {
          sourceId: emb.source_id,
          similarity: cosineSimilarity(sourceVec, vec),
        };
      });

      const top = scored
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, input.limit);

      const { data: experiences } = await supabase
        .from("manus_experiences")
        .select("id, title, summary, domain, category, tags")
        .in("id", top.map((t) => t.sourceId));

      return top.map((t) => {
        const exp = experiences?.find((e) => e.id === t.sourceId);
        return {
          id: t.sourceId,
          similarity: Math.round(t.similarity * 1000) / 1000,
          title: exp?.title ?? "Unknown",
          summary: exp?.summary ?? "",
          domain: exp?.domain ?? "",
          tags: exp?.tags ?? [],
        };
      });
    }),

  // ── CLUSTERS — klastry semantyczne ───────────────────────────────────────
  clusters: publicProcedure.query(async () => {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data: clusters } = await supabase
      .from("manus_vector_clusters")
      .select("id, name, description, member_count, keywords, created_at")
      .order("member_count", { ascending: false });

    return clusters ?? [];
  }),

  // ── KNOWLEDGE GRAPH — dane dla wizualizacji grafu ─────────────────────────
  knowledgeGraph: publicProcedure.query(async () => {
    const supabase = getSupabase();
    if (!supabase) return { nodes: [], edges: [] };

    const [embs, links, experiences] = await Promise.all([
      supabase.from("manus_embeddings").select("id, source_id, source_type"),
      supabase.from("manus_semantic_links").select("source_id, target_id, similarity, link_type"),
      supabase.from("manus_experiences").select("id, title, domain, category, confidence"),
    ]);

    const nodes = (embs.data ?? []).map((emb) => {
      const exp = experiences.data?.find((e) => e.id === emb.source_id);
      return {
        id: emb.id,
        sourceId: emb.source_id,
        label: exp?.title?.substring(0, 40) ?? "Unknown",
        domain: exp?.domain ?? "unknown",
        category: exp?.category ?? "general",
        confidence: exp?.confidence ?? 0,
      };
    });

    const edges = (links.data ?? []).map((link) => ({
      source: link.source_id,
      target: link.target_id,
      similarity: link.similarity,
      type: link.link_type,
    }));

    return { nodes, edges };
  }),

  // ── INDEX — indeksuj nowe doświadczenia (delta-only) ──────────────────────
  indexNew: publicProcedure.mutation(async () => {
    const supabase = getSupabase();
    if (!supabase) return { indexed: 0, skipped: 0, errors: 0 };

    // Pobierz doświadczenia bez embeddings
    const { data: experiences } = await supabase
      .from("manus_experiences")
      .select("id, title, summary, domain, category, tags")
      .eq("status", "active");

    if (!experiences) return { indexed: 0, skipped: 0, errors: 0 };

    const { data: existingEmbs } = await supabase
      .from("manus_embeddings")
      .select("source_id, content_hash")
      .eq("source_type", "experience");

    const existingMap = new Map(
      (existingEmbs ?? []).map((e) => [e.source_id, e.content_hash])
    );

    let indexed = 0, skipped = 0, errors = 0;

    for (const exp of experiences) {
      const text = [exp.title, exp.summary, exp.domain, exp.category, (exp.tags ?? []).join(" ")]
        .filter(Boolean).join(" | ");
      const contentHash = crypto.createHash("sha256").update(text).digest("hex");

      if (existingMap.get(exp.id) === contentHash) {
        skipped++;
        continue;
      }

      try {
        const embedding = generateTFIDFEmbedding(text);
        const { error } = await supabase.from("manus_embeddings").upsert({
          source_type: "experience",
          source_id: exp.id,
          content_hash: contentHash,
          embedding: `[${embedding.join(",")}]`,
          model_used: "tfidf-v1",
          updated_at: new Date().toISOString(),
        }, { onConflict: "source_type,source_id" });

        if (error) errors++;
        else indexed++;
      } catch {
        errors++;
      }
    }

    return { indexed, skipped, errors };
  }),

  // ── CLUSTER EVOLUTION — historia zmian klastrów w czasie ─────────────────
  clusterEvolution: publicProcedure
    .input(z.object({
      days: z.number().min(1).max(90).default(7),
    }))
    .query(async ({ input }) => {
      const supabase = getSupabase();
      if (!supabase) return { history: [], clusters: [], trend: [] };

      const since = new Date();
      since.setDate(since.getDate() - input.days);
      const sinceStr = since.toISOString().split("T")[0];

      const { data: history } = await supabase
        .from("manus_cluster_history")
        .select("*")
        .gte("snapshot_date", sinceStr)
        .order("snapshot_date", { ascending: true });

      if (!history || history.length === 0) return { history: [], clusters: [], trend: [] };

      // Unikalne nazwy klastrów
      const clusterNames = Array.from(new Set(history.map((h) => h.cluster_name)));

      // Trend per klaster (ostatni vs pierwszy snapshot)
      const trend = clusterNames.map((name) => {
        const clusterHistory = history.filter((h) => h.cluster_name === name);
        const first = clusterHistory[0];
        const last = clusterHistory[clusterHistory.length - 1];
        const growth = last && first ? last.member_count - first.member_count : 0;
        const avgSim = clusterHistory.reduce((s, h) => s + (h.avg_similarity ?? 0), 0) / clusterHistory.length;
        return {
          name,
          firstCount: first?.member_count ?? 0,
          lastCount: last?.member_count ?? 0,
          growth,
          growthPct: first?.member_count ? Math.round((growth / first.member_count) * 100) : 0,
          avgSimilarity: Math.round(avgSim * 1000) / 1000,
          totalNewMembers: clusterHistory.reduce((s, h) => s + (h.new_members ?? 0), 0),
        };
      });

      // Timeline data — per dzień, suma wszystkich klastrów
      const dateMap: Record<string, { date: string; totalMembers: number; clusterCount: number }> = {};
      for (const h of history) {
        const d = h.snapshot_date as string;
        if (!dateMap[d]) dateMap[d] = { date: d, totalMembers: 0, clusterCount: 0 };
        dateMap[d].totalMembers += h.member_count ?? 0;
        dateMap[d].clusterCount++;
      }

      return {
        history,
        clusters: clusterNames,
        trend: trend.sort((a, b) => b.lastCount - a.lastCount),
        timeline: Object.values(dateMap),
      };
    }),

  // ── SNAPSHOT — zapisz aktualny stan klastrów do historii ─────────────────
  snapshotClusters: publicProcedure.mutation(async () => {
    const supabase = getSupabase();
    if (!supabase) return { saved: 0 };

    const { data: clusters } = await supabase
      .from("manus_vector_clusters")
      .select("*");

    if (!clusters || clusters.length === 0) return { saved: 0 };

    const today = new Date().toISOString().split("T")[0];

    // Sprawdź czy snapshot z dzisiaj już istnieje
    const { data: existing } = await supabase
      .from("manus_cluster_history")
      .select("id")
      .eq("snapshot_date", today)
      .limit(1);

    if (existing && existing.length > 0) return { saved: 0, message: "Snapshot already exists for today" };

    const rows = clusters.map((c) => ({
      snapshot_date: today,
      cluster_name: c.name ?? "unknown",
      member_count: c.member_count ?? 0,
      keywords: c.keywords?.slice(0, 5) ?? [],
      dominant_domain: c.name ?? "unknown",
      avg_similarity: 0.3,
      new_members: 0,
      lost_members: 0,
    }));

    const { error } = await supabase.from("manus_cluster_history").insert(rows);
    return { saved: error ? 0 : rows.length, error: error?.message };
  }),
  // ── EXPORT GRAPH — eksport grafu wiedzy do Gephi/Cytoscape ─────────────────────────────
  exportGraph: publicProcedure
    .input(z.object({
      format: z.enum(["gexf", "graphml", "json", "cytoscape"]).default("json"),
    }))
    .query(async ({ input }) => {
      const supabase = getSupabase();
      if (!supabase) return { format: input.format, content: "", nodeCount: 0, edgeCount: 0 };

      // Pobierz węzły (doświadczenia) i krawędzie (semantic links)
      const [expData, linkData, clusterData] = await Promise.all([
        supabase.from("manus_experiences").select("id, title, domain, status, created_at").eq("status", "active"),
        supabase.from("manus_semantic_links").select("source_id, target_id, similarity, link_type"),
        supabase.from("manus_vector_clusters").select("id, name, member_ids, member_count"),
      ]);

      const nodes = expData.data ?? [];
      const edges = linkData.data ?? [];
      const clusters = clusterData.data ?? [];

      // Mapuj doświadczenia do klastrów
      const nodeCluster: Record<string, string> = {};
      for (const cluster of clusters) {
        const members: string[] = Array.isArray(cluster.member_ids)
          ? cluster.member_ids
          : (typeof cluster.member_ids === "string" ? JSON.parse(cluster.member_ids) : []);
        for (const memberId of members) {
          nodeCluster[String(memberId)] = cluster.name ?? "unknown";
        }
      }

      let content = "";

      if (input.format === "gexf") {
        // GEXF format (Gephi)
        const nodeXml = nodes.map(n =>
          `    <node id="${n.id}" label="${n.title?.replace(/"/g, "&quot;") ?? ""}">\n` +
          `      <attvalues>\n` +
          `        <attvalue for="domain" value="${n.domain ?? "unknown"}" />\n` +
          `        <attvalue for="cluster" value="${nodeCluster[String(n.id)] ?? "none"}" />\n` +
          `        <attvalue for="created_at" value="${n.created_at ?? ""}" />\n` +
          `      </attvalues>\n` +
          `    </node>`
        ).join("\n");
        const edgeXml = edges.map((e, i) =>
          `    <edge id="${i}" source="${e.source_id}" target="${e.target_id}" weight="${e.similarity?.toFixed(4) ?? "0"}" type="${e.link_type ?? "undirected"}" />`
        ).join("\n");
        content = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<gexf xmlns="http://gexf.net/1.3" version="1.3">`,
          `  <meta lastmodifieddate="${new Date().toISOString().split("T")[0]}">`,
          `    <creator>Manus Brain Dashboard</creator>`,
          `    <description>Semantic Knowledge Graph</description>`,
          `  </meta>`,
          `  <graph defaultedgetype="undirected">`,
          `    <attributes class="node">`,
          `      <attribute id="domain" title="Domain" type="string" />`,
          `      <attribute id="cluster" title="Cluster" type="string" />`,
          `      <attribute id="created_at" title="Created At" type="string" />`,
          `    </attributes>`,
          `    <nodes>`,
          nodeXml,
          `    </nodes>`,
          `    <edges>`,
          edgeXml,
          `    </edges>`,
          `  </graph>`,
          `</gexf>`,
        ].join("\n");
      } else if (input.format === "graphml") {
        // GraphML format (Cytoscape, yEd)
        const keyDefs = [
          `  <key id="d0" for="node" attr.name="domain" attr.type="string" />`,
          `  <key id="d1" for="node" attr.name="cluster" attr.type="string" />`,
          `  <key id="d2" for="edge" attr.name="weight" attr.type="double" />`,
          `  <key id="d3" for="edge" attr.name="link_type" attr.type="string" />`,
        ].join("\n");
        const nodeXml = nodes.map(n =>
          `  <node id="${n.id}">\n` +
          `    <data key="d0">${n.domain ?? "unknown"}</data>\n` +
          `    <data key="d1">${nodeCluster[String(n.id)] ?? "none"}</data>\n` +
          `  </node>`
        ).join("\n");
        const edgeXml = edges.map((e, i) =>
          `  <edge id="e${i}" source="${e.source_id}" target="${e.target_id}">\n` +
          `    <data key="d2">${e.similarity?.toFixed(4) ?? "0"}</data>\n` +
          `    <data key="d3">${e.link_type ?? "undirected"}</data>\n` +
          `  </edge>`
        ).join("\n");
        content = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<graphml xmlns="http://graphml.graphdrawing.org/graphml">`,
          keyDefs,
          `  <graph id="G" edgedefault="undirected">`,
          nodeXml,
          edgeXml,
          `  </graph>`,
          `</graphml>`,
        ].join("\n");
      } else if (input.format === "cytoscape") {
        // Cytoscape.js JSON format
        const cytoscapeData = {
          elements: {
            nodes: nodes.map(n => ({
              data: {
                id: String(n.id),
                label: n.title ?? "",
                domain: n.domain ?? "unknown",
                cluster: nodeCluster[String(n.id)] ?? "none",
              },
            })),
            edges: edges.map((e, i) => ({
              data: {
                id: `e${i}`,
                source: String(e.source_id),
                target: String(e.target_id),
                weight: e.similarity ?? 0,
                type: e.link_type ?? "semantic",
              },
            })),
          },
        };
        content = JSON.stringify(cytoscapeData, null, 2);
      } else {
        // JSON format (default)
        content = JSON.stringify({
          metadata: {
            generated_at: new Date().toISOString(),
            generator: "Manus Brain Dashboard",
            node_count: nodes.length,
            edge_count: edges.length,
            cluster_count: clusters.length,
          },
          nodes: nodes.map(n => ({
            id: n.id,
            label: n.title,
            domain: n.domain,
            cluster: nodeCluster[String(n.id)] ?? "none",
            created_at: n.created_at,
          })),
          edges: edges.map(e => ({
            source: e.source_id,
            target: e.target_id,
            weight: e.similarity,
            type: e.link_type,
          })),
          clusters: clusters.map(c => ({
            id: c.id,
            name: c.name,
            member_count: c.member_count,
          })),
        }, null, 2);
      }

      return {
        format: input.format,
        content,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        clusterCount: clusters.length,
      };
    }),

  
  // ── COVERAGE — ile doświadczeń ma embeddings ──────────────────────────────────────────────
  coverage: publicProcedure.query(async () => {
    const supabase = getSupabase();
    if (!supabase) return { total: 0, indexed: 0, percentage: 0, byDomain: [] };

    const [expData, embData] = await Promise.all([
      supabase.from("manus_experiences").select("id, domain").eq("status", "active"),
      supabase.from("manus_embeddings").select("source_id").eq("source_type", "experience"),
    ]);

    const total = expData.data?.length ?? 0;
    const indexed = embData.data?.length ?? 0;
    const indexedIds = new Set(embData.data?.map((e) => e.source_id) ?? []);

    // Pokrycie per domena
    const domainMap: Record<string, { total: number; indexed: number }> = {};
    for (const exp of expData.data ?? []) {
      const d = exp.domain ?? "unknown";
      if (!domainMap[d]) domainMap[d] = { total: 0, indexed: 0 };
      domainMap[d].total++;
      if (indexedIds.has(exp.id)) domainMap[d].indexed++;
    }

    const byDomain = Object.entries(domainMap).map(([domain, stats]) => ({
      domain,
      total: stats.total,
      indexed: stats.indexed,
      percentage: stats.total > 0 ? Math.round((stats.indexed / stats.total) * 100) : 0,
    }));

    return {
      total,
      indexed,
      percentage: total > 0 ? Math.round((indexed / total) * 100) : 0,
      byDomain,
    };
  }),
});
