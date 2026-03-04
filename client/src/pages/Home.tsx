/*
 * MANUS BRAIN DASHBOARD — Home Page
 * Design: Dark Intelligence Dashboard
 * Syne (headings) + DM Sans (body) | Emerald accents | Sidebar + Grid
 */

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import Sidebar from "@/components/Sidebar";
import OverviewPanel from "@/components/OverviewPanel";
import ExperiencesPanel from "@/components/ExperiencesPanel";
import LearningRunsPanel from "@/components/LearningRunsPanel";
import BudgetPanel from "@/components/BudgetPanel";
import NotesPanel from "@/components/NotesPanel";

// Supabase client — read-only public access (ai-control-center)
const SUPABASE_URL = "https://qhscjlfavyqkaplcwhxu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoc2NqbGZhdnlxa2FwbGN3aHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzg1NDgsImV4cCI6MjA4Nzk1NDU0OH0.NWPX7OairlDx04bLZa0lGIccDmQ6BelJm-U5gHzcWt4";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type ActivePanel = "overview" | "experiences" | "runs" | "budget" | "notes";

export interface DashboardData {
  experiences: any[];
  latestRun: any | null;
  allRuns: any[];
  budget: any | null;
  notes: any[];
  stats: {
    totalExperiences: number;
    activeExperiences: number;
    totalRuns: number;
    cacheEntries: number;
    budgetUsedPct: number;
  };
  loading: boolean;
  error: string | null;
}

