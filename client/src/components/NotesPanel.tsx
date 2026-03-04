/*
 * NotesPanel — notatki z rozmów + formularz dodawania
 * Surowe dane wejściowe do learning runs
 */

import { useState } from "react";
import { FileText, Clock, CheckCircle, Tag, Wrench, Plus, X, Send, ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "",
  import.meta.env.VITE_SUPABASE_ANON_KEY || ""
);

interface Props {
  notes: any[];
  onNoteAdded?: () => void;
}

const IMPORTANCE_LABELS = ["", "Niski", "Niski+", "Średni", "Wysoki", "Krytyczny"];
const IMPORTANCE_COLORS = ["", "text-slate-400", "text-blue-400", "text-amber-400", "text-orange-400", "text-rose-400"];

export default function NotesPanel({ notes, onNoteAdded }: Props) {
  const [filter, setFilter] = useState<"all" | "pending" | "processed">("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    topic: "",
    key_points: "",
    decisions_made: "",
    problems_solved: "",
    open_issues: "",
    tools_used: "",
    projects: "",
    importance: 3,
  });

  const filtered = notes.filter((n) => {
    if (filter === "pending")   return !n.processed_at;
    if (filter === "processed") return !!n.processed_at;
    return true;
  });

  const pendingCount   = notes.filter((n) => !n.processed_at).length;
  const processedCount = notes.filter((n) => !!n.processed_at).length;

  const parseLines = (text: string) =>
    text.split("\n").map((s) => s.trim()).filter(Boolean);

  const handleSave = async () => {
    if (!form.topic.trim()) return;
    setSaving(true);
    try {
      const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await supabase.from("manus_conversation_notes").insert({
        conversation_id: id,
        session_date: new Date().toISOString().split("T")[0],
        topic: form.topic.trim(),
        key_points: parseLines(form.key_points),
        decisions_made: parseLines(form.decisions_made),
        problems_solved: parseLines(form.problems_solved),
        open_issues: parseLines(form.open_issues),
        tools_used: parseLines(form.tools_used),
        projects: parseLines(form.projects),
        importance: form.importance,
        has_new_pattern: false,
        processed_at: null,
      });
      setSaved(true);
      setForm({ topic: "", key_points: "", decisions_made: "", problems_solved: "", open_issues: "", tools_used: "", projects: "", importance: 3 });
      setShowForm(false);
      setTimeout(() => setSaved(false), 3000);
      onNoteAdded?.();
    } catch (err) {
      console.error("Błąd zapisu notatki:", err);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5 stagger-in">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
            Notatki z rozmów
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Surowe dane wejściowe · {pendingCount} oczekuje na przetworzenie
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            showForm
              ? "bg-muted text-muted-foreground"
              : "bg-primary text-primary-foreground hover:opacity-90"
          }`}
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Anuluj" : "Dodaj notatkę"}
        </button>
      </div>

      {/* Formularz dodawania notatki */}
      {showForm && (
        <div className="bg-card border border-primary/30 rounded-xl p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Nowa notatka z rozmowy</span>
          </div>

          {/* Temat */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Temat rozmowy *</label>
            <input
              type="text"
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              placeholder="np. Konfiguracja Supabase RLS dla projektu X"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Kluczowe punkty */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Kluczowe punkty <span className="text-[10px] opacity-60">(każdy w nowej linii)</span>
              </label>
              <textarea
                value={form.key_points}
                onChange={(e) => setForm({ ...form, key_points: e.target.value })}
                placeholder={"RLS wymaga explicit policy\nAnon key ma ograniczony dostęp"}
                rows={3}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            {/* Decyzje */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Podjęte decyzje <span className="text-[10px] opacity-60">(każda w nowej linii)</span>
              </label>
              <textarea
                value={form.decisions_made}
                onChange={(e) => setForm({ ...form, decisions_made: e.target.value })}
                placeholder={"Wyłącz RLS dla tabel wewnętrznych\nUżyj service_role key w skryptach"}
                rows={3}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            {/* Problemy rozwiązane */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Rozwiązane problemy</label>
              <textarea
                value={form.problems_solved}
                onChange={(e) => setForm({ ...form, problems_solved: e.target.value })}
                placeholder={"Dashboard nie ładował danych\nBłąd 403 przy SELECT"}
                rows={2}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            {/* Otwarte kwestie */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Otwarte kwestie</label>
              <textarea
                value={form.open_issues}
                onChange={(e) => setForm({ ...form, open_issues: e.target.value })}
                placeholder={"Dodać pgvector dla embeddings\nSkonfigurować backup"}
                rows={2}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Narzędzia */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Narzędzia (linie)</label>
              <input
                type="text"
                value={form.tools_used}
                onChange={(e) => setForm({ ...form, tools_used: e.target.value })}
                placeholder="supabase, python, github"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Projekty */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Projekty (linie)</label>
              <input
                type="text"
                value={form.projects}
                onChange={(e) => setForm({ ...form, projects: e.target.value })}
                placeholder="manus-brain-dashboard"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Ważność */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Ważność: <span className={`font-bold ${IMPORTANCE_COLORS[form.importance]}`}>{IMPORTANCE_LABELS[form.importance]}</span>
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={form.importance}
                onChange={(e) => setForm({ ...form, importance: Number(e.target.value) })}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                <span>Niski</span><span>Krytyczny</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-[11px] text-muted-foreground">
              Notatka zostanie przetworzona przez learning engine o 02:00
            </p>
            <button
              onClick={handleSave}
              disabled={saving || !form.topic.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {saving ? "Zapisuję..." : "Zapisz notatkę"}
            </button>
          </div>
        </div>
      )}

      {/* Potwierdzenie zapisu */}
      {saved && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-sm text-emerald-400">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Notatka zapisana! Zostanie przetworzona przez learning engine tej nocy o 02:00.
        </div>
      )}

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
            {filter === "all" && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-3 text-xs text-primary hover:underline"
              >
                Dodaj pierwszą notatkę →
              </button>
            )}
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
        <div className="flex-shrink-0 mt-0.5">
          {isProcessed
            ? <CheckCircle className="w-4 h-4 text-primary" />
            : <Clock className="w-4 h-4 text-amber-400" />
          }
        </div>

        <div className="flex-1 min-w-0">
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
          <p className="text-sm font-medium text-foreground line-clamp-2">{note.topic}</p>
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

        <div className="flex-shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

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
