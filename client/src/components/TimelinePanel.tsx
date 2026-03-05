/**
 * TimelinePanel — chronologiczna oś czasu wszystkich aktywności Manusa
 * Pokazuje: notatki, doświadczenia, runy uczenia, push, AI calls, eksporty
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  FileText, Brain, Zap, FolderOpen, Activity, Bell, Bot,
  Download, Heart, Settings, ChevronDown, Loader2, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";

type ActivityType =
  | "note_added" | "experience_learned" | "pattern_detected" | "project_updated"
  | "learning_run" | "push_sent" | "ai_call" | "export_created" | "health_check" | "procedure_updated";

const TYPE_CONFIG: Record<ActivityType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  note_added: { label: "Notatka", icon: <FileText size={14} />, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  experience_learned: { label: "Doświadczenie", icon: <Brain size={14} />, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
  pattern_detected: { label: "Wzorzec", icon: <Zap size={14} />, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
  project_updated: { label: "Projekt", icon: <FolderOpen size={14} />, color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20" },
  learning_run: { label: "Nocny run", icon: <Activity size={14} />, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
  push_sent: { label: "Push", icon: <Bell size={14} />, color: "text-sky-400", bg: "bg-sky-400/10 border-sky-400/20" },
  ai_call: { label: "AI Call", icon: <Bot size={14} />, color: "text-violet-400", bg: "bg-violet-400/10 border-violet-400/20" },
  export_created: { label: "Eksport", icon: <Download size={14} />, color: "text-teal-400", bg: "bg-teal-400/10 border-teal-400/20" },
  health_check: { label: "Health Check", icon: <Heart size={14} />, color: "text-rose-400", bg: "bg-rose-400/10 border-rose-400/20" },
  procedure_updated: { label: "Procedura", icon: <Settings size={14} />, color: "text-gray-400", bg: "bg-gray-400/10 border-gray-400/20" },
};

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "przed chwilą";
  if (mins < 60) return `${mins} min temu`;
  if (hours < 24) return `${hours} godz. temu`;
  if (days < 7) return `${days} dni temu`;
  return new Date(date).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

function formatFullDate(date: Date): string {
  return new Date(date).toLocaleString("pl-PL", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

export default function TimelinePanel() {
  const [limit, setLimit] = useState(50);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data, isLoading, refetch } = trpc.brain.timeline.useQuery(
    { limit, offset: 0 },
    { staleTime: 30000 }
  );

  // Grupuj po dniu
  type TimelineItem = NonNullable<typeof data>["items"][number];
  const grouped: Record<string, TimelineItem[]> = {};
  if (data?.items) {
    for (const item of data.items) {
      const day = new Date(item.createdAt).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
      if (!grouped[day]) grouped[day] = [];
      grouped[day]!.push(item);
    }
  }

  const importanceColor = (imp: number | null) => {
    if (!imp) return "text-gray-500";
    if (imp >= 8) return "text-red-400";
    if (imp >= 6) return "text-amber-400";
    if (imp >= 4) return "text-blue-400";
    return "text-gray-500";
  };

  return (
    <div className="h-full flex flex-col gap-4 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white font-display">Oś Czasu</h2>
          <p className="text-sm text-gray-400 mt-0.5">Chronologiczna historia aktywności Manusa</p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <span className="text-xs text-gray-500">{data.total} zdarzeń łącznie</span>
          )}
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-gray-400 hover:text-white h-8 w-8 p-0">
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 gap-3 text-gray-400">
          <Loader2 size={20} className="animate-spin text-emerald-400" />
          <span>Ładowanie osi czasu...</span>
        </div>
      )}

      {!isLoading && data?.items.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center">
            <Activity size={28} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-white font-medium">Brak aktywności</p>
            <p className="text-sm text-gray-400 mt-1">Oś czasu wypełni się po pierwszych działaniach Manusa</p>
          </div>
        </div>
      )}

      {/* Timeline grouped by day */}
      {!isLoading && Object.entries(grouped).map(([day, items]) => (
        <div key={day}>
          {/* Day separator */}
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-white/8" />
            <span className="text-xs text-gray-500 font-medium capitalize">{day}</span>
            <div className="h-px flex-1 bg-white/8" />
          </div>

          {/* Events */}
          <div className="space-y-2 ml-2">
            {items.map((item) => {
              const cfg = TYPE_CONFIG[item.type as ActivityType] ?? TYPE_CONFIG.note_added;
              const isExpanded = expandedId === item.id;
              const hasDetails = item.description || (item.metadata && Object.keys(item.metadata as object).length > 0);

              return (
                <div
                  key={item.id}
                  className={`relative pl-8 ${hasDetails ? "cursor-pointer" : ""}`}
                  onClick={() => hasDetails && setExpandedId(isExpanded ? null : item.id)}
                >
                  {/* Timeline dot */}
                  <div className={`absolute left-0 top-3 w-6 h-6 rounded-full border flex items-center justify-center ${cfg.bg}`}>
                    <span className={cfg.color}>{cfg.icon}</span>
                  </div>
                  {/* Vertical line */}
                  <div className="absolute left-3 top-9 bottom-0 w-px bg-white/5" />

                  <div className={`p-3 rounded-xl bg-white/3 border transition-all ${
                    isExpanded ? "border-white/15 bg-white/5" : "border-white/8 hover:border-white/12"
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                          {item.importance && item.importance >= 7 && (
                            <span className={`text-xs ${importanceColor(item.importance)}`}>
                              {"★".repeat(Math.min(3, Math.floor(item.importance / 3)))}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-white mt-0.5 truncate">{item.title}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-500" title={formatFullDate(item.createdAt)}>
                          {formatRelativeTime(item.createdAt)}
                        </span>
                        {hasDetails ? (
                          <ChevronDown size={14} className={`text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        ) : null}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-white/8 space-y-2">
                        {item.description && (
                          <p className="text-xs text-gray-300">{item.description}</p>
                        )}
                        {item.entityType && (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>Typ encji:</span>
                            <span className="text-gray-300">{item.entityType}</span>
                            {item.entityId && <span className="font-mono text-gray-400">#{item.entityId}</span>}
                          </div>
                        )}
                        {item.metadata && Object.keys(item.metadata as Record<string, unknown>).length > 0 ? (
                          <details className="text-xs">
                            <summary className="text-gray-500 cursor-pointer hover:text-gray-300">Metadane</summary>
                            <pre className="mt-1 p-2 rounded bg-black/30 text-gray-400 overflow-x-auto text-xs">
                              {JSON.stringify(item.metadata as Record<string, unknown>, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                        <div className="text-xs text-gray-500">{formatFullDate(item.createdAt)}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Load more */}
      {data && data.total > limit && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLimit(l => l + 50)}
            className="text-gray-400 border-white/10 hover:border-white/20 hover:text-white"
          >
            <ChevronDown size={14} className="mr-1" />
            Załaduj więcej ({data.total - limit} pozostało)
          </Button>
        </div>
      )}
    </div>
  );
}
