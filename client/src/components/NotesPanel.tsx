/*
 * NotesPanel — notatki z rozmów
 * Surowe dane wejściowe do learning runs
 */

import { useState } from "react";
import { FileText, Clock, CheckCircle, AlertCircle, Tag, Wrench } from "lucide-react";

interface Props {
  notes: any[];
}

const IMPORTANCE_LABELS = ["", "Niski", "Niski+", "Średni", "Wysoki", "Krytyczny"];
const IMPORTANCE_COLORS = ["", "text-slate-400", "text-blue-400", "text-amber-400", "text-orange-400", "text-rose-400"];

export default function NotesPanel({ notes }: Props) {
  const [filter, setFilter] = useState<"all" | "pending" | "processed">("all");

  const filtered = notes.filter((n) => {
    if (filter === "pending")   return !n.processed_at;
    if (filter === "processed") return !!n.processed_at;
    return true;
  });

  const pendingCount   = notes.filter((n) => !n.processed_at).length;
  const processedCount = notes.filter((n) => !!n.processed_at).length;

  return (
    <div className="space-y-5 stagger-in">
      <div>
        <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
          Notatki z rozmów
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Surowe dane wejściowe · {pendingCount} oczekuje na przetworzenie
        </p>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Wszystkie", value: notes.length, color: "text-foreground", bg: "bg-card" },
          { label: "Oczekujące", value: pendingCount, color: "text-amber-400", bg: "bg-amber-400/5 border-amber-400/20" },
          { label: "Przetworzone", value: processedCount, color: "text-primary", bg: "bg-primary/5 border-primary/20" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 text-center ${s.bg} border-border`}>
            <div className={`text-2xl font-bold ${s.color} count-up`} style={{ fontFamily: "Syne, sans-serif" }}>
              {s.value}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "pending", "processed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? "Wszystkie" : f === "pending" ? "Oczekujące" : "Przetworzone"}
          </button>
        ))}
      </div>

      {/* Notes list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Brak notatek w tej kategorii</p>
          </div>
        ) : (
          filtered.map((note) => (
            <NoteCard key={note.id} note={note} />
          ))
        )}
      </div>
    </div>
  );
}

function NoteCard({ note }: { note: any }) {
  const [expanded, setExpanded] = useState(false);
  const isProcessed = !!note.processed_at;
  const importance = note.importance || 3;

  return (
    <div className={`bg-card rounded-xl border transition-all duration-200 ${
      isProcessed ? "border-border" : "border-amber-400/20 bg-amber-400/3"
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-4 text-left"
      >
        {/* Status icon */}
        <div className="flex-shrink-0 mt-0.5">
          {isProcessed
            ? <CheckCircle className="w-4 h-4 text-primary" />
            : <Clock className="w-4 h-4 text-amber-400" />
          }
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${IMPORTANCE_COLORS[importance]}`}>
              {IMPORTANCE_LABELS[importance]}
            </span>
            <span className="text-xs text-muted-foreground">{note.session_date}</span>
            {!isProcessed && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-400 font-medium">
                Oczekuje
              </span>
            )}
          </div>

          {/* Topic */}
          <p className="text-sm font-medium text-foreground line-clamp-2">{note.topic}</p>

          {/* Tools */}
          {note.tools_used?.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              <Wrench className="w-3 h-3 text-muted-foreground" />
              {note.tools_used.slice(0, 4).map((tool: string) => (
                <span key={tool} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {tool}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 text-[10px] text-muted-foreground">
          {expanded ? "▲" : "▼"}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {note.key_points?.length > 0 && (
            <Section title="Kluczowe punkty" items={note.key_points} color="text-primary" />
          )}
          {note.decisions_made?.length > 0 && (
            <Section title="Podjęte decyzje" items={note.decisions_made} color="text-blue-400" />
          )}
          {note.problems_solved?.length > 0 && (
            <Section title="Rozwiązane problemy" items={note.problems_solved} color="text-emerald-400" />
          )}
          {note.open_issues?.length > 0 && (
            <Section title="Otwarte kwestie" items={note.open_issues} color="text-amber-400" />
          )}
          {note.projects?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-3 h-3 text-muted-foreground" />
              {note.projects.map((p: string) => (
                <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                  {p}
                </span>
              ))}
            </div>
          )}
          {isProcessed && note.processed_at && (
            <div className="text-[10px] text-muted-foreground pt-1 border-t border-border">
              Przetworzone: {new Date(note.processed_at).toLocaleString("pl-PL")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div>
      <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${color}`}>{title}</div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-foreground">
            <span className={`mt-1 w-1 h-1 rounded-full flex-shrink-0 ${color.replace("text-", "bg-")}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
