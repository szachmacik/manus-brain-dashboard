/*
 * MANUS BRAIN DASHBOARD — Home Page v2
 * Design: Dark Intelligence Dashboard
 * Syne (headings) + DM Sans (body) | Emerald accents | Sidebar + Grid
 * Nowe: health score, knowledge graph, domain metrics, projects, patterns
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { createClient } from "@supabase/supabase-js";
import Sidebar from "@/components/Sidebar";
import OverviewPanel from "@/components/OverviewPanel";
import ExperiencesPanel from "@/components/ExperiencesPanel";
import LearningRunsPanel from "@/components/LearningRunsPanel";
import BudgetPanel from "@/components/BudgetPanel";
import NotesPanel from "@/components/NotesPanel";
import ProjectsPanel from "@/components/ProjectsPanel";
import PatternsPanel from "@/components/PatternsPanel";
import HealthPanel from "@/components/HealthPanel";
import CrossProjectPanel from "@/components/CrossProjectPanel";
import NotificationsPanel from "@/components/NotificationsPanel";
import ProceduresPanel from "@/components/ProceduresPanel";
import AIModelsPanel from "@/components/AIModelsPanel";

// Supabase client — read-only public access (ai-control-center)
const SUPABASE_URL = "https://qhscjlfavyqkaplcwhxu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoc2NqbGZhdnlxa2FwbGN3aHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzg1NDgsImV4cCI6MjA4Nzk1NDU0OH0.NWPX7OairlDx04bLZa0lGIccDmQ6BelJm-U5gHzcWt4";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type ActivePanel = "overview" | "experiences" | "runs" | "budget" | "notes" | "projects" | "patterns" | "health" | "cross" | "notifications" | "procedures" | "ai";

export interface DashboardData {
  experiences: any[];
  latestRun: any | null;
  allRuns: any[];
  budget: any | null;
  notes: any[];
  projects: any[];
  patterns: any[];
  domainMetrics: any[];
  systemHealth: any[];
  graphEdges: any[];
  stats: {
    totalExperiences: number;
    activeExperiences: number;
    totalRuns: number;
    cacheEntries: number;
    budgetUsedPct: number;
    overallHealth: number;
    pendingNotes: number;
    activeProjects: number;
  };
  loading: boolean;
  error: string | null;
}

export default function Home() {
  // The userAuth hooks provides authentication state
  // To implement login/logout functionality, simply call logout() or redirect to getLoginUrl()
  let { user, loading, error, isAuthenticated, logout } = useAuth();

  const [activePanel, setActivePanel] = useState<ActivePanel>("overview");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [data, setData] = useState<DashboardData>({
    experiences: [],
    latestRun: null,
    allRuns: [],
    budget: null,
    notes: [],
    projects: [],
    patterns: [],
    domainMetrics: [],
    systemHealth: [],
    graphEdges: [],
    stats: {
      totalExperiences: 0,
      activeExperiences: 0,
      totalRuns: 0,
      cacheEntries: 0,
      budgetUsedPct: 0,
      overallHealth: 0,
      pendingNotes: 0,
      activeProjects: 0,
    },
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    try {
      const [
        expRes, runsRes, budgetRes, notesRes, cacheRes,
        projectsRes, patternsRes, metricsRes, healthRes, graphRes
      ] = await Promise.all([
        supabase.from("manus_experiences").select("*").eq("status", "active").order("confidence", { ascending: false }).limit(100),
        supabase.from("manus_learning_runs").select("*").order("started_at", { ascending: false }).limit(30),
        supabase.from("manus_credit_budget").select("*").eq("period_type", "monthly").order("period_start", { ascending: false }).limit(1),
        supabase.from("manus_conversation_notes").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("manus_knowledge_cache").select("id", { count: "exact", head: true }),
        supabase.from("manus_project_context").select("*").order("last_activity", { ascending: false }).limit(20),
        supabase.from("manus_patterns").select("*").eq("status", "active").order("occurrence_count", { ascending: false }).limit(20),
        supabase.from("manus_domain_metrics").select("*").order("period_date", { ascending: false }).limit(50),
        supabase.from("manus_system_health").select("*").order("snapshot_date", { ascending: false }).limit(30),
        supabase.from("manus_knowledge_graph").select("*").limit(100),
      ]);

      const experiences = expRes.data || [];
      const allRuns = runsRes.data || [];
      const budget = budgetRes.data?.[0] || null;
      const notes = notesRes.data || [];
      const cacheCount = cacheRes.count || 0;
      const projects = projectsRes.data || [];
      const patterns = patternsRes.data || [];
      const domainMetrics = metricsRes.data || [];
      const systemHealth = healthRes.data || [];
      const graphEdges = graphRes.data || [];

      const latestHealth = systemHealth[0];
      const pendingNotes = notes.filter((n: any) => !n.processed_at).length;
      const activeProjects = projects.filter((p: any) => p.status === "active").length;

      setData({
        experiences,
        latestRun: allRuns[0] || null,
        allRuns,
        budget,
        notes,
        projects,
        patterns,
        domainMetrics,
        systemHealth,
        graphEdges,
        stats: {
          totalExperiences: experiences.length,
          activeExperiences: experiences.filter((e: any) => e.status === "active").length,
          totalRuns: allRuns.length,
          cacheEntries: cacheCount,
          budgetUsedPct: budget ? Math.round((budget.spent_usd / budget.budget_usd) * 100) : 0,
          overallHealth: latestHealth?.overall_health || 0,
          pendingNotes,
          activeProjects,
        },
        loading: false,
        error: null,
      });
      setLastRefresh(new Date());
    } catch (err: any) {
      console.warn("Supabase error, using demo data:", err.message);
      setData(generateMockData());
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const healthColor = data.stats.overallHealth >= 70 ? "text-primary" : data.stats.overallHealth >= 40 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="min-h-screen bg-background grid-texture flex">
      <Sidebar activePanel={activePanel} onNavigate={setActivePanel} latestRun={data.latestRun} stats={data.stats} />

      <main className="flex-1 ml-0 lg:ml-64 min-h-screen overflow-auto">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-3 border-b border-border bg-background/90 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${data.loading ? "bg-yellow-400 animate-pulse" : data.error ? "bg-red-400" : "bg-primary pulse-emerald"}`} />
              <span className="text-sm text-muted-foreground font-mono">
                {data.loading ? "Ładowanie..." : data.error ? "Tryb demo" : "Live · Supabase"}
              </span>
            </div>
            <span className="text-xs text-muted-foreground/50 hidden sm:block">
              Odświeżono: {lastRefresh.toLocaleTimeString("pl-PL")}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-muted-foreground">
              Health: <span className={`font-semibold ${healthColor}`}>{data.stats.overallHealth.toFixed(0)}/100</span>
            </span>
            <span className="text-muted-foreground">
              Budżet: <span className="text-foreground font-medium">{data.stats.budgetUsedPct}%</span>
            </span>
            <span className="text-muted-foreground hidden sm:block">
              Cache: <span className="text-foreground font-medium">{data.stats.cacheEntries}</span>
            </span>
            {data.stats.pendingNotes > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
                {data.stats.pendingNotes} oczekuje
              </span>
            )}
            <button
              onClick={fetchData}
              className="px-3 py-1 rounded border border-border hover:border-primary/50 hover:text-primary transition-colors"
            >
              ↻
            </button>
          </div>
        </header>

        {/* Panel content */}
        <div className="p-6">
          {activePanel === "overview"     && <OverviewPanel data={data} onNavigate={setActivePanel} />}
          {activePanel === "experiences"  && <ExperiencesPanel experiences={data.experiences} />}
          {activePanel === "runs"         && <LearningRunsPanel runs={data.allRuns} />}
          {activePanel === "budget"       && <BudgetPanel budget={data.budget} runs={data.allRuns} />}
          {activePanel === "notes"        && <NotesPanel notes={data.notes} onNoteAdded={fetchData} />}
          {activePanel === "projects"     && <ProjectsPanel projects={data.projects} />}
          {activePanel === "patterns"     && <PatternsPanel patterns={data.patterns} />}
          {activePanel === "health"       && <HealthPanel systemHealth={data.systemHealth} domainMetrics={data.domainMetrics} graphEdges={data.graphEdges} />}
          {activePanel === "cross"        && <CrossProjectPanel projects={data.projects} experiences={data.experiences} />}
          {activePanel === "notifications" && <NotificationsPanel />}
          {activePanel === "procedures"    && <ProceduresPanel />}
          {activePanel === "ai"            && <AIModelsPanel />}
        </div>
      </main>
    </div>
  );
}

