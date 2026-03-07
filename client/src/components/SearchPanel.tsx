/**
 * SearchPanel — globalny panel wyszukiwania w bazie wiedzy Manusa
 * Wyszukuje w: doświadczeniach, notatkach, projektach, wzorcach
 * Z cache SHA256, filtrami i podświetlaniem wyników
 */
import { useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Search, X, Filter, Clock, BookOpen, FileText, FolderOpen, Zap, Loader2, AlertCircle, Sparkles, Network } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type SearchScope = "experiences" | "notes" | "projects" | "patterns";

const SCOPE_CONFIG: Record<SearchScope, { label: string; icon: React.ReactNode; color: string }> = {
  experiences: { label: "Doświadczenia", icon: <BookOpen size={12} />, color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  notes: { label: "Notatki", icon: <FileText size={12} />, color: "text-blue-400 border-blue-400/30 bg-blue-400/10" },
  projects: { label: "Projekty", icon: <FolderOpen size={12} />, color: "text-purple-400 border-purple-400/30 bg-purple-400/10" },
  patterns: { label: "Wzorce", icon: <Zap size={12} />, color: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
};

type SearchMode = "text" | "semantic";

export default function SearchPanel() {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [scopes, setScopes] = useState<SearchScope[]>(["experiences", "notes", "projects", "patterns"]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchMode, setSearchMode] = useState<SearchMode>("text");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = trpc.brain.search.useQuery(
    { query: activeQuery, scope: scopes, limit: 30 },
    { enabled: activeQuery.length >= 2 && searchMode === "text", staleTime: 60000 }
  );

  // Semantic search przez bazę wektorową
  const { data: semanticData, isLoading: semanticLoading } = trpc.vector.semanticSearch.useQuery(
    { query: activeQuery, limit: 15 },
    { enabled: activeQuery.length >= 2 && searchMode === "semantic", staleTime: 60000 }
  );

  const { data: cacheStats } = trpc.brain.cacheStats.useQuery(undefined, { staleTime: 30000 });

  const handleSearch = useCallback(() => {
    if (query.trim().length < 2) return;
    setActiveQuery(query.trim());
    setRecentSearches(prev => {
      const updated = [query.trim(), ...prev.filter(s => s !== query.trim())].slice(0, 8);
      return updated;
    });
  }, [query]);

  const isSearching = searchMode === "text" ? isLoading : semanticLoading;
  const hasResults = searchMode === "text" ? !!data : !!semanticData;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
    if (e.key === "Escape") { setQuery(""); setActiveQuery(""); }
  };

  const toggleScope = (scope: SearchScope) => {
    setScopes(prev =>
      prev.includes(scope)
        ? prev.length > 1 ? prev.filter(s => s !== scope) : prev
        : [...prev, scope]
    );
  };

  const typeColor = (type: string) => {
    const cfg = SCOPE_CONFIG[type as SearchScope];
    return cfg?.color ?? "text-gray-400 border-gray-400/30 bg-gray-400/10";
  };

  const typeLabel = (type: string) => SCOPE_CONFIG[type as SearchScope]?.label ?? type;

  const highlightText = (text: string, q: string) => {
    if (!q || !text) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-emerald-400/30 text-emerald-300 rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div className="h-full flex flex-col gap-4 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white font-display">Wyszukiwarka Wiedzy</h2>
          <p className="text-sm text-gray-400 mt-0.5">Przeszukuj całą bazę doświadczeń, notatek i projektów</p>
        </div>
        {cacheStats && (
          <div className="text-right">
            <div className="text-xs text-gray-500">Cache</div>
            <div className="text-sm text-emerald-400 font-mono">{cacheStats.totalHits} trafień</div>
          </div>
        )}
      </div>

      {/* Search Mode Toggle */}
      <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg border border-border w-fit">
        <button
          onClick={() => setSearchMode("text")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            searchMode === "text"
              ? "bg-card text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Search size={12} />
          Tekstowe
        </button>
        <button
          onClick={() => setSearchMode("semantic")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            searchMode === "semantic"
              ? "bg-primary/15 text-primary shadow-sm border border-primary/20"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles size={12} />
          Semantyczne
          <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary">AI</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        {searchMode === "semantic" ? (
          <Sparkles size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
        ) : (
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        )}
        <Input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={searchMode === "semantic" ? "Opisz co szukasz... (wyszukiwanie po znaczeniu)" : "Szukaj w bazie wiedzy... (Enter aby wyszukać)"}
          className={`pl-9 pr-20 bg-white/5 border-white/10 text-white placeholder:text-gray-500 transition-colors ${
            searchMode === "semantic" ? "focus:border-primary/50 focus:ring-primary/20" : "focus:border-emerald-400/50 focus:ring-emerald-400/20"
          }`}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button onClick={() => { setQuery(""); setActiveQuery(""); }} className="text-gray-400 hover:text-white p-1">
              <X size={14} />
            </button>
          )}
          <Button size="sm" onClick={handleSearch} disabled={query.length < 2}
            className={`h-7 px-3 border ${
              searchMode === "semantic"
                ? "bg-primary/20 text-primary hover:bg-primary/30 border-primary/30"
                : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-emerald-400/30"
            }`}
          >
            {isSearching ? <Loader2 size={12} className="animate-spin" /> : "Szukaj"}
          </Button>
        </div>
      </div>

      {/* Semantic mode info */}
      {searchMode === "semantic" && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/15 text-xs text-muted-foreground">
          <Network size={13} className="text-primary shrink-0" />
          <span>Wyszukiwanie semantyczne używa TF-IDF embeddings (1536-dim) do znalezienia doświadczeń podobnych znaczeniowo, nie tylko tekstowo.</span>
        </div>
      )}

      {/* Scope Filters — only for text mode */}
      {searchMode === "text" && <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-gray-400" />
        <span className="text-xs text-gray-400">Zakres:</span>
        {(Object.keys(SCOPE_CONFIG) as SearchScope[]).map(scope => (
          <button
            key={scope}
            onClick={() => toggleScope(scope)}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-all ${
              scopes.includes(scope) ? SCOPE_CONFIG[scope].color : "text-gray-500 border-gray-600 bg-transparent opacity-50"
            }`}
          >
            {SCOPE_CONFIG[scope].icon}
            {SCOPE_CONFIG[scope].label}
          </button>
        ))}
      </div>}

      {/* Recent Searches */}
      {!activeQuery && recentSearches.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={13} className="text-gray-500" />
            <span className="text-xs text-gray-500">Ostatnie wyszukiwania</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map(s => (
              <button
                key={s}
                onClick={() => { setQuery(s); setActiveQuery(s); }}
                className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300 hover:border-emerald-400/30 hover:text-emerald-400 transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!activeQuery && recentSearches.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center">
            <Search size={28} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-white font-medium">Wyszukaj w bazie wiedzy</p>
            <p className="text-sm text-gray-400 mt-1">Wpisz co najmniej 2 znaki i naciśnij Enter</p>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-gray-500">
            <div className="px-3 py-2 rounded-lg bg-white/3 border border-white/5">💡 "React hooks"</div>
            <div className="px-3 py-2 rounded-lg bg-white/3 border border-white/5">🔧 "Supabase"</div>
            <div className="px-3 py-2 rounded-lg bg-white/3 border border-white/5">📊 "dashboard"</div>
            <div className="px-3 py-2 rounded-lg bg-white/3 border border-white/5">🛡️ "security"</div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isSearching && (
        <div className="flex items-center justify-center py-12 gap-3 text-gray-400">
          <Loader2 size={20} className={`animate-spin ${searchMode === "semantic" ? "text-primary" : "text-emerald-400"}`} />
          <span>{searchMode === "semantic" ? "Obliczam podobieństwo semantyczne..." : "Przeszukuję bazę wiedzy..."}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={16} />
          Błąd wyszukiwania: {error.message}
        </div>
      )}

      {/* Semantic Results */}
      {semanticData && searchMode === "semantic" && !semanticLoading && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">
              {semanticData.results.length > 0 ? (
                <><span className="text-white font-medium">{semanticData.results.length}</span> wyników semantycznych dla "<span className="text-primary">{activeQuery}</span>"</>
              ) : (
                <>Brak wyników semantycznych dla "<span className="text-primary">{activeQuery}</span>"</>
              )}
            </span>
            <Badge variant="outline" className="text-xs text-primary border-primary/30 bg-primary/5">
              <Sparkles size={10} className="mr-1" /> TF-IDF cosine
            </Badge>
          </div>

          {semanticData.results.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>Brak semantycznie podobnych wyników.</p>
              <p className="text-xs mt-1">Spróbuj bardziej opisowego zapytania lub przełącz na wyszukiwanie tekstowe.</p>
            </div>
          )}

          <div className="space-y-2">
            {semanticData.results.map((result: any, i: number) => (
              <div
                key={`semantic-${result.id}-${i}`}
                className="p-4 rounded-xl bg-primary/3 border border-primary/10 hover:border-primary/25 hover:bg-primary/5 transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border text-emerald-400 border-emerald-400/30 bg-emerald-400/10">
                        <BookOpen size={10} />
                        Doświadczenie
                      </span>
                      <span className="text-xs text-muted-foreground">{result.domain}</span>
                    </div>
                    <h3 className="text-sm font-medium text-white group-hover:text-primary transition-colors truncate">
                      {result.title}
                    </h3>
                    {result.summary && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{result.summary}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs font-mono text-primary font-bold">
                      {Math.round(result.similarity * 100)}%
                    </span>
                    <span className="text-[10px] text-muted-foreground">podobieństwo</span>
                  </div>
                </div>
                {/* Similarity bar */}
                <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.round(result.similarity * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Text Results */}
      {data && searchMode === "text" && !isLoading && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">
              {data.results.length > 0 ? (
                <><span className="text-white font-medium">{data.results.length}</span> wyników dla "<span className="text-emerald-400">{activeQuery}</span>"</>
              ) : (
                <>Brak wyników dla "<span className="text-emerald-400">{activeQuery}</span>"</>
              )}
            </span>
            {data.fromCache && (
              <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-400/30 bg-emerald-400/5">
                ⚡ z cache ({data.hitCount}× użyto)
              </Badge>
            )}
          </div>

          {data.results.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>Nie znaleziono wyników.</p>
              <p className="text-xs mt-1">Spróbuj innych słów kluczowych lub rozszerz zakres wyszukiwania.</p>
            </div>
          )}

          <div className="space-y-2">
            {data.results.map((result, i) => (
              <div
                key={`${result.type}-${result.id}-${i}`}
                className="p-4 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 hover:bg-white/5 transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${typeColor(result.type)}`}>
                        {SCOPE_CONFIG[result.type as SearchScope]?.icon}
                        {typeLabel(result.type)}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-white group-hover:text-emerald-300 transition-colors truncate">
                      {highlightText(result.title, activeQuery)}
                    </h3>
                    {result.snippet && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                        {highlightText(result.snippet, activeQuery)}
                      </p>
                    )}
                  </div>
                  {result.meta && Object.keys(result.meta).length > 0 && (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {result.meta.confidence !== undefined && (
                        <span className="text-xs text-emerald-400 font-mono">{Math.round(result.meta.confidence * 100)}%</span>
                      )}
                      {result.meta.importance !== undefined && (
                        <span className="text-xs text-amber-400">★ {result.meta.importance}</span>
                      )}
                      {result.meta.status && (
                        <span className="text-xs text-gray-400 capitalize">{result.meta.status}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
