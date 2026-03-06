/*
 * ExperiencesPanel — baza wiedzy Manusa
 * Filtrowanie, sortowanie, szczegóły wniosków
 */

import { useState, useMemo } from "react";
import { Search, Filter, TrendingUp, ThumbsUp, ThumbsDown, Tag, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface Props {
  experiences: any[];
}

const CATEGORIES = ["wszystkie", "deployment", "coding", "security", "workflow", "ux", "general"];

export default function ExperiencesPanel({ experiences }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("wszystkie");
  const [sortBy, setSortBy] = useState<"confidence" | "helpful_count" | "created_at">("confidence");
  const [selected, setSelected] = useState<any | null>(null);

  const filtered = useMemo(() => {
    return experiences
      .filter((e) => {
        const matchCat = category === "wszystkie" || e.category === category;
        const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.summary?.toLowerCase().includes(search.toLowerCase());
        return matchCat && matchSearch;
      })
      .sort((a, b) => {
        if (sortBy === "confidence")    return (b.confidence || 0) - (a.confidence || 0);
        if (sortBy === "helpful_count") return (b.helpful_count || 0) - (a.helpful_count || 0);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [experiences, search, category, sortBy]);

  return (
    <div className="space-y-5 stagger-in">
      <div>
        <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
          Baza Doświadczeń
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {experiences.length} aktywnych wniosków · aktualizowana co noc
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj wniosków..."
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-card border border-border rounded-lg text-sm text-foreground px-3 py-2 focus:outline-none focus:border-primary/50"
          >
            <option value="confidence">Pewność</option>
            <option value="helpful_count">Pomocność</option>
            <option value="created_at">Najnowsze</option>
          </select>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              category === cat
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Two-column layout: list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* List */}
        <div className="lg:col-span-2 space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Brak wyników dla wybranych filtrów
            </div>
          ) : (
            filtered.map((exp) => (
              <ExperienceCard
                key={exp.id}
                exp={exp}
                isSelected={selected?.id === exp.id}
                onClick={() => setSelected(exp.id === selected?.id ? null : exp)}
              />
            ))
          )}
        </div>

        {/* Detail */}
        <div className="lg:col-span-3">
          {selected ? (
            <ExperienceDetail exp={selected} onSelectExp={(e) => setSelected(e)} />
          ) : (
            <div className="h-full flex items-center justify-center bg-card rounded-xl border border-border p-8 text-center">
              <div>
                <TrendingUp className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Kliknij wniosek, aby zobaczyć szczegóły</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExperienceCard({ exp, isSelected, onClick }: { exp: any; isSelected: boolean; onClick: () => void }) {
  const confidence = Math.round((exp.confidence || 0) * 100);
  const confColor = confidence > 70 ? "oklch(0.72 0.18 160)" : confidence > 40 ? "oklch(0.78 0.17 75)" : "oklch(0.65 0.22 15)";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
        isSelected
          ? "bg-primary/10 border-primary/30"
          : "bg-card border-border hover:border-primary/20 hover:bg-muted/20"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-xs font-medium text-foreground line-clamp-2 flex-1">{exp.title}</span>
        <span className="text-xs font-bold flex-shrink-0" style={{ color: confColor }}>{confidence}%</span>
      </div>
      <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">{exp.summary}</p>
      <div className="flex items-center gap-2">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{exp.category}</span>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
          <ThumbsUp className="w-3 h-3" /> {exp.helpful_count || 0}
        </div>
      </div>
    </button>
  );
}

function ExperienceDetail({ exp, onSelectExp }: { exp: any; onSelectExp?: (e: any) => void }) {
  const confidence = Math.round((exp.confidence || 0) * 100);
  const confColor = confidence > 70 ? "oklch(0.72 0.18 160)" : confidence > 40 ? "oklch(0.78 0.17 75)" : "oklch(0.65 0.22 15)";
  
  // Pobierz podobne doświadczenia z bazy wektorowej
  const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(exp.id);
  const similarQuery = trpc.vector.findSimilar.useQuery(
    { experienceId: exp.id, limit: 3 },
    { enabled: isValidUUID }
  );
  const similar = similarQuery.data ?? [];

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4 h-full">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/20 font-medium">
            {exp.category}
          </span>
          <span className="text-xs text-muted-foreground">v{exp.version || 1}</span>
        </div>
        <h3 className="text-base font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
          {exp.title}
        </h3>
      </div>

      {/* Summary */}
      <div className="bg-muted/30 rounded-lg p-4">
        <p className="text-sm text-foreground leading-relaxed">{exp.summary}</p>
      </div>

      {/* Confidence bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Poziom pewności</span>
          <span className="font-bold" style={{ color: confColor }}>{confidence}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${confidence}%`, background: confColor }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: ThumbsUp, label: "Pomocny", value: exp.helpful_count || 0, color: "text-emerald-400" },
          { icon: ThumbsDown, label: "Szkodliwy", value: exp.harmful_count || 0, color: "text-rose-400" },
          { icon: TrendingUp, label: "Zastosowany", value: exp.applied_count || 0, color: "text-blue-400" },
        ].map((s) => (
          <div key={s.label} className="bg-muted/30 rounded-lg p-3 text-center">
            <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
            <div className="text-lg font-bold text-foreground">{s.value}</div>
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tags */}
      {exp.tags?.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="w-3 h-3 text-muted-foreground" />
          {exp.tags.map((tag: string) => (
            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Similar experiences */}
      {isValidUUID && similar.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Podobne doświadczenia</span>
          </div>
          {similar.map((s: any) => (
            <button
              key={s.id}
              onClick={() => onSelectExp?.(s)}
              className="w-full text-left p-2.5 rounded-lg bg-muted/20 border border-border hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-foreground line-clamp-1 flex-1">{s.title}</span>
                <span className="text-xs font-mono text-primary shrink-0">{Math.round(s.similarity * 100)}%</span>
              </div>
              <div className="flex gap-1 mt-1">
                <span className="text-[10px] text-muted-foreground">{s.domain}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Dates */}
      <div className="text-[10px] text-muted-foreground space-y-1 pt-2 border-t border-border">
        <div>Dodano: {new Date(exp.created_at).toLocaleDateString("pl-PL")}</div>
        {exp.last_applied_at && <div>Ostatnio użyto: {new Date(exp.last_applied_at).toLocaleDateString("pl-PL")}</div>}
        <div>Źródło: {exp.source_type || "conversation"}</div>
      </div>
    </div>
  );
}
