/*
 * PatternsPanel — wzorce i anty-wzorce wykryte przez Manusa
 * Design: Dark Intelligence Dashboard | Emerald accents
 */

import { Zap, AlertTriangle, CheckCircle2, Workflow, TrendingUp } from "lucide-react";

interface PatternsPanelProps {
  patterns: any[];
}

const typeConfig: Record<string, { icon: any; color: string; label: string; bg: string }> = {
  anti_pattern: { icon: AlertTriangle, color: "text-red-400", label: "Anty-wzorzec", bg: "bg-red-400/10 border-red-400/20" },
  pitfall:      { icon: Zap,           color: "text-yellow-400", label: "Pułapka",      bg: "bg-yellow-400/10 border-yellow-400/20" },
  best_practice:{ icon: CheckCircle2,  color: "text-primary",    label: "Dobra praktyka", bg: "bg-primary/10 border-primary/20" },
  workflow:     { icon: Workflow,      color: "text-blue-400",   label: "Workflow",     bg: "bg-blue-400/10 border-blue-400/20" },
};

export default function PatternsPanel({ patterns }: PatternsPanelProps) {
  if (!patterns.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <TrendingUp className="w-10 h-10 opacity-30" />
        <p className="text-sm">Brak wykrytych wzorców. System uczy się w nocy.</p>
      </div>
    );
  }

  const grouped = patterns.reduce((acc: Record<string, any[]>, p) => {
    const type = p.pattern_type || "workflow";
    if (!acc[type]) acc[type] = [];
    acc[type].push(p);
    return acc;
  }, {});

  const typeOrder = ["anti_pattern", "pitfall", "best_practice", "workflow"];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Wzorce i Anty-wzorce</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Wykryte przez Manusa na podstawie {patterns.reduce((s, p) => s + (p.occurrence_count || 1), 0)} obserwacji
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {typeOrder.map((type) => {
          const cfg = typeConfig[type] || typeConfig.workflow;
          const Icon = cfg.icon;
          const count = (grouped[type] || []).length;
          return (
            <div key={type} className={`glass-card rounded-lg p-3 border ${cfg.bg} flex items-center gap-3`}>
              <Icon className={`w-5 h-5 ${cfg.color} flex-shrink-0`} />
              <div>
                <div className="text-lg font-display font-bold text-foreground">{count}</div>
                <div className="text-xs text-muted-foreground">{cfg.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Patterns list */}
      <div className="space-y-3">
        {typeOrder.flatMap((type) =>
          (grouped[type] || []).map((pattern) => {
            const cfg = typeConfig[type] || typeConfig.workflow;
            const Icon = cfg.icon;
            const tags = Array.isArray(pattern.tags) ? pattern.tags : [];
            return (
              <div key={pattern.id} className="glass-card rounded-xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg ${cfg.bg} border flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">{pattern.pattern_name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {pattern.occurrence_count || 1}× wykryto
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80 mt-1">{pattern.description}</p>
                  </div>
                </div>

                {pattern.trigger_context && (
                  <div className="pl-11">
                    <p className="text-xs text-muted-foreground">
                      <span className="text-muted-foreground/60 uppercase tracking-wide font-medium">Kiedy: </span>
                      {pattern.trigger_context}
                    </p>
                  </div>
                )}

                {pattern.recommended_action && (
                  <div className="pl-11 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-primary/90">{pattern.recommended_action}</p>
                  </div>
                )}

                {tags.length > 0 && (
                  <div className="pl-11 flex flex-wrap gap-1.5">
                    {tags.map((tag: string) => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Confidence bar */}
                <div className="pl-11 flex items-center gap-3">
                  <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(pattern.confidence || 0.5) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {Math.round((pattern.confidence || 0.5) * 100)}% pewność
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
