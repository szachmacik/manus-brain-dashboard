/**
 * news.ts — tRPC router dla panelu Aktualności
 * Pobiera, filtruje i zarządza aktualnościami z manus_news
 */
import { z } from "zod";import { publicProcedure, router } from "../_core/trpc";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export const newsRouter = router({
  // ── LIST — lista aktualności z filtrowaniem ──────────────────────────────
  list: publicProcedure
    .input(
      z.object({
        category: z.string().optional(),
        unreadOnly: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const supabase = getSupabase();
      if (!supabase) return { items: [], total: 0 };

      let query = supabase
        .from("manus_news")
        .select("*", { count: "exact" })
        .order("importance", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(input?.limit ?? 20)
        .range(input?.offset ?? 0, (input?.offset ?? 0) + (input?.limit ?? 20) - 1);

      if (input?.category && input.category !== "all") {
        query = query.eq("category", input.category);
      }
      if (input?.unreadOnly) {
        query = query.eq("is_read", false);
      }

      const { data, error, count } = await query;
      if (error) return { items: [], total: 0 };
      return { items: data ?? [], total: count ?? 0 };
    }),

  // ── STATS — statystyki aktualności ──────────────────────────────────────
  stats: publicProcedure.query(async () => {
    const supabase = getSupabase();
    if (!supabase) return { total: 0, unread: 0, byCategory: [], highImportance: 0 };

    const [allData, unreadData, categoryData, highData] = await Promise.all([
      supabase.from("manus_news").select("id", { count: "exact" }),
      supabase.from("manus_news").select("id", { count: "exact" }).eq("is_read", false),
      supabase.from("manus_news").select("category"),
      supabase.from("manus_news").select("id", { count: "exact" }).gte("importance", 8),
    ]);

    // Count by category
    const catCounts: Record<string, number> = {};
    for (const row of categoryData.data ?? []) {
      catCounts[row.category] = (catCounts[row.category] || 0) + 1;
    }
    const byCategory = Object.entries(catCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    return {
      total: allData.count ?? 0,
      unread: unreadData.count ?? 0,
      byCategory,
      highImportance: highData.count ?? 0,
    };
  }),

  // ── MARK READ — oznacz jako przeczytane ─────────────────────────────────
  markRead: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const supabase = getSupabase();
      if (!supabase) return { success: false };
      const { error } = await supabase
        .from("manus_news")
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq("id", input.id);
      return { success: !error };
    }),

  // ── MARK ALL READ — oznacz wszystkie jako przeczytane ───────────────────
  markAllRead: publicProcedure.mutation(async () => {
    const supabase = getSupabase();
    if (!supabase) return { success: false, count: 0 };
    const { data, error } = await supabase
      .from("manus_news")
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq("is_read", false)
      .select("id");
    return { success: !error, count: data?.length ?? 0 };
  }),

  // ── ADD — dodaj nową aktualność ─────────────────────────────────────────
  add: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        summary: z.string().optional(),
        content: z.string().optional(),
        category: z.string().default("general"),
        source: z.string().optional(),
        source_url: z.string().url().optional(),
        tags: z.array(z.string()).default([]),
        importance: z.number().min(1).max(10).default(5),
        ai_insights: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const supabase = getSupabase();
      if (!supabase) return { success: false };
      const { error } = await supabase.from("manus_news").insert({
        ...input,
        is_read: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { success: !error };
    }),

  // ── DELETE — usuń aktualność ─────────────────────────────────────────────
  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const supabase = getSupabase();
      if (!supabase) return { success: false };
      const { error } = await supabase
        .from("manus_news")
        .delete()
        .eq("id", input.id);
      return { success: !error };
    }),

  // ── GENERATE INSIGHTS — AI insights dla aktualności ─────────────────────
  generateInsights: publicProcedure
    .input(z.object({ id: z.string().uuid(), title: z.string(), summary: z.string().optional() }))
    .mutation(async ({ input }) => {
      const supabase = getSupabase();
      if (!supabase) return { success: false, insights: "" };

      // Generuj AI insights przez Manus LLM
      try {
        const { invokeLLM } = await import("../_core/llm");
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "Jesteś asystentem analizującym aktualności technologiczne pod kątem projektu Manus Brain Dashboard. Odpowiadaj po polsku, zwięźle (max 2 zdania). Skup się na konkretnym wpływie na projekt.",
            },
            {
              role: "user",
              content: `Aktualność: "${input.title}"\n${input.summary ? `Opis: ${input.summary}` : ""}\n\nJaki jest bezpośredni wpływ tej aktualności na projekt Manus Brain Dashboard? Co warto zrobić?`,
            },
          ],
        });

        const insights = response?.choices?.[0]?.message?.content ?? "";
        if (insights) {
          await supabase
            .from("manus_news")
            .update({ ai_insights: insights, updated_at: new Date().toISOString() })
            .eq("id", input.id);
        }
        return { success: true, insights };
      } catch {
        return { success: false, insights: "" };
      }
    }),
});
