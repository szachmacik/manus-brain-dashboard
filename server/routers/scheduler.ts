/**
 * Manus Brain — Scheduler Router
 * Zarządza zaplanowanymi zadaniami: auto-reindeksowanie, snapshots, raporty
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ── TF-IDF embedding (identyczny jak w vector.ts) ────────────────────────────
function generateTFIDFEmbedding(text: string): number[] {
  const DIM = 1536;
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  const vector = new Array(DIM).fill(0);
  for (const [word, count] of Object.entries(freq)) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % DIM;
    const tfidf = (count / words.length) * Math.log(1 + 1 / (count + 1));
    vector[idx] += tfidf;
    // Spread to neighbors
    if (idx > 0) vector[idx - 1] += tfidf * 0.3;
    if (idx < DIM - 1) vector[idx + 1] += tfidf * 0.3;
  }
  const mag = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
  return mag > 0 ? vector.map((v) => v / mag) : vector;
}

// ── COSINE SIMILARITY ────────────────────────────────────────────────────────
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 0 ? dot / denom : 0;
}

// ── SCHEDULER ROUTER ─────────────────────────────────────────────────────────
export const schedulerRouter = router({

  // Status zaplanowanych zadań
  status: publicProcedure.query(async () => {
    const supabase = getSupabase();
    if (!supabase) return { jobs: [] };

    const { data: jobs } = await supabase
      .from("manus_scheduler_jobs")
      .select("*")
      .order("last_run_at", { ascending: false });

    return { jobs: jobs ?? [] };
  }),

  // Ręczne uruchomienie pełnego pipeline
  runFullPipeline: publicProcedure.mutation(async () => {
    const supabase = getSupabase();
    if (!supabase) return { success: false, error: "No Supabase connection" };

    const startTime = Date.now();
    const results: Record<string, any> = {};

    // 1. Indeksuj nowe doświadczenia
    const { data: experiences } = await supabase
      .from("manus_experiences")
      .select("id, title, summary, full_content, domain, category, tags")
      .eq("status", "active");

    const { data: existingEmb } = await supabase
      .from("manus_embeddings")
      .select("source_id, content_hash")
      .eq("source_type", "experience");

    const existingMap = new Map(existingEmb?.map((e) => [e.source_id, e.content_hash]) ?? []);

    let indexed = 0, skipped = 0, errors = 0;
    const allEmbeddings: { id: string; embedding: number[] }[] = [];

    for (const exp of experiences ?? []) {
      const text = [exp.title, exp.summary, exp.full_content, exp.domain, exp.category, ...(exp.tags ?? [])].join(" ");
      const contentHash = crypto.createHash("sha256").update(text).digest("hex");

      if (existingMap.get(exp.id) === contentHash) {
        skipped++;
        // Pobierz istniejący embedding
        const { data: embData } = await supabase
          .from("manus_embeddings")
          .select("embedding")
          .eq("source_id", exp.id)
          .single();
        if (embData?.embedding) {
          const parsed = typeof embData.embedding === "string"
            ? JSON.parse(embData.embedding)
            : embData.embedding;
          allEmbeddings.push({ id: exp.id, embedding: parsed });
        }
        continue;
      }

      const embedding = generateTFIDFEmbedding(text);
      allEmbeddings.push({ id: exp.id, embedding });

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
    }

    results.indexing = { indexed, skipped, errors };

    // 2. Rebuild semantic links
    const THRESHOLD = 0.15;
    const links: Array<{ source_id: string; target_id: string; similarity: number; link_type: string }> = [];

    for (let i = 0; i < allEmbeddings.length; i++) {
      for (let j = i + 1; j < allEmbeddings.length; j++) {
        const sim = cosineSimilarity(allEmbeddings[i].embedding, allEmbeddings[j].embedding);
        if (sim >= THRESHOLD) {
          links.push({
            source_id: allEmbeddings[i].id,
            target_id: allEmbeddings[j].id,
            similarity: Math.round(sim * 1000) / 1000,
            link_type: sim > 0.5 ? "strong" : sim > 0.3 ? "medium" : "weak",
          });
        }
      }
    }

    // Wyczyść stare linki i wstaw nowe
    await supabase.from("manus_semantic_links").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (links.length > 0) {
      await supabase.from("manus_semantic_links").insert(links);
    }
    results.links = { created: links.length };

    // 3. Snapshot klastrów
    const { data: clusters } = await supabase.from("manus_vector_clusters").select("*");
    const today = new Date().toISOString().split("T")[0];
    const { data: existingSnapshot } = await supabase
      .from("manus_cluster_history")
      .select("id")
      .eq("snapshot_date", today)
      .limit(1);

    if (!existingSnapshot || existingSnapshot.length === 0) {
      const rows = (clusters ?? []).map((c) => ({
        snapshot_date: today,
        cluster_name: c.name ?? "unknown",
        member_count: c.member_count ?? 0,
        keywords: c.keywords?.slice(0, 5) ?? [],
        dominant_domain: c.name ?? "unknown",
        avg_similarity: 0.3,
        new_members: 0,
        lost_members: 0,
      }));
      if (rows.length > 0) {
        await supabase.from("manus_cluster_history").insert(rows);
      }
      results.snapshot = { saved: rows.length };
    } else {
      results.snapshot = { saved: 0, message: "Already snapshotted today" };
    }

    // 4. Zapisz log uruchomienia
    await supabase.from("manus_scheduler_jobs").upsert({
      job_name: "full_pipeline",
      last_run_at: new Date().toISOString(),
      last_duration_ms: Date.now() - startTime,
      last_result: JSON.stringify(results),
      status: "success",
    }, { onConflict: "job_name" });

    return {
      success: true,
      duration_ms: Date.now() - startTime,
      results,
    };
  }),

  // Statystyki ostatnich uruchomień
  history: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ input }) => {
      const supabase = getSupabase();
      if (!supabase) return { runs: [] };

      const { data } = await supabase
        .from("manus_scheduler_jobs")
        .select("*")
        .order("last_run_at", { ascending: false })
        .limit(input.limit);

      return { runs: data ?? [] };
    }),
});
