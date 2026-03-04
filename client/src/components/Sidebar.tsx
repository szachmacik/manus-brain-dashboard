/*
 * Sidebar — Dark Intelligence Dashboard
 * Fixed left navigation z ikonami i statusem ostatniego run
 */

import { Brain, BookOpen, PlayCircle, Wallet, FileText, ChevronRight, Zap } from "lucide-react";
import type { ActivePanel } from "@/pages/Home";

interface SidebarProps {
  activePanel: ActivePanel;
  onNavigate: (panel: ActivePanel) => void;
  latestRun: any | null;
}

const navItems: { id: ActivePanel; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "overview",     label: "Przegląd",        icon: Brain,       desc: "Status systemu" },
  { id: "experiences",  label: "Doświadczenia",    icon: BookOpen,    desc: "Baza wiedzy" },
  { id: "runs",         label: "Uczenie się",      icon: PlayCircle,  desc: "Historia przebiegów" },
  { id: "budget",       label: "Kredyty",          icon: Wallet,      desc: "Budżet i cache" },
  { id: "notes",        label: "Notatki",          icon: FileText,    desc: "Z rozmów" },
];

export default function Sidebar({ activePanel, onNavigate, latestRun }: SidebarProps) {
  const lastRunTime = latestRun?.completed_at
    ? formatRelativeTime(latestRun.completed_at)
    : "Brak";

  const lastRunStatus = latestRun?.status || "none";

  return (
    <>
      {/* Mobile overlay — hidden on lg */}
      <div className="lg:hidden fixed inset-0 z-10 pointer-events-none" />

      {/* Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-60 flex-col bg-sidebar border-r border-sidebar-border z-30">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-sidebar-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
                Manus Brain
              </h1>
              <p className="text-[10px] text-muted-foreground">Baza Doświadczeń</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePanel === item.id;
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
                {isActive && <ChevronRight className="w-3 h-3 text-primary flex-shrink-0" />}
              </button>
            );
          })}
        </nav>

        {/* Last run status */}
        <div className="px-4 py-4 border-t border-sidebar-border">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Ostatni run</div>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              lastRunStatus === "completed" ? "bg-primary pulse-emerald" :
              lastRunStatus === "running"   ? "bg-amber-400 pulse-emerald" :
              lastRunStatus === "failed"    ? "bg-destructive" :
              "bg-muted-foreground"
            }`} />
            <div className="min-w-0">
              <div className="text-xs text-sidebar-foreground truncate">
                {lastRunStatus === "completed" ? "Zakończony" :
                 lastRunStatus === "running"   ? "W trakcie..." :
                 lastRunStatus === "failed"    ? "Błąd" : "Brak danych"}
              </div>
              <div className="text-[10px] text-muted-foreground">{lastRunTime}</div>
            </div>
          </div>
          {latestRun && (
            <div className="mt-2 text-[10px] text-muted-foreground font-mono">
              +{latestRun.experiences_added ?? 0} dodano · {latestRun.tokens_used ?? 0} tokenów
            </div>
          )}
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
