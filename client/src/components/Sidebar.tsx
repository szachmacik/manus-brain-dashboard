/*
 * Sidebar v2 — Dark Intelligence Dashboard
 * Fixed left navigation z ikonami, statusem i stats badges
 */

import { Brain, BookOpen, PlayCircle, Wallet, FileText, ChevronRight, Zap, FolderOpen, TrendingUp, Activity, GitBranch, Bell, BookMarked, Bot, Search, BarChart2, Clock, Download, Network, Timer, Newspaper, Shield } from "lucide-react";
import type { ActivePanel } from "@/pages/Home";

interface SidebarProps {
  activePanel: ActivePanel;
  onNavigate: (panel: ActivePanel) => void;
  latestRun: any | null;
  stats?: {
    totalExperiences: number;
    activeExperiences: number;
    totalRuns: number;
    cacheEntries: number;
    budgetUsedPct: number;
    overallHealth: number;
    pendingNotes: number;
    activeProjects: number;
  };
}

const navItems: { id: ActivePanel; label: string; icon: React.ElementType; desc: string; badgeKey?: keyof NonNullable<SidebarProps["stats"]> }[] = [
  { id: "overview",     label: "Przegląd",        icon: Brain,       desc: "Status systemu" },
  { id: "experiences",  label: "Doświadczenia",    icon: BookOpen,    desc: "Baza wiedzy",        badgeKey: "activeExperiences" },
  { id: "runs",         label: "Uczenie się",      icon: PlayCircle,  desc: "Historia przebiegów", badgeKey: "totalRuns" },
  { id: "budget",       label: "Kredyty",          icon: Wallet,      desc: "Budżet i cache" },
  { id: "notes",        label: "Notatki",          icon: FileText,    desc: "Z rozmów",            badgeKey: "pendingNotes" },
  { id: "projects",     label: "Projekty",         icon: FolderOpen,  desc: "Kontekst projektów",  badgeKey: "activeProjects" },
  { id: "patterns",     label: "Wzorce",           icon: TrendingUp,  desc: "Anty-wzorce i dobre praktyki" },
  { id: "health",       label: "Stan systemu",     icon: Activity,    desc: "Trendy i metryki" },
  { id: "cross",        label: "Cross-Project",    icon: GitBranch,   desc: "Wspólna wiedza",       badgeKey: "activeProjects" },
  { id: "notifications", label: "Powiadomienia",    icon: Bell,        desc: "Web Push alerty" },
  { id: "procedures",    label: "Centrum Procedur", icon: BookMarked,  desc: "Dekalog projektów" },
  { id: "ai",            label: "Multi-AI Router",  icon: Bot,         desc: "Claude · Kimi · DeepSeek" },
  { id: "search",        label: "Wyszukiwarka",      icon: Search,      desc: "Szukaj w bazie wiedzy" },
  { id: "analytics",    label: "Analityka",         icon: BarChart2,   desc: "Wykresy i trendy" },
  { id: "timeline",     label: "Oś czasu",          icon: Clock,       desc: "Historia aktywności" },
  { id: "export",       label: "Eksport danych",    icon: Download,    desc: "JSON · CSV · Markdown" },
  { id: "vector",       label: "Baza Wektorowa",    icon: Network,     desc: "Semantic search · Klastry · Graf" },
  { id: "scheduler",    label: "Pipeline Manager",  icon: Timer,       desc: "Auto-reindeksowanie · Historia" },
  { id: "news",          label: "Aktualności",        icon: Newspaper,   desc: "Stack updates · AI insights" },
  { id: "vault",         label: "Secure Vault",       icon: Shield,      desc: "Coolify · GitHub · Autodeployment" },
];

export default function Sidebar({ activePanel, onNavigate, latestRun, stats }: SidebarProps) {
  const lastRunTime = latestRun?.completed_at
    ? formatRelativeTime(latestRun.completed_at)
    : "Brak";

  const lastRunStatus = latestRun?.status || "none";

  const healthColor = !stats ? "text-muted-foreground" :
    stats.overallHealth >= 70 ? "text-primary" :
    stats.overallHealth >= 40 ? "text-yellow-400" : "text-red-400";

  return (
    <>
      {/* Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 flex-col bg-sidebar border-r border-sidebar-border z-30">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-sidebar-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
                Manus Brain
              </h1>
              <p className="text-[10px] text-muted-foreground">Baza Doświadczeń v2</p>
            </div>
          </div>

          {/* Health indicator */}
          {stats && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${stats.overallHealth}%`,
                    background: stats.overallHealth >= 70 ? "var(--color-primary)" : stats.overallHealth >= 40 ? "#f59e0b" : "#ef4444"
                  }}
                />
              </div>
              <span className={`text-xs font-semibold ${healthColor}`}>{stats.overallHealth.toFixed(0)}</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePanel === item.id;
            const badge = item.badgeKey && stats ? stats[item.badgeKey] : undefined;
            const showBadge = badge !== undefined && badge > 0;
            const isPendingBadge = item.badgeKey === "pendingNotes";

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-all duration-200 group ${
                  isActive
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.label}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{item.desc}</div>
                </div>
                {showBadge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                    isPendingBadge
                      ? "bg-yellow-400/20 text-yellow-400"
                      : isActive
                      ? "bg-primary/30 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {badge}
                  </span>
                )}
                {isActive && !showBadge && <ChevronRight className="w-3 h-3 text-primary flex-shrink-0" />}
              </button>
            );
          })}
        </nav>

        {/* Last run status */}
        <div className="px-4 py-4 border-t border-sidebar-border">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Ostatni run nocny</div>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              lastRunStatus === "completed" ? "bg-primary pulse-emerald" :
              lastRunStatus === "running"   ? "bg-amber-400 animate-pulse" :
              lastRunStatus === "failed"    ? "bg-destructive" :
              "bg-muted-foreground"
            }`} />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-sidebar-foreground truncate">
                {lastRunStatus === "completed" ? "Zakończony" :
                 lastRunStatus === "running"   ? "W trakcie..." :
                 lastRunStatus === "failed"    ? "Błąd" : "Brak danych"}
              </div>
              <div className="text-[10px] text-muted-foreground">{lastRunTime}</div>
            </div>
          </div>
          {latestRun && (
            <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-muted-foreground font-mono">
              <div className="text-center">
                <div className="text-primary font-semibold">+{latestRun.experiences_added ?? 0}</div>
                <div>nowych</div>
              </div>
              <div className="text-center">
                <div className="text-foreground font-semibold">{latestRun.notes_scanned ?? 0}</div>
                <div>notatek</div>
              </div>
              <div className="text-center">
                <div className="text-blue-400 font-semibold">{Math.round((latestRun.cache_hit_rate ?? 0) * 100)}%</div>
                <div>cache</div>
              </div>
            </div>
          )}

          {/* Next run */}
          <div className="mt-3 text-[10px] text-muted-foreground/60 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 inline-block" />
            Następny run: 02:00
          </div>
        </div>
      </aside>
    </>
  );
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}d temu`;
  if (h > 0)  return `${h}h temu`;
  if (m > 0)  return `${m}min temu`;
  return "przed chwilą";
}
