/*
 * OverviewPanel — Dark Intelligence Dashboard
 * Główny widok: statystyki, ostatni run, top experiences, budżet
 */

import { useState, useEffect } from "react";
import { TrendingUp, Brain, Zap, Database, Clock, ChevronRight, CheckCircle, AlertCircle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { DashboardData, ActivePanel } from "@/pages/Home";

interface Props {
  data: DashboardData;
  onNavigate: (panel: ActivePanel) => void;
}

export default function OverviewPanel({ data, onNavigate }: Props) {
  const { stats, latestRun, experiences, budget, allRuns } = data;

  // Count-up animation
  const [displayStats, setDisplayStats] = useState({ exp: 0, runs: 0, cache: 0, budget: 0 });
  useEffect(() => {
    const target = { exp: stats.activeExperiences, runs: stats.totalRuns, cache: stats.cacheEntries, budget: stats.budgetUsedPct };
    const duration = 1200;
    const steps = 40;
    const interval = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayStats({
        exp:    Math.round(target.exp * ease),
        runs:   Math.round(target.runs * ease),
        cache:  Math.round(target.cache * ease),
        budget: Math.round(target.budget * ease),
      });
      if (step >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [stats]);

  // Chart data — tokeny z ostatnich runów
  const chartData = [...allRuns].reverse().slice(-7).map((r, i) => ({
    name: `Run ${i + 1}`,
    tokens: r.tokens_used || 0,
    saved:  r.tokens_saved_cache || 0,
  }));

  const topExperiences = experiences.slice(0, 4);

  return (
    <div className="space-y-6 stagger-in">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
          Przegląd systemu
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Co Manus wie i jak robi postępy — aktualizowane co minutę
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Brain}
          label="Aktywne wnioski"
          value={displayStats.exp}
          suffix=""
          color="emerald"
          onClick={() => onNavigate("experiences")}
          sub={`${stats.totalExperiences} łącznie`}
        />
        <KpiCard
          icon={TrendingUp}
          label="Learning runs"
          value={displayStats.runs}
          suffix=""
          color="blue"
          onClick={() => onNavigate("runs")}
          sub={latestRun ? `Ostatni: ${formatAge(latestRun.started_at)}` : "Brak"}
        />
        <KpiCard
          icon={Database}
          label="Cache entries"
          value={displayStats.cache}
          suffix=""
          color="violet"
          onClick={() => onNavigate("budget")}
          sub="Aktywnych wpisów"
        />
        <KpiCard
          icon={Zap}
          label="Budżet"
          value={displayStats.budget}
          suffix="%"
          color={stats.budgetUsedPct > 80 ? "rose" : "amber"}
          onClick={() => onNavigate("budget")}
          sub={budget ? `$${budget.spent_usd?.toFixed(4)} / $${budget.budget_usd}` : "N/A"}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest run summary */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
              Ostatni przebieg uczenia
            </h3>
            <button
              onClick={() => onNavigate("runs")}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
            >
              Historia <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {latestRun ? (
            <div className="space-y-4">
              {/* Status row */}
              <div className="flex items-center gap-3">
                {latestRun.status === "completed"
                  ? <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                  : <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                }
                <div>
                  <span className="text-sm font-medium text-foreground capitalize">{latestRun.status}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {formatAge(latestRun.started_at)} · {latestRun.duration_seconds}s
                  </span>
                </div>
                <span className="ml-auto text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {latestRun.model_used || "gpt-4.1-mini"}
                </span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Notatki", value: latestRun.notes_scanned || 0, sub: `${latestRun.notes_new || 0} nowych` },
                  { label: "Dodano", value: latestRun.experiences_added || 0, sub: "wniosków" },
                  { label: "Zaktualizowano", value: latestRun.experiences_updated || 0, sub: "wniosków" },
                ].map((s) => (
                  <div key={s.label} className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-foreground count-up">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                    <div className="text-[10px] text-muted-foreground/60">{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Token efficiency */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Efektywność cache</span>
                  <span className="text-foreground font-medium">
                    {Math.round((latestRun.cache_hit_rate || 0) * 100)}% hit rate
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-1000"
                    style={{ width: `${Math.round((latestRun.cache_hit_rate || 0) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Tokeny użyte: {(latestRun.tokens_used || 0).toLocaleString()}</span>
                  <span>Zaoszczędzone: {(latestRun.tokens_saved_cache || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Cost */}
              <div className="flex items-center justify-between bg-primary/5 border border-primary/10 rounded-lg px-4 py-2">
                <span className="text-xs text-muted-foreground">Koszt tego przebiegu</span>
                <span className="text-sm font-bold text-primary font-mono">
                  ${(latestRun.cost_estimate_usd || 0).toFixed(5)}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Brak przebiegów. System uruchomi się dziś w nocy.</p>
            </div>
          )}
        </div>

        {/* Token usage chart */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-4" style={{ fontFamily: "Syne, sans-serif" }}>
            Zużycie tokenów
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.72 0.18 160)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.72 0.18 160)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="savedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.78 0.17 75)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="oklch(0.78 0.17 75)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "oklch(0.55 0.012 264)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.55 0.012 264)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.17 0.014 264)", border: "1px solid oklch(1 0 0 / 8%)", borderRadius: "8px", fontSize: "11px" }}
                  labelStyle={{ color: "oklch(0.93 0.008 264)" }}
                />
                <Area type="monotone" dataKey="tokens" stroke="oklch(0.72 0.18 160)" strokeWidth={2} fill="url(#tokenGrad)" name="Użyte" />
                <Area type="monotone" dataKey="saved" stroke="oklch(0.78 0.17 75)" strokeWidth={1.5} fill="url(#savedGrad)" name="Zaoszczędzone" strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
              Brak danych
            </div>
          )}
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <div className="w-2 h-0.5 bg-primary rounded" />
              Użyte
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <div className="w-2 h-0.5 bg-amber-400 rounded" style={{ borderStyle: "dashed" }} />
              Zaoszczędzone
            </div>
          </div>
        </div>
      </div>

      {/* Top experiences */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
            Najważniejsze wnioski
          </h3>
          <button
            onClick={() => onNavigate("experiences")}
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
          >
            Wszystkie <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        {topExperiences.length > 0 ? (
          <div className="space-y-3">
            {topExperiences.map((exp) => (
              <ExperienceRow key={exp.id} exp={exp} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Brak wniosków — system uczy się dziś w nocy
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, suffix, color, onClick, sub }: {
  icon: React.ElementType; label: string; value: number; suffix: string;
  color: "emerald" | "blue" | "violet" | "amber" | "rose";
  onClick: () => void; sub: string;
}) {
  const colors = {
    emerald: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    blue:    "text-blue-400 bg-blue-400/10 border-blue-400/20",
    violet:  "text-violet-400 bg-violet-400/10 border-violet-400/20",
    amber:   "text-amber-400 bg-amber-400/10 border-amber-400/20",
    rose:    "text-rose-400 bg-rose-400/10 border-rose-400/20",
  };

  return (
    <button
      onClick={onClick}
      className="bg-card rounded-xl border border-border p-4 text-left hover:border-primary/30 transition-all duration-200 group"
    >
      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-2xl font-bold text-foreground count-up" style={{ fontFamily: "Syne, sans-serif" }}>
        {value}{suffix}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      <div className="text-[10px] text-muted-foreground/60 mt-1">{sub}</div>
    </button>
  );
}

function ExperienceRow({ exp }: { exp: any }) {
  const categoryColors: Record<string, string> = {
    deployment: "text-blue-400 bg-blue-400/10",
    security:   "text-rose-400 bg-rose-400/10",
    coding:     "text-violet-400 bg-violet-400/10",
    workflow:   "text-amber-400 bg-amber-400/10",
    ux:         "text-pink-400 bg-pink-400/10",
    general:    "text-slate-400 bg-slate-400/10",
  };

  const confidence = Math.round((exp.confidence || 0) * 100);
  const colorClass = categoryColors[exp.category] || categoryColors.general;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colorClass}`}>
            {exp.category}
          </span>
          <span className="text-xs text-foreground font-medium truncate">{exp.title}</span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{exp.summary}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        <div className="text-xs font-bold text-primary">{confidence}%</div>
        <div className="text-[10px] text-muted-foreground">pewność</div>
        {/* Mini confidence bar */}
        <div className="w-12 h-1 bg-muted rounded-full mt-1 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${confidence}%`,
              background: confidence > 70 ? "oklch(0.72 0.18 160)" : confidence > 40 ? "oklch(0.78 0.17 75)" : "oklch(0.65 0.22 15)"
            }}
          />
        </div>
      </div>
    </div>
  );
}

function formatAge(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}d temu`;
  if (h > 0)  return `${h}h temu`;
  if (m > 0)  return `${m}min temu`;
  return "przed chwilą";
}
