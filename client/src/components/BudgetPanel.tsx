/*
 * BudgetPanel — budżet kredytów i optymalizacja
 */

import { Wallet, Zap, Database, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react";
import { RadialBarChart, RadialBar, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

interface Props {
  budget: any | null;
  runs: any[];
}

export default function BudgetPanel({ budget, runs }: Props) {
  const spentPct = budget ? Math.round((budget.spent_usd / budget.budget_usd) * 100) : 0;
  const tokensPct = budget ? Math.round((budget.tokens_used / budget.tokens_budget) * 100) : 0;

  // Łączne zaoszczędzone tokeny
  const totalSaved = runs.reduce((sum, r) => sum + (r.tokens_saved_cache || 0), 0);
  const totalUsed  = runs.reduce((sum, r) => sum + (r.tokens_used || 0), 0);
  const avgCacheHit = runs.length > 0
    ? Math.round(runs.reduce((sum, r) => sum + (r.cache_hit_rate || 0), 0) / runs.length * 100)
    : 0;

  const modelConfig = budget?.model_config || {};

  // Pie chart data
  const pieData = [
    { name: "Wydane", value: budget?.spent_usd || 0, color: "oklch(0.65 0.22 15)" },
    { name: "Pozostałe", value: Math.max(0, (budget?.budget_usd || 5) - (budget?.spent_usd || 0)), color: "oklch(0.22 0.016 264)" },
  ];

  return (
    <div className="space-y-6 stagger-in">
      <div>
        <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
          Budżet i Optymalizacja
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Kontrola kosztów AI · miesięczny limit ${budget?.budget_usd || 5}
        </p>
      </div>

      {/* Alert */}
      {spentPct >= 80 && (
        <div className="flex items-center gap-3 bg-amber-400/10 border border-amber-400/20 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-amber-400">Uwaga: {spentPct}% budżetu wykorzystane</div>
            <div className="text-xs text-muted-foreground">System automatycznie ograniczy AI calls po przekroczeniu limitu</div>
          </div>
        </div>
      )}
      {spentPct < 20 && (
        <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-xl p-4">
          <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-primary">Budżet w normie — {spentPct}% wykorzystane</div>
            <div className="text-xs text-muted-foreground">Optymalizacje działają poprawnie</div>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Budget donut */}
        <div className="bg-card rounded-xl border border-border p-5 flex flex-col items-center">
          <h3 className="font-semibold text-foreground mb-4 self-start" style={{ fontFamily: "Syne, sans-serif" }}>
            Budżet miesięczny
          </h3>
          <div className="relative w-40 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" startAngle={90} endAngle={-270}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "oklch(0.17 0.014 264)", border: "1px solid oklch(1 0 0 / 8%)", borderRadius: "8px", fontSize: "11px" }}
                  formatter={(v: any) => [`$${Number(v).toFixed(5)}`, ""]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-2xl font-bold text-foreground count-up" style={{ fontFamily: "Syne, sans-serif" }}>
                {spentPct}%
              </div>
              <div className="text-[10px] text-muted-foreground">użyte</div>
            </div>
          </div>
          <div className="w-full mt-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Wydane</span>
              <span className="font-mono text-foreground">${(budget?.spent_usd || 0).toFixed(5)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Limit</span>
              <span className="font-mono text-foreground">${budget?.budget_usd || 5}.00</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Pozostało</span>
              <span className="font-mono text-primary">${((budget?.budget_usd || 5) - (budget?.spent_usd || 0)).toFixed(5)}</span>
            </div>
          </div>
        </div>

        {/* Token stats */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-4" style={{ fontFamily: "Syne, sans-serif" }}>
            Tokeny
          </h3>
          <div className="space-y-4">
            {/* Used */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Użyte w miesiącu</span>
                <span className="text-foreground font-medium">{tokensPct}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${tokensPct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>{(budget?.tokens_used || 0).toLocaleString()}</span>
                <span>{(budget?.tokens_budget || 500000).toLocaleString()}</span>
              </div>
            </div>

            {/* Cache efficiency */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Database className="w-3 h-3" /> Cache hit rate
                </span>
                <span className="text-sm font-bold text-primary">{avgCacheHit}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" /> Zaoszczędzone tokeny
                </span>
                <span className="text-sm font-bold text-primary">{totalSaved.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Łącznie użyte
                </span>
                <span className="text-sm font-medium text-foreground">{totalUsed.toLocaleString()}</span>
              </div>
            </div>

            {/* Savings ratio */}
            {(totalSaved + totalUsed) > 0 && (
              <div>
                <div className="text-xs text-muted-foreground mb-1.5">Efektywność oszczędzania</div>
                <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-primary rounded-l-full"
                    style={{ width: `${Math.round(totalSaved / (totalSaved + totalUsed) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span className="text-primary">{Math.round(totalSaved / (totalSaved + totalUsed) * 100)}% zaoszczędzone</span>
                  <span>{Math.round(totalUsed / (totalSaved + totalUsed) * 100)}% użyte</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Model config */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-4" style={{ fontFamily: "Syne, sans-serif" }}>
            Konfiguracja modeli
          </h3>
          <div className="space-y-3">
            {[
              { label: "Proste zadania", key: "simple_task", color: "text-emerald-400" },
              { label: "Standardowe", key: "standard_task", color: "text-blue-400" },
              { label: "Max tokenów/call", key: "max_tokens_per_call", color: "text-violet-400" },
              { label: "Cache TTL", key: "cache_ttl_days", suffix: " dni", color: "text-amber-400" },
              { label: "Batch size", key: "batch_size", color: "text-slate-400" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className={`text-xs font-mono font-medium ${item.color}`}>
                  {modelConfig[item.key] ?? "—"}{item.suffix || ""}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <div className="text-[10px] text-muted-foreground mb-2">Optymalizacje aktywne</div>
            {[
              "Delta-only updates",
              "Semantic cache (SHA256)",
              "Batch processing",
              "Budget guard",
              "Pre-computed dashboard",
            ].map((opt) => (
              <div key={opt} className="flex items-center gap-2 text-[11px] text-foreground py-0.5">
                <CheckCircle className="w-3 h-3 text-primary flex-shrink-0" />
                {opt}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-run costs table */}
      {runs.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-4" style={{ fontFamily: "Syne, sans-serif" }}>
            Koszty per przebieg
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-muted-foreground font-medium pb-2">Data</th>
                  <th className="text-right text-muted-foreground font-medium pb-2">Tokeny</th>
                  <th className="text-right text-muted-foreground font-medium pb-2">Zaoszczędzone</th>
                  <th className="text-right text-muted-foreground font-medium pb-2">Cache %</th>
                  <th className="text-right text-muted-foreground font-medium pb-2">Koszt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.slice(0, 10).map((run) => (
                  <tr key={run.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2 text-foreground">
                      {new Date(run.started_at).toLocaleDateString("pl-PL")}
                    </td>
                    <td className="py-2 text-right font-mono text-muted-foreground">
                      {(run.tokens_used || 0).toLocaleString()}
                    </td>
                    <td className="py-2 text-right font-mono text-primary">
                      {(run.tokens_saved_cache || 0).toLocaleString()}
                    </td>
                    <td className="py-2 text-right">
                      <span className={`${(run.cache_hit_rate || 0) > 0.6 ? "text-primary" : "text-amber-400"}`}>
                        {Math.round((run.cache_hit_rate || 0) * 100)}%
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono text-foreground">
                      ${(run.cost_estimate_usd || 0).toFixed(5)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border">
                  <td className="pt-2 text-muted-foreground font-medium">Łącznie</td>
                  <td className="pt-2 text-right font-mono font-bold text-foreground">
                    {totalUsed.toLocaleString()}
                  </td>
                  <td className="pt-2 text-right font-mono font-bold text-primary">
                    {totalSaved.toLocaleString()}
                  </td>
                  <td className="pt-2 text-right font-bold text-primary">{avgCacheHit}%</td>
                  <td className="pt-2 text-right font-mono font-bold text-foreground">
                    ${(budget?.spent_usd || 0).toFixed(5)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
