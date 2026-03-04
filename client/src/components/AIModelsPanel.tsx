/**
 * AIModelsPanel — Multi-AI Router Dashboard
 * Pokazuje: dostępne modele, test połączenia, chat, statystyki użycia, auto-routing
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const PROVIDER_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  claude:   { bg: "bg-[#d97706]/10",  border: "border-[#d97706]/30",  text: "text-[#d97706]",  badge: "bg-[#d97706]/20 text-[#d97706]" },
  kimi:     { bg: "bg-[#8b5cf6]/10",  border: "border-[#8b5cf6]/30",  text: "text-[#8b5cf6]",  badge: "bg-[#8b5cf6]/20 text-[#8b5cf6]" },
  deepseek: { bg: "bg-[#06b6d4]/10",  border: "border-[#06b6d4]/30",  text: "text-[#06b6d4]",  badge: "bg-[#06b6d4]/20 text-[#06b6d4]" },
  manus:    { bg: "bg-primary/10",    border: "border-primary/30",    text: "text-primary",    badge: "bg-primary/20 text-primary" },
};

const PROVIDER_ICONS: Record<string, string> = {
  claude: "🟠",
  kimi: "🟣",
  deepseek: "🔵",
  manus: "🟢",
};

const TASK_TYPES = [
  { value: "general",   label: "Ogólne" },
  { value: "code",      label: "Kod" },
  { value: "analysis",  label: "Analiza" },
  { value: "reasoning", label: "Rozumowanie" },
  { value: "synthesis", label: "Synteza" },
  { value: "longdoc",   label: "Długi dokument" },
  { value: "security",  label: "Bezpieczeństwo" },
  { value: "database",  label: "Baza danych" },
];

type TestResult = {
  provider: string;
  success: boolean;
  latencyMs: number;
  response?: string;
  error?: string;
};

export default function AIModelsPanel() {
  const [activeTab, setActiveTab] = useState<"models" | "chat" | "stats">("models");
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  // Chat state
  const [selectedModel, setSelectedModel] = useState("manus-default");
  const [taskType, setTaskType] = useState("general");
  const [preferCheap, setPreferCheap] = useState(false);
  const [useAutoRoute, setUseAutoRoute] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; content: string; model?: string; cost?: number; latency?: number }>>([]);

  // tRPC
  const { data: models = [], isLoading: modelsLoading } = trpc.ai.listModels.useQuery();
  const { data: stats } = trpc.ai.usageStats.useQuery();
  const testConnection = trpc.ai.testConnection.useMutation();
  const chatMutation = trpc.ai.chat.useMutation();
  const autoRouteMutation = trpc.ai.autoRoute.useMutation();

  const handleTest = async (provider: "claude" | "kimi" | "deepseek" | "manus") => {
    setTestingProvider(provider);
    try {
      const result = await testConnection.mutateAsync({ provider });
      setTestResults(prev => ({ ...prev, [provider]: result }));
      if (result.success) {
        toast.success(`${provider} — połączenie OK (${result.latencyMs}ms)`);
      } else {
        toast.error(`${provider} — błąd: ${result.error}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Błąd połączenia";
      setTestResults(prev => ({ ...prev, [provider]: { provider, success: false, latencyMs: 0, error: msg } }));
      toast.error(`${provider} — ${msg}`);
    } finally {
      setTestingProvider(null);
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = { role: "user" as const, content: chatInput };
    setChatHistory(prev => [...prev, { role: "user", content: chatInput }]);
    setChatInput("");

    try {
      let result;
      if (useAutoRoute) {
        result = await autoRouteMutation.mutateAsync({
          messages: [userMsg],
          taskType: taskType as "code" | "analysis" | "reasoning" | "synthesis" | "longdoc" | "security" | "database" | "general",
          preferCheap,
          maxTokens: 2000,
        });
      } else {
        result = await chatMutation.mutateAsync({
          modelId: selectedModel,
          messages: [userMsg],
          taskType,
          maxTokens: 2000,
        });
      }

      setChatHistory(prev => [...prev, {
        role: "assistant",
        content: result.content,
        model: result.modelId,
        cost: result.costUsd,
        latency: result.latencyMs,
      }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Błąd";
      toast.error(`Błąd AI: ${msg}`);
      setChatHistory(prev => [...prev, { role: "assistant", content: `❌ Błąd: ${msg}` }]);
    }
  };

  const providerGroups = ["claude", "kimi", "deepseek", "manus"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold font-display text-foreground">Multi-AI Router</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Claude · Kimi K2 · DeepSeek V3 · Manus — jeden endpoint dla wszystkich projektów
          </p>
        </div>
        <div className="flex gap-1 p-1 bg-muted/30 rounded-lg border border-border">
          {(["models", "chat", "stats"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "models" ? "🤖 Modele" : tab === "chat" ? "💬 Chat" : "📊 Statystyki"}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: MODELE ─────────────────────────────────────────────────── */}
      {activeTab === "models" && (
        <div className="space-y-4">
          {modelsLoading ? (
            <div className="text-center py-12 text-muted-foreground">Ładowanie modeli...</div>
          ) : (
            providerGroups.map(provider => {
              const providerModels = models.filter(m => m.provider === provider);
              const colors = PROVIDER_COLORS[provider];
              const testResult = testResults[provider];
              const isTesting = testingProvider === provider;

              return (
                <div key={provider} className={`rounded-xl border ${colors.border} ${colors.bg} p-4`}>
                  {/* Provider header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{PROVIDER_ICONS[provider]}</span>
                      <span className={`font-semibold text-sm ${colors.text} uppercase tracking-wider`}>
                        {provider === "kimi" ? "Kimi (Moonshot)" : provider === "manus" ? "Manus Built-in" : provider.charAt(0).toUpperCase() + provider.slice(1)}
                      </span>
                      {providerModels[0]?.available ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400 font-medium">
                          ✓ Dostępny
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400 font-medium">
                          ✗ Brak klucza API
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {testResult && (
                        <span className={`text-xs ${testResult.success ? "text-emerald-400" : "text-red-400"}`}>
                          {testResult.success ? `✓ ${testResult.latencyMs}ms` : `✗ ${testResult.error?.substring(0, 30)}`}
                        </span>
                      )}
                      <button
                        onClick={() => handleTest(provider as "claude" | "kimi" | "deepseek" | "manus")}
                        disabled={isTesting || !providerModels[0]?.available}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                          isTesting
                            ? "opacity-50 cursor-not-allowed border-border text-muted-foreground"
                            : providerModels[0]?.available
                              ? `${colors.border} ${colors.text} hover:${colors.bg}`
                              : "opacity-30 cursor-not-allowed border-border text-muted-foreground"
                        }`}
                      >
                        {isTesting ? "⟳ Test..." : "Testuj"}
                      </button>
                    </div>
                  </div>

                  {/* Models grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {providerModels.map(model => (
                      <div
                        key={model.id}
                        className="bg-background/40 rounded-lg p-3 border border-border/50 cursor-pointer hover:border-primary/30 transition-all"
                        onClick={() => { setSelectedModel(model.id); setActiveTab("chat"); }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{model.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{model.description}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-muted-foreground">
                              ${model.outputCostPer1M === 0 ? "free" : model.outputCostPer1M.toFixed(2)}/1M
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {model.contextWindow >= 200000 ? "200K" : model.contextWindow >= 128000 ? "128K" : "32K"} ctx
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {model.strengths.slice(0, 3).map(s => (
                            <span key={s} className={`px-1.5 py-0.5 rounded text-[10px] ${colors.badge}`}>{s}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Instrukcja dodania klucza */}
                  {!providerModels[0]?.available && provider !== "manus" && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      Dodaj {provider === "claude" ? "ANTHROPIC_API_KEY" : provider === "kimi" ? "MOONSHOT_API_KEY" : "DEEPSEEK_API_KEY"} w panelu Secrets → system aktywuje się automatycznie
                    </p>
                  )}
                </div>
              );
            })
          )}

          {/* Routing table */}
          <div className="rounded-xl border border-border bg-card/30 p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">🗺️ Tabela Auto-Routingu</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Typ zadania</th>
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium">1. wybór</th>
                    <th className="text-left py-2 pr-4 text-muted-foreground font-medium">2. wybór</th>
                    <th className="text-left py-2 text-muted-foreground font-medium">Fallback</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { task: "Kod", p1: "Claude", p2: "DeepSeek", fb: "Manus" },
                    { task: "Analiza", p1: "Claude", p2: "Kimi", fb: "Manus" },
                    { task: "Rozumowanie", p1: "DeepSeek R1", p2: "Claude", fb: "Manus" },
                    { task: "Synteza/RAG", p1: "DeepSeek", p2: "Kimi", fb: "Manus" },
                    { task: "Długi dokument", p1: "Kimi 128K", p2: "Claude 200K", fb: "Manus" },
                    { task: "Bezpieczeństwo", p1: "Claude", p2: "DeepSeek", fb: "Manus" },
                    { task: "Baza danych", p1: "Kimi", p2: "DeepSeek", fb: "Manus" },
                  ].map(row => (
                    <tr key={row.task} className="border-b border-border/30 hover:bg-muted/10">
                      <td className="py-1.5 pr-4 text-foreground font-medium">{row.task}</td>
                      <td className="py-1.5 pr-4">
                        <span className="px-1.5 py-0.5 rounded bg-[#d97706]/20 text-[#d97706]">{row.p1}</span>
                      </td>
                      <td className="py-1.5 pr-4">
                        <span className="px-1.5 py-0.5 rounded bg-[#06b6d4]/20 text-[#06b6d4]">{row.p2}</span>
                      </td>
                      <td className="py-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary">{row.fb}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: CHAT ───────────────────────────────────────────────────── */}
      {activeTab === "chat" && (
        <div className="space-y-4">
          {/* Config bar */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/20 rounded-xl border border-border">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useAutoRoute}
                onChange={e => setUseAutoRoute(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm text-foreground font-medium">Auto-routing</span>
            </label>

            {!useAutoRoute && (
              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-background border border-border text-sm text-foreground"
              >
                {models.map(m => (
                  <option key={m.id} value={m.id} disabled={!m.available}>
                    {PROVIDER_ICONS[m.provider]} {m.name} {!m.available ? "(brak klucza)" : ""}
                  </option>
                ))}
              </select>
            )}

            <select
              value={taskType}
              onChange={e => setTaskType(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-background border border-border text-sm text-foreground"
            >
              {TASK_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            {useAutoRoute && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferCheap}
                  onChange={e => setPreferCheap(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm text-muted-foreground">Preferuj tanie modele</span>
              </label>
            )}
          </div>

          {/* Chat history */}
          <div className="min-h-[300px] max-h-[500px] overflow-y-auto space-y-3 p-4 bg-background/30 rounded-xl border border-border">
            {chatHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <p className="text-3xl mb-3">🤖</p>
                <p className="text-muted-foreground text-sm">Zadaj pytanie dowolnemu modelowi AI</p>
                <p className="text-muted-foreground/60 text-xs mt-1">
                  {useAutoRoute ? "Auto-routing dobierze najlepszy model" : `Wybrany: ${selectedModel}`}
                </p>
              </div>
            ) : (
              chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 border border-border text-foreground"
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {msg.model && (
                      <p className="text-[10px] mt-1.5 opacity-60">
                        {msg.model} · {msg.latency}ms · ${msg.cost?.toFixed(6)}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
            {(chatMutation.isPending || autoRouteMutation.isPending) && (
              <div className="flex justify-start">
                <div className="bg-muted/40 border border-border rounded-xl px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <textarea
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChat(); } }}
              placeholder="Wpisz wiadomość... (Enter = wyślij, Shift+Enter = nowa linia)"
              rows={2}
              className="flex-1 px-4 py-3 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary/50"
            />
            <button
              onClick={handleChat}
              disabled={!chatInput.trim() || chatMutation.isPending || autoRouteMutation.isPending}
              className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Wyślij
            </button>
          </div>

          {chatHistory.length > 0 && (
            <button
              onClick={() => setChatHistory([])}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Wyczyść historię
            </button>
          )}
        </div>
      )}

      {/* ── TAB: STATYSTYKI ─────────────────────────────────────────────── */}
      {activeTab === "stats" && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(stats?.summary ?? []).map(s => {
              const colors = PROVIDER_COLORS[s.provider] ?? PROVIDER_COLORS.manus;
              return (
                <div key={s.provider} className={`rounded-xl border ${colors.border} ${colors.bg} p-4`}>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
                    {PROVIDER_ICONS[s.provider]} {s.provider}
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">{s.calls}</p>
                  <p className="text-xs text-muted-foreground">wywołań</p>
                  <p className="text-xs text-muted-foreground mt-1">${s.totalCost.toFixed(4)} łącznie</p>
                  <p className="text-xs text-muted-foreground">{Math.round(s.avgLatency)}ms avg</p>
                </div>
              );
            })}
            {(stats?.summary ?? []).length === 0 && (
              <div className="col-span-4 text-center py-8 text-muted-foreground text-sm">
                Brak danych — użyj chatu żeby wygenerować statystyki
              </div>
            )}
          </div>

          {/* Recent logs */}
          {(stats?.logs ?? []).length > 0 && (
            <div className="rounded-xl border border-border bg-card/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Ostatnie wywołania</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left px-4 py-2 text-muted-foreground">Model</th>
                      <th className="text-left px-4 py-2 text-muted-foreground">Typ</th>
                      <th className="text-right px-4 py-2 text-muted-foreground">Tokeny</th>
                      <th className="text-right px-4 py-2 text-muted-foreground">Koszt</th>
                      <th className="text-right px-4 py-2 text-muted-foreground">Czas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats?.logs ?? []).slice(-20).reverse().map(log => {
                      const colors = PROVIDER_COLORS[log.provider] ?? PROVIDER_COLORS.manus;
                      return (
                        <tr key={log.id} className="border-b border-border/30 hover:bg-muted/10">
                          <td className="px-4 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${colors.badge}`}>
                              {log.modelId.split("-").slice(0, 2).join("-")}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">{log.taskType}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground">
                            {((log.inputTokens ?? 0) + (log.outputTokens ?? 0)).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-right text-foreground font-mono">
                            ${parseFloat(log.costUsd ?? "0").toFixed(5)}
                          </td>
                          <td className="px-4 py-2 text-right text-muted-foreground">
                            {log.latencyMs}ms
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
