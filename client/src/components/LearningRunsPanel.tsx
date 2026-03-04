/*
 * LearningRunsPanel — historia przebiegów uczenia się
 */

import { useState } from "react";
import { CheckCircle, AlertCircle, Clock, ChevronDown, ChevronUp, Zap, Database } from "lucide-react";
import { Streamdown } from "streamdown";

interface Props {
  runs: any[];
}

export default function LearningRunsPanel({ runs }: Props) {
  const [expanded, setExpanded] = useState<string | null>(runs[0]?.id || null);

  return (
    <div className="space-y-5 stagger-in">
      <div>
        <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
          Historia uczenia się
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {runs.length} przebiegów · nocne uruchomienia o 02:00
        </p>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

        <div className="space-y-4">
          {runs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Brak przebiegów. Pierwszy uruchomi się dziś w nocy.</p>
            </div>
          ) : (
            runs.map((run, idx) => (
              <RunCard
                key={run.id}
                run={run}
                isFirst={idx === 0}
                isExpanded={expanded === run.id}
                onToggle={() => setExpanded(expanded === run.id ? null : run.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function RunCard({ run, isFirst, isExpanded, onToggle }: {
  run: any; isFirst: boolean; isExpanded: boolean; onToggle: () => void;
}) {
  const isCompleted = run.status === "completed";
  const isRunning   = run.status === "running";
  const isFailed    = run.status === "failed";

  const dotColor = isCompleted ? "bg-primary" : isRunning ? "bg-amber-400" : "bg-destructive";
  const statusLabel = isCompleted ? "Zakończony" : isRunning ? "W trakcie" : "Błąd";

  const cacheHitPct = Math.round((run.cache_hit_rate || 0) * 100);
  const duration = run.duration_seconds
    ? run.duration_seconds < 60 ? `${run.duration_seconds}s` : `${Math.floor(run.duration_seconds / 60)}m ${run.duration_seconds % 60}s`
    : "—";

  return (
    <div className="relative pl-12">
      {/* Timeline dot */}
      <div className={`absolute left-3.5 top-4 w-3 h-3 rounded-full border-2 border-background ${dotColor} ${isFirst && isCompleted ? "pulse-emerald" : ""}`} />

      <div className={`bg-card rounded-xl border transition-all duration-200 ${isExpanded ? "border-primary/30" : "border-border hover:border-primary/20"}`}>
        {/* Header */}
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-3 p-4 text-left"
        >
          {isCompleted ? <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" /> :
           isRunning   ? <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 animate-spin" /> :
                         <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground capitalize">{run.run_type}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                isCompleted ? "bg-primary/15 text-primary" :
                isRunning   ? "bg-amber-400/15 text-amber-400" :
                              "bg-destructive/15 text-destructive"
              }`}>{statusLabel}</span>
              {isFirst && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Ostatni</span>}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {formatDateTime(run.started_at)} · {duration}
            </div>
          </div>

          {/* Quick stats */}
          <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground mr-2">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" /> +{run.experiences_added || 0}
            </span>
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3" /> {(run.tokens_used || 0).toLocaleString()}
            </span>
          </div>

          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> :
                        <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Notatki przeskanowane", value: run.notes_scanned || 0 },
                { label: "Nowe wnioski", value: run.experiences_added || 0 },
                { label: "Zaktualizowane", value: run.experiences_updated || 0 },
                { label: "Zdeprecjonowane", value: run.experiences_deprecated || 0 },
              ].map((s) => (
                <div key={s.label} className="bg-muted/30 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-foreground">{s.value}</div>
                  <div className="text-[10px] text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Token efficiency */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Cache hit rate</span>
                <span className="text-foreground font-medium">{cacheHitPct}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${cacheHitPct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Użyte: {(run.tokens_used || 0).toLocaleString()} tokenów</span>
                <span>Zaoszczędzone: {(run.tokens_saved_cache || 0).toLocaleString()}</span>
              </div>
            </div>

            {/* Cost + model */}
            <div className="flex items-center justify-between bg-primary/5 border border-primary/10 rounded-lg px-4 py-2">
              <div className="text-xs text-muted-foreground">
                Model: <span className="font-mono text-foreground">{run.model_used || "gpt-4.1-mini"}</span>
              </div>
              <div className="text-sm font-bold text-primary font-mono">
                ${(run.cost_estimate_usd || 0).toFixed(5)}
              </div>
            </div>

            {/* Summary markdown */}
            {run.summary_md && (
              <div className="bg-muted/20 rounded-lg p-4 text-sm prose prose-invert prose-sm max-w-none">
                <Streamdown>{run.summary_md}</Streamdown>
              </div>
            )}

            {/* Error */}
            {run.error_message && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-xs text-destructive">
                {run.error_message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString("pl-PL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}
