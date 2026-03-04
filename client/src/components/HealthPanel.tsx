/*
 * HealthPanel — zdrowie systemu, trendy, metryki domen
 * Design: Dark Intelligence Dashboard | Emerald accents
 * Używa Recharts do wizualizacji trendów
 */

import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { Activity, TrendingUp, Database, Zap, Shield } from "lucide-react";

interface HealthPanelProps {
  systemHealth: any[];
  domainMetrics: any[];
  graphEdges: any[];
}

const CHART_COLORS = {
  primary:    "#10b981",
  secondary:  "#3b82f6",
  warning:    "#f59e0b",
  danger:     "#ef4444",
  muted:      "#6b7280",
};

function HealthGauge({ value, label }: { value: number; label: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 70 ? CHART_COLORS.primary : pct >= 40 ? CHART_COLORS.warning : CHART_COLORS.danger;
  const circumference = 2 * Math.PI * 36;
  const dash = (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
          <circle
            cx="40" cy="40" r="36" fill="none"
            stroke={color} strokeWidth="6"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-display font-bold" style={{ color }}>{pct.toFixed(0)}</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-lg p-3 border border-border text-xs space-y-1">
      <p className="text-muted-foreground font-medium">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <span className="font-semibold">{typeof p.value === "number" ? p.value.toFixed(1) : p.value}</span></p>
      ))}
    </div>
  );
};

export default function HealthPanel({ systemHealth, domainMetrics, graphEdges }: HealthPanelProps) {
  const latest = systemHealth[systemHealth.length - 1];

  // Przygotuj dane do wykresów
  const trendData = systemHealth.map(h => ({
    date: h.snapshot_date?.slice(5) || "—",
    "Health": parseFloat(h.overall_health?.toFixed(1) || "0"),
    "Wiedza": parseFloat(h.knowledge_score?.toFixed(1) || "0"),
    "Efektywność": parseFloat(h.efficiency_score?.toFixed(1) || "0"),
    "Wzrost": parseFloat(h.growth_score?.toFixed(1) || "0"),
  }));

  const domainData = domainMetrics
    .filter((m, i, arr) => arr.findIndex(x => x.domain === m.domain) === i)
    .slice(0, 8)
    .map(m => ({
      domain: m.domain || "general",
      "Pewność": Math.round((m.avg_confidence || 0) * 100),
      "Pomocność": Math.round((m.avg_helpful_rate || 0) * 100),
      "Health": Math.round((m.health_score || 0) * 100),
    }));

  const costData = systemHealth.map(h => ({
    date: h.snapshot_date?.slice(5) || "—",
    "Koszt $": parseFloat((h.total_cost_usd || 0).toFixed(4)),
    "Cache %": parseFloat(((h.cache_hit_rate_avg || 0) * 100).toFixed(1)),
  }));

  if (!systemHealth.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <Activity className="w-10 h-10 opacity-30" />
        <p className="text-sm">Brak danych o zdrowiu systemu. System uruchomi się dziś w nocy.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Stan Systemu</h2>
        <p className="text-muted-foreground text-sm mt-1">Zdrowie bazy wiedzy, trendy i efektywność</p>
      </div>

      {/* Health gauges */}
      {latest && (
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-6">Composite Health Scores</h3>
          <div className="flex flex-wrap justify-around gap-6">
            <HealthGauge value={latest.overall_health || 0} label="Overall Health" />
            <HealthGauge value={latest.knowledge_score || 0} label="Wiedza" />
            <HealthGauge value={latest.efficiency_score || 0} label="Efektywność" />
            <HealthGauge value={latest.growth_score || 0} label="Wzrost" />
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
            <div className="text-center">
              <div className="text-2xl font-display font-bold text-primary">{latest.active_experiences || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Aktywne wnioski</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-display font-bold text-foreground">{Math.round((latest.avg_confidence || 0) * 100)}%</div>
              <div className="text-xs text-muted-foreground mt-1">Śr. pewność</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-display font-bold text-blue-400">{latest.graph_edges || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Krawędzie grafu</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-display font-bold text-yellow-400">{(latest.tokens_saved_total || 0).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">Tokeny zaoszczędzone</div>
            </div>
          </div>

          {/* Alerts */}
          {Array.isArray(latest.alerts) && latest.alerts.length > 0 && (
            <div className="mt-4 space-y-2">
              {latest.alerts.map((alert: any, i: number) => (
                <div key={i} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${alert.type === "warning" ? "bg-yellow-400/10 text-yellow-400" : "bg-blue-400/10 text-blue-400"}`}>
                  <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                  {alert.msg}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Trend chart */}
      {trendData.length > 1 && (
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Trendy (ostatnie {trendData.length} dni)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradHealth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#6b7280" }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Area type="monotone" dataKey="Health" stroke={CHART_COLORS.primary} fill="url(#gradHealth)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Wiedza" stroke={CHART_COLORS.secondary} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="Efektywność" stroke={CHART_COLORS.warning} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Domain metrics */}
      {domainData.length > 0 && (
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
            <Database className="w-4 h-4" /> Metryki per Domena
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={domainData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="domain" tick={{ fontSize: 10, fill: "#6b7280" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#6b7280" }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="Pewność" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Pomocność" fill={CHART_COLORS.secondary} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cost efficiency */}
      {costData.length > 1 && (
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4" /> Efektywność Kosztowa
          </h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={costData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#6b7280" }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: "#6b7280" }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Line yAxisId="left" type="monotone" dataKey="Koszt $" stroke={CHART_COLORS.danger} strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="Cache %" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
