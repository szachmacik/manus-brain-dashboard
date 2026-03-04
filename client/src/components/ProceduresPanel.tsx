import { useState } from "react";

interface Procedure {
  id: string;
  number: string;
  title: string;
  icon: string;
  color: string;
  summary: string;
  rules: string[];
  tags: string[];
}

const PROCEDURES: Procedure[] = [
  {
    id: "efficiency",
    number: "I",
    title: "Efektywność Kosztowa",
    icon: "💰",
    color: "text-emerald-400",
    summary: "Każde wywołanie AI musi być uzasadnione. Hierarchia modeli: nano → mini → full.",
    rules: [
      "Semantic cache SHA256 przed każdym AI call (TTL 30 dni)",
      "Batch processing — minimum 8 elementów na 1 AI call",
      "Delta-only updates — tylko nowe dane (processed_at IS NULL)",
      "Budget guard — limit $5/miesiąc, alert przy 80%",
      "Context compression — max 2000 tokenów na call",
      "Model routing — nano dla klasyfikacji, mini dla syntezy",
    ],
    tags: ["openai", "kredyty", "optymalizacja"],
  },
  {
    id: "security",
    number: "II",
    title: "Bezpieczeństwo",
    icon: "🔒",
    color: "text-red-400",
    summary: "Każdy projekt traktujemy jak gdyby obsługiwał dane prawdziwych klientów.",
    rules: [
      "Dexter Vault — WSZYSTKIE sekrety, nigdy w kodzie",
      "GitHub scan przed każdym push (grep na sk-, Bearer, password)",
      "RLS zawsze włączone na tabelach Supabase",
      "HTTPS only w produkcji",
      "Input validation przez Zod (TS) lub Pydantic (Python)",
      "Rotacja sekretów co 90 dni",
    ],
    tags: ["security", "supabase", "vault"],
  },
  {
    id: "architecture",
    number: "III",
    title: "Architektura i Kod",
    icon: "🏗️",
    color: "text-blue-400",
    summary: "Kod czytelny, modularny, łatwy do utrzymania przez kolejnych agentów AI.",
    rules: [
      "TypeScript strict mode — zero any bez komentarza",
      "Testy Vitest przed każdym deploymentem",
      "Schema-first — drizzle/schema.ts jako jedyne źródło prawdy",
      "tRPC dla wszystkich API endpointów",
      "S3 dla plików binarnych, nigdy w bazie danych",
      "Error boundaries na każdej stronie React",
    ],
    tags: ["typescript", "tRPC", "drizzle", "vitest"],
  },
  {
    id: "dataflow",
    number: "IV",
    title: "Przepływ Danych",
    icon: "🔄",
    color: "text-cyan-400",
    summary: "Dane mają jeden kierunek przepływu. Brak duplikacji źródeł prawdy.",
    rules: [
      "Supabase = baza wiedzy Manusa",
      "MySQL/TiDB = dane aplikacji webowych",
      "Google Drive = dokumentacja i backup",
      "GitHub = kod i procedury",
      "Dexter Vault = sekrety",
      "Single source of truth dla każdego typu danych",
    ],
    tags: ["supabase", "mysql", "gdrive", "github"],
  },
  {
    id: "deployment",
    number: "V",
    title: "Deployment i Ciągłość",
    icon: "🚀",
    color: "text-purple-400",
    summary: "Każdy projekt zawsze gotowy do deploymentu. Brak tymczasowych rozwiązań w produkcji.",
    rules: [
      "Health check GET /health → { status: ok } w każdym projekcie",
      "webdev_save_checkpoint przed każdym Publish",
      "todo.md zawsze aktualna z checkboxami",
      "README.md z instrukcją uruchomienia i deploymentu",
      "Rollback plan — zawsze wiadomo jak wrócić",
      "Środowiska: dev → staging → production",
    ],
    tags: ["deployment", "coolify", "manus-space"],
  },
  {
    id: "claude",
    number: "VI",
    title: "Claude jako Support",
    icon: "🤖",
    color: "text-orange-400",
    summary: "Gdy Manus napotka problem po 3 próbach — deleguje do Claude'a jako wewnętrznego supportu.",
    rules: [
      "Deleguj po 3 nieudanych próbach rozwiązania problemu",
      "Przekaż: repo URL, logi błędów, oczekiwany wynik",
      "Określ zakres: co Claude ma zrobić, czego NIE ruszać",
      "Wskaż gdzie zapisać wynik (Drive / GitHub / Supabase)",
      "Manus weryfikuje i integruje wynik Claude'a",
      "Claude ma dostęp do manus-brain-skills repo",
    ],
    tags: ["claude", "support", "delegacja"],
  },
  {
    id: "monitoring",
    number: "VII",
    title: "Monitoring i Alerty",
    icon: "📡",
    color: "text-yellow-400",
    summary: "Właściciel zawsze wie co się dzieje. Brak cichych awarii.",
    rules: [
      "Web Push na telefon dla wszystkich krytycznych alertów",
      "Dashboard odświeża dane co minutę",
      "Nocny learning run o 02:00 codziennie",
      "Alert przy health score < 50",
      "Alert przy budżecie AI > 80%",
      "Raport tygodniowy (niedziela 08:00) — planowane",
    ],
    tags: ["web-push", "monitoring", "alerty"],
  },
  {
    id: "knowledge",
    number: "VIII",
    title: "Zarządzanie Wiedzą",
    icon: "🧠",
    color: "text-pink-400",
    summary: "Każda rozmowa z Manusem to potencjalna wiedza. Nic nie ginie.",
    rules: [
      "Notatka po każdej ważnej rozmowie (importance 7+)",
      "Nocny run przetwarza notatki → doświadczenia",
      "Wzorce powtarzające się 3+ razy → manus_patterns",
      "Przestarzała wiedza → deprecated (nie usuwamy)",
      "Najważniejsze wnioski → SKILL.md na GitHub",
      "Confidence > 0.80 = wiedza zweryfikowana",
    ],
    tags: ["rag", "supabase", "skill-md"],
  },
  {
    id: "cross-project",
    number: "IX",
    title: "Cross-Project Sharing",
    icon: "🔗",
    color: "text-indigo-400",
    summary: "Wiedza zdobyta w jednym projekcie automatycznie trafia do wszystkich.",
    rules: [
      "Przed nowym projektem: query_experiences(domain=...)",
      "Każdy projekt zarejestrowany w manus_project_context",
      "Wnioski tagowane domeną (vercel, supabase, react...)",
      "experience_query.py do zapytań semantycznych",
      "CROSS_PROJECT.md — mapa przepływu wiedzy",
      "GitHub repo manus-brain-skills dostępny dla Claude'a",
    ],
    tags: ["cross-project", "knowledge-graph", "github"],
  },
  {
    id: "improvement",
    number: "X",
    title: "Ciągłe Doskonalenie",
    icon: "📈",
    color: "text-teal-400",
    summary: "System uczy się i poprawia. Każdy błąd to lekcja, nie porażka.",
    rules: [
      "Health Score cel: > 70/100",
      "Cache hit rate cel: > 70%",
      "Koszt miesięczny cel: < $5",
      "100% notatek przetworzonych w 24h",
      "Confidence avg cel: > 0.80",
      "PROCEDURES.md aktualizowany przy nowych wzorcach",
    ],
    tags: ["metryki", "kpi", "doskonalenie"],
  },
];

