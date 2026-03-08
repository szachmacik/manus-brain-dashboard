/**
 * Manus Brain — główny router tRPC
 * Obsługuje: search, analytics, timeline, export, health check, stats, auto-tagging
 * Optymalizacja kredytów: cache SHA256, delta-only, batch queries
 */
import { z } from "zod";
import { desc, eq, gte, like, or, sql } from "drizzle-orm";
import { createHash } from "crypto";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  activityLog,
  searchCache,
  dataExports,
  tags,
  systemConfig,
  notifications,
  aiUsageLogs,
  users,
  type InsertActivityLog,
} from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { createClient } from "@supabase/supabase-js";

// Supabase client — baza doświadczeń
function getSupabase() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function hashQuery(query: string): string {
  return createHash("sha256").update(query.toLowerCase().trim()).digest("hex");
}

async function logActivity(entry: Omit<InsertActivityLog, "id" | "createdAt">) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(activityLog).values(entry);
  } catch {
    // Non-critical — don't fail the main operation
  }
}

// ─── ROUTER ─────────────────────────────────────────────────────────────────

export const brainRouter = router({

  // ── STATS — zagregowane statystyki dla OverviewPanel ──────────────────────
  stats: publicProcedure.query(async () => {
    const db = await getDb();
    const supabase = getSupabase();

    const [
      notifCount,
      aiCallsToday,
      activityCount,
      tagCount,
    ] = await Promise.all([
      db ? db.select({ count: sql<number>`count(*)` }).from(notifications).then(r => Number(r[0]?.count ?? 0)) : Promise.resolve(0),
      db ? db.select({ count: sql<number>`count(*)` }).from(aiUsageLogs)
            .where(gte(aiUsageLogs.createdAt, new Date(Date.now() - 86400000)))
            .then(r => Number(r[0]?.count ?? 0)) : Promise.resolve(0),
      db ? db.select({ count: sql<number>`count(*)` }).from(activityLog).then(r => Number(r[0]?.count ?? 0)) : Promise.resolve(0),
      db ? db.select({ count: sql<number>`count(*)` }).from(tags).then(r => Number(r[0]?.count ?? 0)) : Promise.resolve(0),
    ]);

    // Supabase stats
    let supabaseStats = { experiences: 0, notes: 0, projects: 0, patterns: 0, healthScore: 0 };
    if (supabase) {
      const [exp, notes, proj, pat, health] = await Promise.all([
        supabase.from("manus_experiences").select("id", { count: "exact", head: true }),
        supabase.from("manus_conversation_notes").select("id", { count: "exact", head: true }),
        supabase.from("manus_projects").select("id", { count: "exact", head: true }),
        supabase.from("manus_patterns").select("id", { count: "exact", head: true }),
        supabase.from("manus_system_health").select("overall_score").order("recorded_at", { ascending: false }).limit(1),
      ]);
      supabaseStats = {
        experiences: exp.count ?? 0,
        notes: notes.count ?? 0,
        projects: proj.count ?? 0,
        patterns: pat.count ?? 0,
        healthScore: health.data?.[0]?.overall_score ?? 0,
      };
    }

    return {
      notifications: notifCount,
      aiCallsToday,
      activityEvents: activityCount,
      tags: tagCount,
      ...supabaseStats,
    };
  }),

  // ── SEARCH — globalne wyszukiwanie z cache ────────────────────────────────
  search: publicProcedure
    .input(z.object({
      query: z.string().min(2).max(256),
      scope: z.array(z.enum(["experiences", "notes", "projects", "patterns", "procedures"])).default(["experiences", "notes", "projects", "patterns"]),
      limit: z.number().min(1).max(50).default(20),
      useCache: z.boolean().default(true),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const supabase = getSupabase();
      const qHash = hashQuery(input.query + JSON.stringify(input.scope));

      // Sprawdź cache
      if (input.useCache && db) {
        const cached = await db.select().from(searchCache)
          .where(eq(searchCache.queryHash, qHash))
          .limit(1);
        if (cached.length > 0 && cached[0] && new Date(cached[0].expiresAt) > new Date()) {
          // Inkrementuj hit count
          await db.update(searchCache)
            .set({ hitCount: sql`${searchCache.hitCount} + 1` })
            .where(eq(searchCache.queryHash, qHash));
          return { results: cached[0].results as SearchResult[], fromCache: true, hitCount: (cached[0].hitCount ?? 0) + 1 };
        }
      }

      const results: SearchResult[] = [];
      const q = input.query.toLowerCase();

      if (supabase) {
        // Wyszukiwanie równoległe w Supabase
        const searches = await Promise.allSettled([
          input.scope.includes("experiences")
            ? supabase.from("manus_experiences").select("id, title, description, category, tags, confidence_score").or(`title.ilike.%${q}%,description.ilike.%${q}%`).limit(input.limit)
            : Promise.resolve({ data: [] }),
          input.scope.includes("notes")
            ? supabase.from("manus_conversation_notes").select("id, topic, key_points, decisions, importance").or(`topic.ilike.%${q}%`).limit(input.limit)
            : Promise.resolve({ data: [] }),
          input.scope.includes("projects")
            ? supabase.from("manus_projects").select("id, name, description, status, tech_stack").or(`name.ilike.%${q}%,description.ilike.%${q}%`).limit(input.limit)
            : Promise.resolve({ data: [] }),
          input.scope.includes("patterns")
            ? supabase.from("manus_patterns").select("id, pattern_name, description, pattern_type, impact").or(`pattern_name.ilike.%${q}%,description.ilike.%${q}%`).limit(input.limit)
            : Promise.resolve({ data: [] }),
        ]);

        const [expRes, notesRes, projRes, patRes] = searches;

        if (expRes.status === "fulfilled" && expRes.value.data) {
          for (const item of expRes.value.data) {
            results.push({ type: "experience", id: item.id, title: item.title, snippet: item.description?.slice(0, 120) ?? "", meta: { category: item.category, confidence: item.confidence_score } });
          }
        }
        if (notesRes.status === "fulfilled" && notesRes.value.data) {
          for (const item of notesRes.value.data) {
            results.push({ type: "note", id: item.id, title: item.topic, snippet: Array.isArray(item.key_points) ? item.key_points.slice(0, 2).join(", ") : "", meta: { importance: item.importance } });
          }
        }
        if (projRes.status === "fulfilled" && projRes.value.data) {
          for (const item of projRes.value.data) {
            results.push({ type: "project", id: item.id, title: item.name, snippet: item.description?.slice(0, 120) ?? "", meta: { status: item.status, tech: item.tech_stack } });
          }
        }
        if (patRes.status === "fulfilled" && patRes.value.data) {
          for (const item of patRes.value.data) {
            results.push({ type: "pattern", id: item.id, title: item.pattern_name, snippet: item.description?.slice(0, 120) ?? "", meta: { type: item.pattern_type, impact: item.impact } });
          }
        }
      }

      // Zapisz do cache (TTL: 1 godzina)
      if (db && results.length > 0) {
        const expiresAt = new Date(Date.now() + 3600000);
        await db.insert(searchCache).values({
          queryHash: qHash,
          query: input.query,
          results: results as any,
          resultCount: results.length,
          hitCount: 0,
          expiresAt,
        }).onDuplicateKeyUpdate({
          set: { results: results as any, resultCount: results.length, expiresAt, hitCount: 0 },
        });
      }

      await logActivity({
        type: "note_added",
        title: `Wyszukiwanie: "${input.query}"`,
        description: `Znaleziono ${results.length} wyników w ${input.scope.join(", ")}`,
        entityType: "search",
        metadata: { query: input.query, resultCount: results.length },
        importance: 2,
      });

      return { results, fromCache: false, hitCount: 0 };
    }),

  // ── ANALYTICS — statystyki tygodniowe/miesięczne ──────────────────────────
  analytics: publicProcedure
    .input(z.object({
      period: z.enum(["7d", "30d", "90d"]).default("30d"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const supabase = getSupabase();

      const days = input.period === "7d" ? 7 : input.period === "30d" ? 30 : 90;
      const since = new Date(Date.now() - days * 86400000);

      // AI usage analytics z MySQL
      let aiStats = { totalCalls: 0, totalCost: 0, byProvider: {} as Record<string, number>, avgLatency: 0 };
      if (db) {
        const logs = await db.select().from(aiUsageLogs).where(gte(aiUsageLogs.createdAt, since));
        aiStats.totalCalls = logs.length;
        aiStats.totalCost = logs.reduce((sum, l) => sum + parseFloat(l.costUsd ?? "0"), 0);
        aiStats.avgLatency = logs.length > 0 ? Math.round(logs.reduce((sum, l) => sum + (l.latencyMs ?? 0), 0) / logs.length) : 0;
        for (const log of logs) {
          aiStats.byProvider[log.provider] = (aiStats.byProvider[log.provider] ?? 0) + 1;
        }
      }

      // Activity timeline z MySQL
      let activityTimeline: { date: string; count: number; types: Record<string, number> }[] = [];
      if (db) {
        const activities = await db.select().from(activityLog).where(gte(activityLog.createdAt, since)).orderBy(desc(activityLog.createdAt));
        const byDay: Record<string, { count: number; types: Record<string, number> }> = {};
        for (const a of activities) {
          const day = a.createdAt.toISOString().slice(0, 10);
          if (!byDay[day]) byDay[day] = { count: 0, types: {} };
          byDay[day].count++;
          byDay[day].types[a.type] = (byDay[day].types[a.type] ?? 0) + 1;
        }
        activityTimeline = Object.entries(byDay).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));
      }

      // Supabase analytics
      let supabaseGrowth = { newExperiences: 0, newNotes: 0, learningRuns: 0, avgHealthScore: 0 };
      if (supabase) {
        const [newExp, newNotes, runs, health] = await Promise.all([
          supabase.from("manus_experiences").select("id", { count: "exact", head: true }).gte("created_at", since.toISOString()),
          supabase.from("manus_conversation_notes").select("id", { count: "exact", head: true }).gte("created_at", since.toISOString()),
          supabase.from("manus_learning_runs").select("id", { count: "exact", head: true }).gte("started_at", since.toISOString()),
          supabase.from("manus_system_health").select("overall_score").gte("recorded_at", since.toISOString()),
        ]);
        const scores = health.data?.map((h: any) => h.overall_score).filter(Boolean) ?? [];
        supabaseGrowth = {
          newExperiences: newExp.count ?? 0,
          newNotes: newNotes.count ?? 0,
          learningRuns: runs.count ?? 0,
          avgHealthScore: scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0,
        };
      }

      // Notification stats
      let notifStats = { total: 0, unread: 0, byType: {} as Record<string, number> };
      if (db) {
        const notifs = await db.select().from(notifications).where(gte(notifications.sentAt, since));
        notifStats.total = notifs.length;
        notifStats.unread = notifs.filter(n => !n.isRead).length;
        for (const n of notifs) {
          notifStats.byType[n.type] = (notifStats.byType[n.type] ?? 0) + 1;
        }
      }

      return {
        period: input.period,
        since: since.toISOString(),
        ai: aiStats,
        activity: activityTimeline,
        growth: supabaseGrowth,
        notifications: notifStats,
      };
    }),

  // ── TIMELINE — oś czasu wszystkich aktywności ─────────────────────────────
  timeline: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().default(0),
      type: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const query = db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(input.limit).offset(input.offset);
      const countQuery = db.select({ count: sql<number>`count(*)` }).from(activityLog);

      const [items, countResult] = await Promise.all([query, countQuery]);
      return { items, total: Number(countResult[0]?.count ?? 0) };
    }),

  // ── HEALTH CHECK — sprawdzenie stanu systemu ──────────────────────────────
  healthCheck: publicProcedure.query(async () => {
    const db = await getDb();
    const supabase = getSupabase();
    const checks: { name: string; status: "ok" | "warn" | "error"; message: string; latencyMs: number }[] = [];

    // MySQL check
    const mysqlStart = Date.now();
    try {
      if (db) {
        await db.select({ count: sql<number>`1` }).from(users).limit(1);
        checks.push({ name: "MySQL Database", status: "ok", message: "Połączenie aktywne", latencyMs: Date.now() - mysqlStart });
      } else {
        checks.push({ name: "MySQL Database", status: "error", message: "Brak połączenia", latencyMs: 0 });
      }
    } catch (e) {
      checks.push({ name: "MySQL Database", status: "error", message: String(e), latencyMs: Date.now() - mysqlStart });
    }

    // Supabase check
    const sbStart = Date.now();
    try {
      if (supabase) {
        const { error } = await supabase.from("manus_experiences").select("id").limit(1);
        checks.push({ name: "Supabase (Brain DB)", status: error ? "error" : "ok", message: error ? error.message : "Połączenie aktywne", latencyMs: Date.now() - sbStart });
      } else {
        checks.push({ name: "Supabase (Brain DB)", status: "warn", message: "Brak kluczy SUPABASE_URL/SUPABASE_KEY", latencyMs: 0 });
      }
    } catch (e) {
      checks.push({ name: "Supabase (Brain DB)", status: "error", message: String(e), latencyMs: Date.now() - sbStart });
    }

    // VAPID check
    const vapidOk = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
    checks.push({ name: "Web Push (VAPID)", status: vapidOk ? "ok" : "warn", message: vapidOk ? "Klucze skonfigurowane" : "Brak kluczy VAPID", latencyMs: 0 });

    // AI providers check
    const providers = [
      { name: "Claude (Anthropic)", key: "ANTHROPIC_API_KEY" },
      { name: "Kimi (Moonshot)", key: "MOONSHOT_API_KEY" },
      { name: "DeepSeek", key: "DEEPSEEK_API_KEY" },
    ];
    for (const p of providers) {
      const hasKey = !!process.env[p.key];
      checks.push({ name: p.name, status: hasKey ? "ok" : "warn", message: hasKey ? "Klucz API skonfigurowany" : `Brak ${p.key} — używam Manus fallback`, latencyMs: 0 });
    }

    // Manus built-in check
    const manusOk = !!(process.env.BUILT_IN_FORGE_API_KEY && process.env.BUILT_IN_FORGE_API_URL);
    checks.push({ name: "Manus Built-in AI", status: manusOk ? "ok" : "error", message: manusOk ? "Aktywny (domyślny fallback)" : "Brak kluczy Manus", latencyMs: 0 });

    const overallStatus = checks.some(c => c.status === "error") ? "error" : checks.some(c => c.status === "warn") ? "warn" : "ok";
    const score = Math.round((checks.filter(c => c.status === "ok").length / checks.length) * 100);

    // Zapisz aktywność
    await logActivity({
      type: "health_check",
      title: `Health Check: ${score}% (${overallStatus.toUpperCase()})`,
      description: `${checks.filter(c => c.status === "ok").length}/${checks.length} serwisów OK`,
      metadata: { checks, score },
      importance: overallStatus === "error" ? 9 : overallStatus === "warn" ? 6 : 3,
    });

    return { status: overallStatus, score, checks, checkedAt: new Date().toISOString() };
  }),

  // ── EXPORT — eksport danych do JSON/CSV/Markdown ──────────────────────────
  export: publicProcedure
    .input(z.object({
      format: z.enum(["json", "csv", "markdown"]),
      scope: z.enum(["all", "experiences", "notes", "projects", "patterns", "analytics"]),
    }))
    .mutation(async ({ input }) => {
      const supabase = getSupabase();
      const db = await getDb();
      if (!supabase) return { error: "Brak połączenia z Supabase" };

      let data: any[] = [];
      let fileName = `manus-brain-${input.scope}-${new Date().toISOString().slice(0, 10)}`;

      // Pobierz dane
      if (input.scope === "experiences" || input.scope === "all") {
        const { data: exp } = await supabase.from("manus_experiences").select("*").limit(500);
        if (exp) data.push(...exp.map(e => ({ ...e, _type: "experience" })));
      }
      if (input.scope === "notes" || input.scope === "all") {
        const { data: notes } = await supabase.from("manus_conversation_notes").select("*").limit(500);
        if (notes) data.push(...notes.map(n => ({ ...n, _type: "note" })));
      }
      if (input.scope === "projects" || input.scope === "all") {
        const { data: proj } = await supabase.from("manus_projects").select("*").limit(100);
        if (proj) data.push(...proj.map(p => ({ ...p, _type: "project" })));
      }
      if (input.scope === "patterns" || input.scope === "all") {
        const { data: pat } = await supabase.from("manus_patterns").select("*").limit(200);
        if (pat) data.push(...pat.map(p => ({ ...p, _type: "pattern" })));
      }

      // Formatuj dane
      let content = "";
      let mimeType = "application/json";

      if (input.format === "json") {
        content = JSON.stringify({ exportedAt: new Date().toISOString(), scope: input.scope, count: data.length, data }, null, 2);
        fileName += ".json";
        mimeType = "application/json";
      } else if (input.format === "csv") {
        if (data.length > 0) {
          const keys = Object.keys(data[0]).filter(k => k !== "_type");
          const header = keys.join(",");
          const rows = data.map(row => keys.map(k => {
            const val = row[k];
            if (val === null || val === undefined) return "";
            const str = typeof val === "object" ? JSON.stringify(val) : String(val);
            return `"${str.replace(/"/g, '""')}"`;
          }).join(","));
          content = [header, ...rows].join("\n");
        }
        fileName += ".csv";
        mimeType = "text/csv";
      } else if (input.format === "markdown") {
        const lines = [`# Manus Brain Export — ${input.scope}`, ``, `**Eksportowano:** ${new Date().toLocaleString("pl-PL")}`, `**Rekordów:** ${data.length}`, ``];
        for (const item of data) {
          lines.push(`## ${item.title || item.name || item.topic || item.pattern_name || `Item ${item.id}`}`);
          lines.push(`**Typ:** ${item._type} | **ID:** ${item.id}`);
          if (item.description) lines.push(``, item.description);
          if (item.key_points) lines.push(``, `**Kluczowe punkty:** ${Array.isArray(item.key_points) ? item.key_points.join(", ") : item.key_points}`);
          lines.push(``);
        }
        content = lines.join("\n");
        fileName += ".md";
        mimeType = "text/markdown";
      }

      // Zapisz log eksportu
      if (db) {
        await db.insert(dataExports).values({
          format: input.format,
          scope: input.scope,
          fileName,
          recordCount: data.length,
          fileSizeBytes: Buffer.byteLength(content, "utf8"),
        });
      }

      await logActivity({
        type: "export_created",
        title: `Eksport: ${input.scope} → ${input.format.toUpperCase()}`,
        description: `${data.length} rekordów, ${Math.round(Buffer.byteLength(content, "utf8") / 1024)} KB`,
        entityType: "export",
        metadata: { format: input.format, scope: input.scope, count: data.length },
        importance: 4,
      });

      return { fileName, content, mimeType, recordCount: data.length, sizeBytes: Buffer.byteLength(content, "utf8") };
    }),

  // ── TAGS — zarządzanie tagami ─────────────────────────────────────────────
  getTags: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(tags).orderBy(desc(tags.usageCount));
  }),

  createTag: publicProcedure
    .input(z.object({
      name: z.string().min(1).max(64),
      color: z.string().default("#10b981"),
      category: z.string().default("general"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Brak połączenia z bazą danych");
      await db.insert(tags).values(input).onDuplicateKeyUpdate({ set: { color: input.color } });
      return { success: true };
    }),

  // ── SYSTEM CONFIG — konfiguracja systemu ──────────────────────────────────
  getConfig: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select({
      id: systemConfig.id,
      key: systemConfig.key,
      value: systemConfig.value,
      description: systemConfig.description,
      isSecret: systemConfig.isSecret,
      updatedAt: systemConfig.updatedAt,
    }).from(systemConfig).where(eq(systemConfig.isSecret, false));
  }),

  setConfig: publicProcedure
    .input(z.object({
      key: z.string().min(1).max(128),
      value: z.string(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Brak połączenia z bazą danych");
      await db.insert(systemConfig).values({
        key: input.key,
        value: input.value,
        description: input.description,
        isSecret: false,
      }).onDuplicateKeyUpdate({ set: { value: input.value, description: input.description } });
      return { success: true };
    }),

  // ── ACTIVITY LOG — dodawanie wpisów ──────────────────────────────────────
  addActivity: publicProcedure
    .input(z.object({
      type: z.enum(["note_added", "experience_learned", "pattern_detected", "project_updated", "learning_run", "push_sent", "ai_call", "export_created", "health_check", "procedure_updated"]),
      title: z.string().min(1).max(256),
      description: z.string().optional(),
      entityType: z.string().optional(),
      entityId: z.string().optional(),
      metadata: z.record(z.string(), z.any()).optional(),
      importance: z.number().min(1).max(10).default(5),
    }))
    .mutation(async ({ input }) => {
      await logActivity(input);
      return { success: true };
    }),

  // ── SEARCH CACHE STATS ────────────────────────────────────────────────────
  cacheStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, totalHits: 0, expired: 0 };
    const now = new Date();
    const all = await db.select().from(searchCache);
    return {
      total: all.length,
      totalHits: all.reduce((sum, c) => sum + (c.hitCount ?? 0), 0),
      expired: all.filter(c => new Date(c.expiresAt) < now).length,
      avgResultCount: all.length > 0 ? Math.round(all.reduce((sum, c) => sum + (c.resultCount ?? 0), 0) / all.length) : 0,
    };
  }),

  // ── EXPORT HISTORY ────────────────────────────────────────────────────────
  exportHistory: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(dataExports).orderBy(desc(dataExports.createdAt)).limit(20);
  }),

  // ── SAVE LEARNING RUN + AUTO-REINDEX ─────────────────────────────────────
  // Zapisuje nowy learning run do Supabase i automatycznie indeksuje
  // nowe doświadczenia wektorowo (TF-IDF embeddings)
  saveLearningRun: publicProcedure
    .input(z.object({
      status: z.enum(["success", "partial", "failed"]).default("success"),
      experiencesLearned: z.number().min(0).default(0),
      patternsDetected: z.number().min(0).default(0),
      cacheEntriesAdded: z.number().min(0).default(0),
      creditsUsed: z.number().min(0).default(0),
      durationMs: z.number().min(0).default(0),
      summary: z.string().optional(),
      metadata: z.record(z.string(), z.any()).optional(),
    }))
    .mutation(async ({ input }) => {
      const supabase = getSupabase();
      if (!supabase) return { success: false, error: "No Supabase", runId: null, vectorIndexed: 0 };

      // 1. Zapisz learning run do Supabase
      const { data: runData, error: runError } = await supabase
        .from("manus_learning_runs")
        .insert({
          status: input.status,
          experiences_learned: input.experiencesLearned,
          patterns_detected: input.patternsDetected,
          cache_entries_added: input.cacheEntriesAdded,
          credits_used: input.creditsUsed,
          duration_ms: input.durationMs,
          summary: input.summary ?? "",
          metadata: input.metadata ?? {},
          started_at: new Date(Date.now() - input.durationMs).toISOString(),
          completed_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (runError) {
        return { success: false, error: runError.message, runId: null, vectorIndexed: 0 };
      }

      // 2. Auto-reindeksowanie wektorowe: znajdź doświadczenia bez embeddings
      let vectorIndexed = 0;
      try {
        // Pobierz doświadczenia bez embeddings
        const { data: allExp } = await supabase
          .from("manus_experiences")
          .select("id, title, content, domain, tags")
          .eq("status", "active");

        const { data: existingEmb } = await supabase
          .from("manus_embeddings")
          .select("experience_id");

        const indexedIds = new Set((existingEmb ?? []).map((e: any) => e.experience_id));
        const toIndex = (allExp ?? []).filter((e: any) => !indexedIds.has(e.id));

        if (toIndex.length > 0) {
          // Generuj TF-IDF embeddings dla nowych doświadczeń
          const vocab = new Map<string, number>();
          const allTexts = (allExp ?? []).map((e: any) =>
            `${e.title} ${e.content ?? ""} ${(e.tags ?? []).join(" ")} ${e.domain ?? ""}`
              .toLowerCase().replace(/[^a-z0-9\s]/g, " ")
          );

          // Buduj słownik
          allTexts.forEach(text => {
            text.split(/\s+/).filter(Boolean).forEach(word => {
              if (!vocab.has(word)) vocab.set(word, vocab.size);
            });
          });

          // Ogranicz do 1536 wymiarów
          const vocabSize = Math.min(vocab.size, 1536);
          const vocabArr = Array.from(vocab.keys()).slice(0, vocabSize);

          // IDF
          const idf = new Array(vocabSize).fill(0);
          const N = allTexts.length;
          vocabArr.forEach((word, i) => {
            const df = allTexts.filter(t => t.includes(word)).length;
            idf[i] = Math.log((N + 1) / (df + 1)) + 1;
          });

          // Generuj embeddings dla nowych
          for (const exp of toIndex) {
            const text = `${exp.title} ${exp.content ?? ""} ${(exp.tags ?? []).join(" ")} ${exp.domain ?? ""}`
              .toLowerCase().replace(/[^a-z0-9\s]/g, " ");
            const words = text.split(/\s+/).filter(Boolean);
            const tf = new Array(vocabSize).fill(0);
            words.forEach(word => {
              const idx = vocabArr.indexOf(word);
              if (idx >= 0) tf[idx]++;
            });
            const tfidf = tf.map((v, i) => v * idf[i]);
            const norm = Math.sqrt(tfidf.reduce((s, v) => s + v * v, 0)) || 1;
            const embedding = tfidf.map(v => v / norm);

            await supabase.from("manus_embeddings").upsert({
              experience_id: exp.id,
              embedding: JSON.stringify(embedding),
              model: "tfidf-1536",
              dimensions: vocabSize,
              indexed_at: new Date().toISOString(),
            }, { onConflict: "experience_id" });

            vectorIndexed++;
          }
        }
      } catch (vectorErr) {
        // Non-critical — nie blokuj zapisu learning run
        console.error("[Auto-reindex] Error:", vectorErr);
      }

      // 3. Zaloguj aktywność
      await logActivity({
        type: "learning_run",
        title: `Learning run #${runData?.id ?? "?"} — ${input.status}`,
        description: input.summary ?? `${input.experiencesLearned} doświadczeń, ${vectorIndexed} nowych embeddings`,
        entityType: "learning_run",
        entityId: String(runData?.id ?? ""),
        metadata: { ...input.metadata, vectorIndexed },
        importance: input.status === "success" ? 7 : 4,
      });

      return {
        success: true,
        runId: runData?.id ?? null,
        vectorIndexed,
        message: vectorIndexed > 0
          ? `Run zapisany. Auto-reindeksowano ${vectorIndexed} nowych doświadczeń.`
          : "Run zapisany. Wszystkie doświadczenia już zindeksowane.",
      };
    }),
});

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface SearchResult {
  type: "experience" | "note" | "project" | "pattern";
  id: string | number;
  title: string;
  snippet: string;
  meta: Record<string, any>;
}