export default function Home() {
  const [activePanel, setActivePanel] = useState<ActivePanel>("overview");
  const [data, setData] = useState<DashboardData>({
    experiences: [],
    latestRun: null,
    allRuns: [],
    budget: null,
    notes: [],
    stats: { totalExperiences: 0, activeExperiences: 0, totalRuns: 0, cacheEntries: 0, budgetUsedPct: 0 },
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    try {
      const [expRes, runsRes, budgetRes, notesRes, cacheRes] = await Promise.all([
        supabase.from("manus_experiences").select("*").eq("status", "active").order("confidence", { ascending: false }).limit(50),
        supabase.from("manus_learning_runs").select("*").order("started_at", { ascending: false }).limit(20),
        supabase.from("manus_credit_budget").select("*").eq("period_type", "monthly").order("period_start", { ascending: false }).limit(1),
        supabase.from("manus_conversation_notes").select("*").order("created_at", { ascending: false }).limit(30),
        supabase.from("manus_knowledge_cache").select("id", { count: "exact", head: true }),
      ]);

      const experiences = expRes.data || [];
      const allRuns = runsRes.data || [];
      const budget = budgetRes.data?.[0] || null;
      const notes = notesRes.data || [];
      const cacheCount = cacheRes.count || 0;

      setData({
        experiences,
        latestRun: allRuns[0] || null,
        allRuns,
        budget,
        notes,
        stats: {
          totalExperiences: experiences.length,
          activeExperiences: experiences.filter((e: any) => e.status === "active").length,
          totalRuns: allRuns.length,
          cacheEntries: cacheCount,
          budgetUsedPct: budget ? Math.round((budget.spent_usd / budget.budget_usd) * 100) : 0,
        },
        loading: false,
        error: null,
      });
    } catch (err: any) {
      // Fallback do mock data przy błędzie połączenia
      console.warn("Supabase error, using demo data:", err.message);
      setData(generateMockData());
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // refresh co minutę
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-background grid-texture flex">
      <Sidebar activePanel={activePanel} onNavigate={setActivePanel} latestRun={data.latestRun} />

      <main className="flex-1 ml-0 lg:ml-60 min-h-screen overflow-auto">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-primary pulse-emerald" />
            <span className="text-sm text-muted-foreground font-mono">
              {data.loading ? "Ładowanie..." : data.error ? "Błąd połączenia — tryb demo" : "Połączono z Supabase"}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Budżet: <span className="text-foreground font-medium">{data.stats.budgetUsedPct}%</span></span>
            <span>Cache: <span className="text-foreground font-medium">{data.stats.cacheEntries}</span></span>
            <button
              onClick={fetchData}
              className="px-3 py-1 rounded border border-border hover:border-primary/50 hover:text-primary transition-colors text-xs"
            >
              Odśwież
            </button>
          </div>
        </header>

        {/* Panel content */}
        <div className="p-6">
          {activePanel === "overview" && <OverviewPanel data={data} onNavigate={setActivePanel} />}
          {activePanel === "experiences" && <ExperiencesPanel experiences={data.experiences} />}
          {activePanel === "runs" && <LearningRunsPanel runs={data.allRuns} />}
          {activePanel === "budget" && <BudgetPanel budget={data.budget} runs={data.allRuns} />}
          {activePanel === "notes" && <NotesPanel notes={data.notes} />}
        </div>
      </main>
    </div>
  );
}

// ─── Mock data dla trybu demo (bez Supabase) ─────────────────────────────────

function generateMockData(): DashboardData {
  const now = new Date();
  const experiences = [
    { id: "1", title: "Vercel wymaga NEXT_PUBLIC_ prefixu", summary: "Zmienne środowiskowe dostępne w przeglądarce muszą mieć prefix NEXT_PUBLIC_. Bez niego są undefined po stronie klienta.", category: "deployment", tags: ["vercel", "nextjs", "env"], confidence: 0.95, helpful_count: 8, harmful_count: 0, applied_count: 12, status: "active", created_at: new Date(now.getTime() - 7 * 86400000).toISOString() },
    { id: "2", title: "Supabase RLS blokuje bez policy", summary: "Row Level Security domyślnie blokuje wszystkie zapytania. Zawsze dodaj policy przed wdrożeniem lub wyłącz RLS dla tabel publicznych.", category: "security", tags: ["supabase", "rls", "postgres"], confidence: 0.92, helpful_count: 6, harmful_count: 1, applied_count: 9, status: "active", created_at: new Date(now.getTime() - 5 * 86400000).toISOString() },
    { id: "3", title: "Delta-only updates oszczędzają 80% kredytów", summary: "Przetwarzanie tylko nowych notatek (delta) zamiast całej bazy redukuje koszty AI o 60-90% przy zachowaniu tej samej jakości.", category: "workflow", tags: ["optimization", "credits", "rag"], confidence: 0.88, helpful_count: 5, harmful_count: 0, applied_count: 7, status: "active", created_at: new Date(now.getTime() - 3 * 86400000).toISOString() },
    { id: "4", title: "Batch processing: 8 notatek = 1 AI call", summary: "Grupowanie notatek w batche po 8 redukuje liczbę wywołań AI 8x. Kluczowa optymalizacja dla nocnych learning runs.", category: "coding", tags: ["batch", "openai", "optimization"], confidence: 0.85, helpful_count: 4, harmful_count: 0, applied_count: 5, status: "active", created_at: new Date(now.getTime() - 2 * 86400000).toISOString() },
    { id: "5", title: "Coolify wymaga health check endpoint", summary: "Aplikacje bez /health endpoint są restartowane przez Coolify co 30s. Zawsze dodaj prosty endpoint zwracający 200 OK.", category: "deployment", tags: ["coolify", "docker", "health"], confidence: 0.78, helpful_count: 3, harmful_count: 1, applied_count: 4, status: "active", created_at: new Date(now.getTime() - 1 * 86400000).toISOString() },
    { id: "6", title: "gpt-4.1-mini wystarczy do 95% zadań", summary: "Droższe modele rzadko dają lepsze wyniki dla rutynowych zadań. gpt-4.1-mini jest optymalny kosztowo dla syntezy i kompresji.", category: "workflow", tags: ["openai", "model-routing", "cost"], confidence: 0.82, helpful_count: 7, harmful_count: 0, applied_count: 10, status: "active", created_at: new Date(now.getTime() - 4 * 86400000).toISOString() },
  ];

  const runs = [
    { id: "r1", run_type: "nightly", status: "completed", notes_scanned: 12, notes_new: 5, experiences_added: 2, experiences_updated: 3, tokens_used: 1840, tokens_saved_cache: 6200, model_used: "gpt-4.1-mini", cost_estimate_usd: 0.0018, cache_hit_rate: 0.77, started_at: new Date(now.getTime() - 8 * 3600000).toISOString(), completed_at: new Date(now.getTime() - 8 * 3600000 + 45000).toISOString(), duration_seconds: 45, summary_md: "## Raport nocny\n\nDodano 2 nowe wnioski, zaktualizowano 3. Cache hit rate: 77%." },
    { id: "r2", run_type: "nightly", status: "completed", notes_scanned: 8, notes_new: 3, experiences_added: 1, experiences_updated: 2, tokens_used: 920, tokens_saved_cache: 3100, model_used: "gpt-4.1-mini", cost_estimate_usd: 0.0009, cache_hit_rate: 0.81, started_at: new Date(now.getTime() - 32 * 3600000).toISOString(), completed_at: new Date(now.getTime() - 32 * 3600000 + 32000).toISOString(), duration_seconds: 32 },
    { id: "r3", run_type: "nightly", status: "completed", notes_scanned: 15, notes_new: 8, experiences_added: 3, experiences_updated: 4, tokens_used: 2400, tokens_saved_cache: 4800, model_used: "gpt-4.1-mini", cost_estimate_usd: 0.0024, cache_hit_rate: 0.67, started_at: new Date(now.getTime() - 56 * 3600000).toISOString(), completed_at: new Date(now.getTime() - 56 * 3600000 + 67000).toISOString(), duration_seconds: 67 },
  ];

  const notes = [
    { id: "n1", topic: "Wdrożenie Manus Brain Dashboard", key_points: ["System bazy doświadczeń", "Optymalizacja kredytów", "Nocne uczenie się"], importance: 5, session_date: now.toISOString().split("T")[0], processed_at: null, tools_used: ["supabase", "vercel", "react"], created_at: now.toISOString() },
    { id: "n2", topic: "Konfiguracja Supabase RLS dla tabel publicznych", key_points: ["RLS blokuje bez policy", "Dodano policy dla manus_*"], importance: 4, session_date: new Date(now.getTime() - 86400000).toISOString().split("T")[0], processed_at: new Date(now.getTime() - 8 * 3600000).toISOString(), tools_used: ["supabase", "postgresql"], created_at: new Date(now.getTime() - 86400000).toISOString() },
    { id: "n3", topic: "Optymalizacja kosztów OpenAI — batch processing", key_points: ["Batch 8 notatek = 1 call", "Cache TTL 30 dni"], importance: 4, session_date: new Date(now.getTime() - 2 * 86400000).toISOString().split("T")[0], processed_at: new Date(now.getTime() - 32 * 3600000).toISOString(), tools_used: ["openai", "python"], created_at: new Date(now.getTime() - 2 * 86400000).toISOString() },
  ];

  const budget = {
    id: "b1", period_type: "monthly", budget_usd: 5.0, spent_usd: 0.0051, tokens_budget: 500000, tokens_used: 5160,
    period_start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
    period_end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0],
    alert_threshold: 0.8, is_alert_sent: false, is_paused: false,
    model_config: { simple_task: "gpt-4.1-nano", standard_task: "gpt-4.1-mini", max_tokens_per_call: 2000, cache_ttl_days: 30, batch_size: 8 }
  };

  return {
    experiences,
    latestRun: runs[0],
    allRuns: runs,
    budget,
    notes,
    stats: {
      totalExperiences: experiences.length,
      activeExperiences: experiences.length,
      totalRuns: runs.length,
      cacheEntries: 24,
      budgetUsedPct: Math.round((budget.spent_usd / budget.budget_usd) * 100),
    },
    loading: false,
    error: null,
  };
}