export default function ProceduresPanel() {
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = PROCEDURES.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.summary.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some((t) => t.includes(search.toLowerCase()))
  );

  const selectedProc = selected ? PROCEDURES.find((p) => p.id === selected) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Centrum Procedur</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Dekalog projektów — 10 zasad obowiązujących we wszystkich projektach Manusa
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            v1.0 · 2026-03-04
          </span>
          <a
            href="https://github.com/szachmacik/manus-brain-skills"
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1 rounded-full border border-border hover:border-primary/50 hover:text-primary transition-colors"
          >
            GitHub ↗
          </a>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Szukaj procedury, tagu, zasady..."
        className="w-full px-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista procedur */}
        <div className="lg:col-span-1 space-y-2">
          {filtered.map((proc) => (
            <button
              key={proc.id}
              onClick={() => setSelected(selected === proc.id ? null : proc.id)}
              className={`w-full text-left rounded-xl border p-4 transition-all ${
                selected === proc.id
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-card hover:border-border/80 hover:bg-card/80"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center text-base">
                  {proc.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono font-bold ${proc.color}`}>{proc.number}</span>
                    <p className="text-sm font-medium text-foreground truncate">{proc.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{proc.summary}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Szczegóły procedury */}
        <div className="lg:col-span-2">
          {selectedProc ? (
            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              {/* Nagłówek */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center text-2xl flex-shrink-0">
                  {selectedProc.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-mono font-bold ${selectedProc.color}`}>
                      Zasada {selectedProc.number}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{selectedProc.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{selectedProc.summary}</p>
                </div>
              </div>

              {/* Zasady */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Obowiązkowe zasady
                </h4>
                <div className="space-y-2">
                  {selectedProc.rules.map((rule, i) => (
                    <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                      <span className={`text-xs font-mono font-bold ${selectedProc.color} mt-0.5 flex-shrink-0`}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <p className="text-sm text-foreground">{rule}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tagi */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Powiązane domeny
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedProc.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-full bg-background border border-border text-xs text-muted-foreground font-mono"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 h-full flex flex-col items-center justify-center text-center">
              <div className="text-5xl mb-4">📋</div>
              <h3 className="font-medium text-foreground mb-2">Wybierz procedurę</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Kliknij na dowolną zasadę z listy aby zobaczyć szczegóły i obowiązkowe reguły.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3 w-full max-w-sm">
                <div className="rounded-lg border border-border p-3 text-left">
                  <p className="text-xs font-semibold text-emerald-400 mb-1">💰 Koszt AI</p>
                  <p className="text-xs text-muted-foreground">Cel: &lt; $5/miesiąc</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-left">
                  <p className="text-xs font-semibold text-red-400 mb-1">🔒 Bezpieczeństwo</p>
                  <p className="text-xs text-muted-foreground">Zero sekretów w kodzie</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-left">
                  <p className="text-xs font-semibold text-yellow-400 mb-1">📡 Monitoring</p>
                  <p className="text-xs text-muted-foreground">Push na telefon</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-left">
                  <p className="text-xs font-semibold text-teal-400 mb-1">📈 Health Score</p>
                  <p className="text-xs text-muted-foreground">Cel: &gt; 70/100</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
