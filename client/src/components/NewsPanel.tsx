/**
 * NewsPanel — Panel Aktualności Technologicznych
 * Filtrowanie po kategorii, oznaczanie jako przeczytane, AI insights
 * Design: Dark Intelligence Dashboard (emerald + violet accents)
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Newspaper, CheckCheck, Sparkles, ExternalLink, Tag,
  Loader2, AlertCircle, BookOpen, Filter, TrendingUp,
  Cpu, Globe, Server, TestTube, Layers, RefreshCw, Trash2, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ── Kategorie ────────────────────────────────────────────────────────────────
const CATEGORIES: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  all:            { label: "Wszystkie",    icon: <Newspaper size={13} />,  color: "text-gray-300",   bg: "bg-gray-500/20" },
  "ai-ml":        { label: "AI / ML",      icon: <Cpu size={13} />,        color: "text-violet-400", bg: "bg-violet-500/20" },
  frontend:       { label: "Frontend",     icon: <Layers size={13} />,     color: "text-blue-400",   bg: "bg-blue-500/20" },
  backend:        { label: "Backend",      icon: <Server size={13} />,     color: "text-emerald-400",bg: "bg-emerald-500/20" },
  devops:         { label: "DevOps",       icon: <Globe size={13} />,      color: "text-orange-400", bg: "bg-orange-500/20" },
  infrastructure: { label: "Infrastruktura",icon: <TrendingUp size={13} />,color: "text-cyan-400",   bg: "bg-cyan-500/20" },
  testing:        { label: "Testy",        icon: <TestTube size={13} />,   color: "text-pink-400",   bg: "bg-pink-500/20" },
  general:        { label: "Ogólne",       icon: <Tag size={13} />,        color: "text-gray-400",   bg: "bg-gray-500/20" },
};

function importanceColor(n: number): string {
  if (n >= 9) return "text-red-400";
  if (n >= 7) return "text-orange-400";
  if (n >= 5) return "text-yellow-400";
  return "text-gray-500";
}

function importanceLabel(n: number): string {
  if (n >= 9) return "Krytyczne";
  if (n >= 7) return "Ważne";
  if (n >= 5) return "Średnie";
  return "Niskie";
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "przed chwilą";
  if (h < 24) return `${h}h temu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d temu`;
  return new Date(date).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

// ── NewsCard ─────────────────────────────────────────────────────────────────
function NewsCard({ item, onRead, onDelete, onInsights }: {
  item: any;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onInsights: (id: string, title: string, summary: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORIES[item.category] ?? CATEGORIES.general;

  return (
    <div
      className={`rounded-xl border transition-all cursor-pointer ${
        item.is_read
          ? "border-white/6 bg-white/2 opacity-70"
          : "border-white/10 bg-white/4 hover:border-white/15 hover:bg-white/6"
      }`}
      onClick={() => { setExpanded(e => !e); if (!item.is_read) onRead(item.id); }}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Importance indicator */}
          <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
            item.importance >= 9 ? "bg-red-400" :
            item.importance >= 7 ? "bg-orange-400" :
            item.importance >= 5 ? "bg-yellow-400" : "bg-gray-600"
          }`} />

          <div className="flex-1 min-w-0">
            {/* Title */}
            <div className={`text-sm font-medium leading-snug ${item.is_read ? "text-gray-400" : "text-white"}`}>
              {item.title}
            </div>

            {/* Meta */}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${cat.bg} ${cat.color}`}>
                {cat.icon} {cat.label}
              </span>
              <span className={`text-xs font-medium ${importanceColor(item.importance)}`}>
                {importanceLabel(item.importance)}
              </span>
              {item.source && (
                <span className="text-xs text-gray-500">{item.source}</span>
              )}
              <span className="text-xs text-gray-600">{timeAgo(item.created_at)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            {item.source_url && (
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                title="Otwórz źródło"
              >
                <ExternalLink size={13} />
              </a>
            )}
            <button
              onClick={() => onDelete(item.id)}
              className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title="Usuń"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/6 pt-3 space-y-3" onClick={e => e.stopPropagation()}>
          {item.summary && (
            <p className="text-sm text-gray-300 leading-relaxed">{item.summary}</p>
          )}

          {/* Tags */}
          {item.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag: string) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded bg-white/5 text-gray-400">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* AI Insights */}
          {item.ai_insights ? (
            <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles size={12} className="text-violet-400" />
                <span className="text-xs font-medium text-violet-400">AI Insights</span>
              </div>
              <p className="text-xs text-violet-200 leading-relaxed">{item.ai_insights}</p>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onInsights(item.id, item.title, item.summary ?? "")}
              className="text-xs h-7 border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
            >
              <Sparkles size={11} className="mr-1.5" />
              Generuj AI Insights
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── AddNewsForm ──────────────────────────────────────────────────────────────
function AddNewsForm({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("general");
  const [source, setSource] = useState("");
  const [importance, setImportance] = useState(5);

  const addMutation = trpc.news.add.useMutation({
    onSuccess: () => { toast.success("Aktualność dodana"); onAdded(); onClose(); },
    onError: (e) => toast.error(`Błąd: ${e.message}`),
  });

  return (
    <div className="p-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5 space-y-3">
      <h3 className="text-sm font-medium text-emerald-400">Dodaj aktualność</h3>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Tytuł aktualności..."
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-400/40"
      />
      <textarea
        value={summary}
        onChange={e => setSummary(e.target.value)}
        placeholder="Krótkie podsumowanie..."
        rows={2}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-400/40 resize-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
        >
          {Object.entries(CATEGORIES).filter(([k]) => k !== "all").map(([k, v]) => (
            <option key={k} value={k} className="bg-gray-900">{v.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Ważność:</span>
          <input
            type="number"
            min={1} max={10}
            value={importance}
            onChange={e => setImportance(Number(e.target.value))}
            className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-sm text-white focus:outline-none"
          />
        </div>
      </div>
      <input
        value={source}
        onChange={e => setSource(e.target.value)}
        placeholder="Źródło (opcjonalnie)..."
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => addMutation.mutate({ title, summary, category, source, importance })}
          disabled={!title.trim() || addMutation.isPending}
          className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-400/30"
        >
          {addMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          <span className="ml-1.5">Dodaj</span>
        </Button>
        <Button size="sm" variant="outline" onClick={onClose} className="text-gray-400">
          Anuluj
        </Button>
      </div>
    </div>
  );
}

// ── Main NewsPanel ────────────────────────────────────────────────────────────
export default function NewsPanel() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const listQuery = trpc.news.list.useQuery(
    { category: activeCategory, unreadOnly, limit: 50 },
    { staleTime: 30000 }
  );
  const statsQuery = trpc.news.stats.useQuery(undefined, { staleTime: 30000 });

  const markReadMutation = trpc.news.markRead.useMutation({
    onSuccess: () => { listQuery.refetch(); statsQuery.refetch(); },
  });
  const markAllReadMutation = trpc.news.markAllRead.useMutation({
    onSuccess: (data) => {
      toast.success(`Oznaczono ${data.count} jako przeczytane`);
      listQuery.refetch();
      statsQuery.refetch();
    },
  });
  const deleteMutation = trpc.news.delete.useMutation({
    onSuccess: () => { listQuery.refetch(); statsQuery.refetch(); },
    onError: (e) => toast.error(`Błąd usuwania: ${e.message}`),
  });
  const insightsMutation = trpc.news.generateInsights.useMutation({
    onSuccess: (data) => {
      if (data.success) { toast.success("AI Insights wygenerowane"); listQuery.refetch(); }
      else toast.error("Błąd generowania insights");
    },
  });

  const stats = statsQuery.data;
  const items = listQuery.data?.items ?? [];

  // Category counts from stats
  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of stats?.byCategory ?? []) m[c.category] = c.count;
    return m;
  }, [stats]);

  return (
    <div className="h-full flex flex-col gap-4 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white font-display flex items-center gap-2">
            <Newspaper size={20} className="text-emerald-400" />
            Aktualności Technologiczne
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">Śledzenie zmian w stacku Manus Brain</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddForm(f => !f)}
            className="text-xs h-7 border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10"
          >
            <Plus size={12} className="mr-1" /> Dodaj
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => listQuery.refetch()}
            disabled={listQuery.isFetching}
            className="text-xs h-7 border-white/10 text-gray-400"
          >
            <RefreshCw size={12} className={listQuery.isFetching ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Łącznie", value: stats.total, color: "text-white" },
            { label: "Nieprzeczytane", value: stats.unread, color: "text-emerald-400" },
            { label: "Krytyczne (≥8)", value: stats.highImportance, color: "text-red-400" },
            { label: "Kategorie", value: stats.byCategory.length, color: "text-violet-400" },
          ].map(s => (
            <div key={s.label} className="p-3 rounded-xl bg-white/3 border border-white/6 text-center">
              <div className={`text-2xl font-bold font-display ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <AddNewsForm
          onClose={() => setShowAddForm(false)}
          onAdded={() => { listQuery.refetch(); statsQuery.refetch(); }}
        />
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={13} className="text-gray-500 shrink-0" />
        {Object.entries(CATEGORIES).map(([key, cat]) => {
          const count = key === "all" ? (stats?.total ?? 0) : (catCounts[key] ?? 0);
          if (key !== "all" && count === 0) return null;
          return (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all ${
                activeCategory === key
                  ? `${cat.bg} ${cat.color} border border-current/30`
                  : "bg-white/3 text-gray-400 border border-white/6 hover:border-white/15"
              }`}
            >
              {cat.icon} {cat.label}
              {count > 0 && <span className="opacity-60">({count})</span>}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setUnreadOnly(u => !u)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all border ${
              unreadOnly
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-400/30"
                : "bg-white/3 text-gray-400 border-white/6 hover:border-white/15"
            }`}
          >
            <BookOpen size={11} /> Nieprzeczytane
          </button>
          {(stats?.unread ?? 0) > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="text-xs h-7 border-white/10 text-gray-400 hover:text-white"
            >
              <CheckCheck size={12} className="mr-1" />
              Wszystkie przeczytane
            </Button>
          )}
        </div>
      </div>

      {/* News List */}
      {listQuery.isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <Loader2 size={20} className="animate-spin mr-2" /> Ładowanie aktualności...
        </div>
      ) : listQuery.isError ? (
        <div className="flex items-center gap-2 py-8 text-red-400 text-sm justify-center">
          <AlertCircle size={16} /> Błąd ładowania aktualności
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Newspaper size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">Brak aktualności</p>
          <p className="text-xs mt-1">
            {unreadOnly ? "Wszystkie przeczytane!" : "Dodaj pierwszą aktualność klikając \"+Dodaj\""}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <NewsCard
              key={item.id}
              item={item}
              onRead={(id) => markReadMutation.mutate({ id })}
              onDelete={(id) => deleteMutation.mutate({ id })}
              onInsights={(id, title, summary) =>
                insightsMutation.mutate({ id, title, summary })
              }
            />
          ))}
          <div className="text-center text-xs text-gray-600 py-2">
            {items.length} z {listQuery.data?.total ?? 0} aktualności
          </div>
        </div>
      )}
    </div>
  );
}