// ─── Mock data dla trybu demo ─────────────────────────────────────────────────

function generateMockData(): DashboardData {
  const now = new Date();

  const experiences = [
    { id: "1", title: "Vercel wymaga NEXT_PUBLIC_ prefixu", summary: "Zmienne środowiskowe dostępne w przeglądarce muszą mieć prefix NEXT_PUBLIC_. Bez niego są undefined po stronie klienta.", category: "deployment", domain: "vercel", tags: ["vercel", "nextjs", "env"], confidence: 0.95, helpful_count: 8, harmful_count: 0, applied_count: 12, status: "active", created_at: new Date(now.getTime() - 7 * 86400000).toISOString() },
    { id: "2", title: "Supabase RLS blokuje bez policy", summary: "Row Level Security domyślnie blokuje wszystkie zapytania. Zawsze dodaj policy przed wdrożeniem lub wyłącz RLS dla tabel publicznych.", category: "security", domain: "supabase", tags: ["supabase", "rls", "postgres"], confidence: 0.92, helpful_count: 6, harmful_count: 1, applied_count: 9, status: "active", created_at: new Date(now.getTime() - 5 * 86400000).toISOString() },
    { id: "3", title: "Delta-only updates oszczędzają 80% kredytów", summary: "Przetwarzanie tylko nowych notatek (delta) zamiast całej bazy redukuje koszty AI o 60-90% przy zachowaniu tej samej jakości.", category: "workflow", domain: "openai", tags: ["optimization", "credits", "rag"], confidence: 0.88, helpful_count: 5, harmful_count: 0, applied_count: 7, status: "active", created_at: new Date(now.getTime() - 3 * 86400000).toISOString() },
    { id: "4", title: "Batch processing: 8 notatek = 1 AI call", summary: "Grupowanie notatek w batche po 8 redukuje liczbę wywołań AI 8x. Kluczowa optymalizacja dla nocnych learning runs.", category: "coding", domain: "openai", tags: ["batch", "openai", "optimization"], confidence: 0.85, helpful_count: 4, harmful_count: 0, applied_count: 5, status: "active", created_at: new Date(now.getTime() - 2 * 86400000).toISOString() },
    { id: "5", title: "Coolify wymaga health check endpoint", summary: "Aplikacje bez /health endpoint są restartowane przez Coolify co 30s. Zawsze dodaj prosty endpoint zwracający 200 OK.", category: "deployment", domain: "coolify", tags: ["coolify", "docker", "health"], confidence: 0.78, helpful_count: 3, harmful_count: 1, applied_count: 4, status: "active", created_at: new Date(now.getTime() - 1 * 86400000).toISOString() },
    { id: "6", title: "gpt-4.1-mini wystarczy do 95% zadań", summary: "Droższe modele rzadko dają lepsze wyniki dla rutynowych zadań. gpt-4.1-mini jest optymalny kosztowo dla syntezy i kompresji.", category: "workflow", domain: "openai", tags: ["openai", "model-routing", "cost"], confidence: 0.82, helpful_count: 7, harmful_count: 0, applied_count: 10, status: "active", created_at: new Date(now.getTime() - 4 * 86400000).toISOString() },
    { id: "7", title: "React useEffect cleanup zapobiega memory leaks", summary: "Zawsze zwracaj funkcję cleanup z useEffect gdy używasz setInterval, setTimeout lub subskrypcji. Brak cleanup = memory leak.", category: "coding", domain: "react", tags: ["react", "hooks", "memory"], confidence: 0.90, helpful_count: 5, harmful_count: 0, applied_count: 8, status: "active", created_at: new Date(now.getTime() - 6 * 86400000).toISOString() },
    { id: "8", title: "Tailwind 4 używa OKLCH zamiast HSL", summary: "W Tailwind CSS 4 kolory w @theme muszą być w formacie OKLCH. Użycie HSL powoduje błędy kompilacji.", category: "coding", domain: "react", tags: ["tailwind", "css", "colors"], confidence: 0.87, helpful_count: 3, harmful_count: 0, applied_count: 4, status: "active", created_at: new Date(now.getTime() - 8 * 86400000).toISOString() },
  ];

  const runs = [
    { id: "r1", run_type: "nightly", status: "completed", notes_scanned: 12, notes_new: 5, experiences_added: 2, experiences_updated: 3, experiences_deprecated: 0, tokens_used: 1840, tokens_saved_cache: 6200, model_used: "gpt-4.1-mini", cost_estimate_usd: 0.0018, cache_hit_rate: 0.77, started_at: new Date(now.getTime() - 8 * 3600000).toISOString(), completed_at: new Date(now.getTime() - 8 * 3600000 + 45000).toISOString(), duration_seconds: 45, summary_md: "## Raport nocny\n\nDodano 2 nowe wnioski, zaktualizowano 3. Cache hit rate: 77%.", key_learnings: ["Vercel env vars", "Supabase RLS", "Batch optimization"] },
    { id: "r2", run_type: "nightly", status: "completed", notes_scanned: 8, notes_new: 3, experiences_added: 1, experiences_updated: 2, experiences_deprecated: 0, tokens_used: 920, tokens_saved_cache: 3100, model_used: "gpt-4.1-mini", cost_estimate_usd: 0.0009, cache_hit_rate: 0.81, started_at: new Date(now.getTime() - 32 * 3600000).toISOString(), completed_at: new Date(now.getTime() - 32 * 3600000 + 32000).toISOString(), duration_seconds: 32 },
    { id: "r3", run_type: "nightly", status: "completed", notes_scanned: 15, notes_new: 8, experiences_added: 3, experiences_updated: 4, experiences_deprecated: 1, tokens_used: 2400, tokens_saved_cache: 4800, model_used: "gpt-4.1-mini", cost_estimate_usd: 0.0024, cache_hit_rate: 0.67, started_at: new Date(now.getTime() - 56 * 3600000).toISOString(), completed_at: new Date(now.getTime() - 56 * 3600000 + 67000).toISOString(), duration_seconds: 67 },
    { id: "r4", run_type: "nightly", status: "completed", notes_scanned: 6, notes_new: 2, experiences_added: 0, experiences_updated: 1, experiences_deprecated: 0, tokens_used: 480, tokens_saved_cache: 2100, model_used: "gpt-4.1-mini", cost_estimate_usd: 0.0005, cache_hit_rate: 0.88, started_at: new Date(now.getTime() - 80 * 3600000).toISOString(), completed_at: new Date(now.getTime() - 80 * 3600000 + 18000).toISOString(), duration_seconds: 18 },
    { id: "r5", run_type: "nightly", status: "completed", notes_scanned: 20, notes_new: 10, experiences_added: 4, experiences_updated: 5, experiences_deprecated: 2, tokens_used: 3200, tokens_saved_cache: 5600, model_used: "gpt-4.1-mini", cost_estimate_usd: 0.0032, cache_hit_rate: 0.64, started_at: new Date(now.getTime() - 104 * 3600000).toISOString(), completed_at: new Date(now.getTime() - 104 * 3600000 + 89000).toISOString(), duration_seconds: 89 },
  ];

  const notes = [
    { id: "n1", topic: "Wdrożenie Manus Brain Dashboard", key_points: ["System bazy doświadczeń", "Optymalizacja kredytów", "Nocne uczenie się"], importance: 9, session_date: now.toISOString().split("T")[0], processed_at: null, tools_used: ["supabase", "vercel", "react"], projects: ["manus-brain-dashboard"], created_at: now.toISOString() },
    { id: "n2", topic: "Konfiguracja Supabase RLS dla tabel publicznych", key_points: ["RLS blokuje bez policy", "Dodano policy dla manus_*"], importance: 7, session_date: new Date(now.getTime() - 86400000).toISOString().split("T")[0], processed_at: new Date(now.getTime() - 8 * 3600000).toISOString(), tools_used: ["supabase", "postgresql"], created_at: new Date(now.getTime() - 86400000).toISOString() },
    { id: "n3", topic: "Optymalizacja kosztów OpenAI — batch processing", key_points: ["Batch 8 notatek = 1 call", "Cache TTL 30 dni"], importance: 8, session_date: new Date(now.getTime() - 2 * 86400000).toISOString().split("T")[0], processed_at: new Date(now.getTime() - 32 * 3600000).toISOString(), tools_used: ["openai", "python"], created_at: new Date(now.getTime() - 2 * 86400000).toISOString() },
    { id: "n4", topic: "Tailwind CSS 4 — migracja z HSL na OKLCH", key_points: ["OKLCH wymagane w @theme", "Stare HSL powodują błędy"], importance: 6, session_date: new Date(now.getTime() - 3 * 86400000).toISOString().split("T")[0], processed_at: new Date(now.getTime() - 56 * 3600000).toISOString(), tools_used: ["tailwind", "css"], created_at: new Date(now.getTime() - 3 * 86400000).toISOString() },
  ];

  const budget = {
    id: "b1", period_type: "monthly", budget_usd: 5.0, spent_usd: 0.0084, tokens_budget: 500000, tokens_used: 8840,
    period_start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
    period_end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0],
    alert_threshold: 0.8, is_alert_sent: false, is_paused: false,
    model_config: { simple_task: "gpt-4.1-nano", standard_task: "gpt-4.1-mini", max_tokens_per_call: 2000, cache_ttl_days: 30, batch_size: 8 }
  };

  const projects = [
    { id: "p1", project_name: "manus-brain-dashboard", display_name: "Manus Brain Dashboard", status: "active", tech_stack: ["react", "supabase", "tailwind"], related_domains: ["frontend", "data"], open_issues: [{ issue: "Dodać wykresy trendów", priority: "medium" }], recent_progress: [{ date: now.toISOString().split("T")[0], what: "Rozbudowa dashboardu v2" }], last_activity: now.toISOString().split("T")[0], url: "https://manus-brain.manus.space", note_count: 4 },
    { id: "p2", project_name: "ai-control-center", display_name: "AI Control Center", status: "active", tech_stack: ["supabase", "python"], related_domains: ["security", "infrastructure"], open_issues: [], recent_progress: [{ date: new Date(now.getTime() - 86400000).toISOString().split("T")[0], what: "Migracja bazy danych v2" }], last_activity: new Date(now.getTime() - 86400000).toISOString().split("T")[0], note_count: 8 },
    { id: "p3", project_name: "dexter-vault", display_name: "Dexter Vault", status: "active", tech_stack: ["supabase", "encryption"], related_domains: ["security", "data"], open_issues: [{ issue: "Backup automatyczny", priority: "high" }], recent_progress: [], last_activity: new Date(now.getTime() - 3 * 86400000).toISOString().split("T")[0], note_count: 3 },
  ];

  const patterns = [
    { id: "pt1", pattern_name: "Missing RLS Policy", pattern_type: "anti_pattern", description: "Tworzenie tabel Supabase bez dodania RLS policies powoduje blokadę wszystkich zapytań.", trigger_context: "Tworzenie nowych tabel w Supabase", recommended_action: "Zawsze dodaj policy zaraz po CREATE TABLE", occurrence_count: 5, confidence: 0.92, tags: ["supabase", "security"], status: "active" },
    { id: "pt2", pattern_name: "Env Vars Without Prefix", pattern_type: "pitfall", description: "Zmienne środowiskowe bez NEXT_PUBLIC_ prefix są niedostępne po stronie klienta w Next.js.", trigger_context: "Konfiguracja zmiennych środowiskowych w Next.js", recommended_action: "Dodaj NEXT_PUBLIC_ prefix do wszystkich zmiennych używanych w przeglądarce", occurrence_count: 3, confidence: 0.88, tags: ["nextjs", "vercel", "env"], status: "active" },
    { id: "pt3", pattern_name: "Single AI Call Per Note", pattern_type: "anti_pattern", description: "Wywoływanie AI osobno dla każdej notatki zamiast batch processing marnuje 80%+ kredytów.", trigger_context: "Przetwarzanie wielu notatek naraz", recommended_action: "Zawsze grupuj notatki w batche po 8 przed wywołaniem AI", occurrence_count: 2, confidence: 0.85, tags: ["openai", "optimization", "credits"], status: "active" },
    { id: "pt4", pattern_name: "Delta-Only Processing", pattern_type: "best_practice", description: "Przetwarzaj tylko nowe dane (processed_at IS NULL) zamiast całej bazy przy każdym runie.", trigger_context: "Cykliczne zadania przetwarzania danych", recommended_action: "Zawsze filtruj po processed_at IS NULL lub last_processed_id", occurrence_count: 4, confidence: 0.90, tags: ["optimization", "database", "workflow"], status: "active" },
    { id: "pt5", pattern_name: "Health Check Endpoint", pattern_type: "best_practice", description: "Każda aplikacja deployowana na Coolify/Docker musi mieć endpoint /health zwracający 200 OK.", trigger_context: "Deployment aplikacji na Coolify", recommended_action: "Dodaj GET /health → { status: 'ok' } do każdego serwera", occurrence_count: 3, confidence: 0.87, tags: ["coolify", "docker", "deployment"], status: "active" },
  ];

  const domainMetrics = [
    { id: "dm1", domain: "vercel", category: "deployment", period_date: now.toISOString().split("T")[0], experiences_count: 3, avg_confidence: 0.87, avg_helpful_rate: 0.88, health_score: 0.87, trend_direction: "improving" },
    { id: "dm2", domain: "supabase", category: "security", period_date: now.toISOString().split("T")[0], experiences_count: 2, avg_confidence: 0.82, avg_helpful_rate: 0.75, health_score: 0.79, trend_direction: "stable" },
    { id: "dm3", domain: "openai", category: "workflow", period_date: now.toISOString().split("T")[0], experiences_count: 3, avg_confidence: 0.85, avg_helpful_rate: 0.95, health_score: 0.89, trend_direction: "improving" },
    { id: "dm4", domain: "react", category: "coding", period_date: now.toISOString().split("T")[0], experiences_count: 2, avg_confidence: 0.88, avg_helpful_rate: 0.90, health_score: 0.89, trend_direction: "stable" },
    { id: "dm5", domain: "coolify", category: "deployment", period_date: now.toISOString().split("T")[0], experiences_count: 1, avg_confidence: 0.78, avg_helpful_rate: 0.75, health_score: 0.77, trend_direction: "stable" },
  ];

  const systemHealth = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() - i * 86400000);
    const base = 72 + Math.sin(i) * 8;
    return {
      id: `sh${i}`,
      snapshot_date: d.toISOString().split("T")[0],
      total_experiences: 8 - i,
      active_experiences: 8 - i,
      deprecated_count: i,
      avg_confidence: 0.85 - i * 0.01,
      high_confidence_pct: 0.75 - i * 0.02,
      notes_last_7d: 4 + i,
      experiences_added_7d: 2,
      learning_runs_7d: 1,
      total_cost_usd: 0.0084 + i * 0.002,
      cache_hit_rate_avg: 0.77 - i * 0.03,
      tokens_saved_total: 15900 - i * 1000,
      graph_edges: 5 + i,
      knowledge_score: base * 0.9,
      efficiency_score: base * 1.1,
      growth_score: base * 0.8,
      overall_health: base,
      alerts: i === 0 ? [] : [{ type: "info", msg: "Brak nowych notatek" }],
    };
  }).reverse();

  return {
    experiences,
    latestRun: runs[0],
    allRuns: runs,
    budget,
    notes,
    projects,
    patterns,
    domainMetrics,
    systemHealth,
    graphEdges: [],
    stats: {
      totalExperiences: experiences.length,
      activeExperiences: experiences.length,
      totalRuns: runs.length,
      cacheEntries: 24,
      budgetUsedPct: Math.round((budget.spent_usd / budget.budget_usd) * 100),
      overallHealth: systemHealth[systemHealth.length - 1].overall_health,
      pendingNotes: notes.filter(n => !n.processed_at).length,
      activeProjects: projects.filter(p => p.status === "active").length,
    },
    loading: false,
    error: null,
  };
}
