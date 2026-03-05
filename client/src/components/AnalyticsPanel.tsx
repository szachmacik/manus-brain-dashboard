/**
 * AnalyticsPanel — wykresy trendów, aktywność, koszty AI, wzrost bazy wiedzy
 * Używa recharts (już w zależnościach projektu)
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { TrendingUp, Brain, Zap, DollarSign, Activity, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Period = "7d" | "30d" | "90d";

const COLORS = {
  emerald: "#10b981",
  blue: "#3b82f6",
  purple: "#a855f7",
  amber: "#f59e0b",
  red: "#ef4444",
  gray: "#6b7280",
};

const PROVIDER_COLORS: Record<string, string> = {
  manus: COLORS.emerald,
  claude: COLORS.purple,
  kimi: COLORS.blue,
  deepseek: COLORS.amber,
};

export default function AnalyticsPanel() {
  const [period, setPeriod] = useState<Period>("30d");

  const { data, isLoading, refetch } = trpc.brain.analytics.useQuery(
    { period },
    { staleTime: 120000 }
  );

  const periodLabel = { "7d": "7 dni", "30d": "30 dni", "90d": "90 dni" }[period];

  const providerData = data ? Object.entries(data.ai.byProvider).map(([name, count]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: count,
    color: PROVIDER_COLORS[name] ?? COLORS.gray,
  })) : [];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-gray-900 border border-white/10 rounded-lg p-3 text-xs shadow-xl">
        <p className="text-gray-400 mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color ?? p.fill }} className="font-medium">
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col gap-5 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white font-display">Analityka Systemu</h2>
          <p className="text-sm text-gray-400 mt-0.5">Trendy, aktywność i koszty w czasie</p>
        </div>
        <div className="flex items-center gap-2">
          {(["7d", "30d", "90d"] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                period === p
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-400/30"
                  : "text-gray-400 hover:text-white border border-transparent hover:border-white/10"
              }`}
            >
              {p === "7d" ? "7 dni" : p === "30d" ? "30 dni" : "90 dni"}
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-gray-400 hover:text-white h-8 w-8 p-0">
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center gap-3 text-gray-400">
          <Loader2 size={20} className="animate-spin text-emerald-400" />
          <span>Ładowanie analityki...</span>
        </div>
      ) : data ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Nowe doświadczenia", value: data.growth.newExperiences, icon: <Brain size={16} />, color: "emerald", suffix: "" },
              { label: "Nowe notatki", value: data.growth.newNotes, icon: <Activity size={16} />, color: "blue", suffix: "" },
              { label: "Wywołania AI", value: data.ai.totalCalls, icon: <Zap size={16} />, color: "purple", suffix: "" },
              { label: "Koszt AI", value: data.ai.totalCost.toFixed(4), icon: <DollarSign size={16} />, color: "amber", suffix: "$" },
            ].map((kpi, i) => (
              <div key={i} className="p-4 rounded-xl bg-white/3 border border-white/8">
                <div className={`text-${kpi.color}-400 mb-2`}>{kpi.icon}</div>
                <div className="text-2xl font-bold text-white font-mono">{kpi.suffix}{kpi.value}</div>
                <div className="text-xs text-gray-400 mt-1">{kpi.label}</div>
                <div className="text-xs text-gray-500">ostatnie {periodLabel}</div>
              </div>
            ))}
          </div>

          {/* Activity Timeline Chart */}
          {data.activity.length > 0 && (
            <div className="p-4 rounded-xl bg-white/3 border border-white/8">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} className="text-emerald-400" />
                <h3 className="text-sm font-medium text-white">Aktywność systemu w czasie</h3>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data.activity} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <defs>
                    <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false}
                    tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="count" name="Aktywności" stroke={COLORS.emerald} strokeWidth={2} fill="url(#actGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* AI Provider Distribution */}
            {providerData.length > 0 && (
              <div className="p-4 rounded-xl bg-white/3 border border-white/8">
                <div className="flex items-center gap-2 mb-4">
                  <Zap size={16} className="text-purple-400" />
                  <h3 className="text-sm font-medium text-white">Użycie modeli AI</h3>
                </div>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={140}>
                    <PieChart>
                      <Pie data={providerData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3} dataKey="value">
                        {providerData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {providerData.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                          <span className="text-gray-300">{p.name}</span>
                        </div>
                        <span className="text-white font-mono">{p.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Notifications by Type */}
            {Object.keys(data.notifications.byType).length > 0 && (
              <div className="p-4 rounded-xl bg-white/3 border border-white/8">
                <div className="flex items-center gap-2 mb-4">
                  <Activity size={16} className="text-blue-400" />
                  <h3 className="text-sm font-medium text-white">Powiadomienia wg typu</h3>
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart
                    data={Object.entries(data.notifications.byType).map(([type, count]) => ({ type: type.replace("_", " "), count }))}
                    margin={{ top: 5, right: 5, bottom: 5, left: -20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="type" tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Powiadomienia" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-white/3 border border-white/8 text-center">
              <div className="text-lg font-bold text-white font-mono">{data.growth.learningRuns}</div>
              <div className="text-xs text-gray-400">Nocne runy</div>
            </div>
            <div className="p-3 rounded-xl bg-white/3 border border-white/8 text-center">
              <div className="text-lg font-bold text-emerald-400 font-mono">{data.growth.avgHealthScore}%</div>
              <div className="text-xs text-gray-400">Śr. Health Score</div>
            </div>
            <div className="p-3 rounded-xl bg-white/3 border border-white/8 text-center">
              <div className="text-lg font-bold text-purple-400 font-mono">{data.ai.avgLatency}ms</div>
              <div className="text-xs text-gray-400">Śr. latencja AI</div>
            </div>
          </div>

          {/* Empty state for charts */}
          {data.activity.length === 0 && providerData.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-8">
              <div className="w-14 h-14 rounded-2xl bg-blue-400/10 border border-blue-400/20 flex items-center justify-center">
                <TrendingUp size={24} className="text-blue-400" />
              </div>
              <div>
                <p className="text-white font-medium">Brak danych za okres {periodLabel}</p>
                <p className="text-sm text-gray-400 mt-1">Dane pojawią się po pierwszym nocnym runie uczenia się</p>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
