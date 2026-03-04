/**
 * CrossProjectPanel — Panel cross-project knowledge sharing
 * Design: Dark Intelligence Dashboard — pokazuje jak wiedza przepływa między projektami
 */
import { useState } from "react";
import { ExternalLink, GitBranch, Layers, ArrowRight, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

interface ProjectContext {
  project_name: string;
  display_name: string;
  status: string;
  tech_stack: string[];
  related_domains: string[];
  url?: string;
  description?: string;
  open_issues: Array<{ issue: string; priority: string }>;
  recent_progress: Array<{ date: string; what: string }>;
  last_activity: string;
}

interface Experience {
  id: string;
  title: string;
  summary: string;
  category: string;
  confidence: number;
  tags: string[];
  domain: string;
  applied_count: number;
  recommended_action?: string;
}

interface CrossProjectPanelProps {
  projects: ProjectContext[];
  experiences: Experience[];
}

const statusColors: Record<string, string> = {
  active:    "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  paused:    "text-amber-400 bg-amber-400/10 border-amber-400/20",
  completed: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  archived:  "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
};

const priorityColors: Record<string, string> = {
  high:   "text-red-400",
  medium: "text-amber-400",
  low:    "text-zinc-400",
};

export default function CrossProjectPanel({ projects, experiences }: CrossProjectPanelProps) {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"projects" | "flow">("projects");

  const activeProjects = projects.filter(p => p.status === "active");
  const selectedCtx = projects.find(p => p.project_name === selectedProject);

  // Znajdź doświadczenia pasujące do wybranego projektu
  const relevantExperiences = selectedCtx
    ? experiences.filter(e =>
        e.tags?.some(t => selectedCtx.tech_stack?.includes(t)) ||
        selectedCtx.related_domains?.includes(e.category)
      ).slice(0, 5)
    : experiences.slice(0, 5);

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white font-display">Cross-Project Knowledge</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Wiedza przepływa między wszystkimi projektami</p>
        </div>
        <div className="flex gap-1 p-1 bg-zinc-800/60 rounded-lg border border-zinc-700/40">
          {(["projects", "flow"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                activeTab === tab
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab === "projects" ? "Projekty" : "Przepływ wiedzy"}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "projects" && (
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Lista projektów */}
          <div className="w-64 flex flex-col gap-2 overflow-y-auto">
            {activeProjects.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm">
                Brak aktywnych projektów.<br />
                Nocny run doda je automatycznie.
              </div>
            ) : (
              activeProjects.map(proj => (
                <button
                  key={proj.project_name}
                  onClick={() => setSelectedProject(
                    selectedProject === proj.project_name ? null : proj.project_name
                  )}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    selectedProject === proj.project_name
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : "bg-zinc-800/40 border-zinc-700/30 hover:border-zinc-600/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-zinc-200 truncate">
                        {proj.display_name}
                      </div>
                      <div className="text-xs text-zinc-500 truncate mt-0.5">
                        {proj.project_name}
                      </div>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${statusColors[proj.status] || statusColors.active}`}>
                      {proj.status}
                    </span>
                  </div>

                  {/* Tech stack */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(proj.tech_stack || []).slice(0, 3).map(t => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 bg-zinc-700/50 text-zinc-400 rounded">
                        {t}
                      </span>
                    ))}
                    {(proj.tech_stack || []).length > 3 && (
                      <span className="text-[10px] text-zinc-500">+{proj.tech_stack.length - 3}</span>
                    )}
                  </div>

                  {/* Open issues */}
                  {proj.open_issues?.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 text-amber-400">
                      <AlertTriangle size={10} />
                      <span className="text-[10px]">{proj.open_issues.length} otwartych kwestii</span>
                    </div>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Szczegóły projektu */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            {selectedCtx ? (
              <div className="space-y-4">
                {/* Header projektu */}
                <div className="p-4 bg-zinc-800/40 rounded-lg border border-zinc-700/30">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-white">{selectedCtx.display_name}</h3>
                      {selectedCtx.description && (
                        <p className="text-xs text-zinc-400 mt-1">{selectedCtx.description}</p>
                      )}
                    </div>
                    {selectedCtx.url && (
                      <a
                        href={selectedCtx.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        <ExternalLink size={12} />
                        Otwórz
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                    <Clock size={10} />
                    Ostatnia aktywność: {selectedCtx.last_activity}
                  </div>
                </div>

                {/* Ostatni postęp */}
                {selectedCtx.recent_progress?.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">Ostatni postęp</div>
                    <div className="space-y-2">
                      {selectedCtx.recent_progress.slice(-3).reverse().map((p, i) => (
                        <div key={i} className="flex gap-2 p-2 bg-zinc-800/30 rounded border border-zinc-700/20">
                          <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                          <div>
                            <div className="text-xs text-zinc-300">{p.what}</div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">{p.date}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Otwarte kwestie */}
                {selectedCtx.open_issues?.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">Otwarte kwestie</div>
                    <div className="space-y-1">
                      {selectedCtx.open_issues.map((issue, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 bg-zinc-800/30 rounded border border-zinc-700/20">
                          <AlertTriangle size={11} className={`mt-0.5 shrink-0 ${priorityColors[issue.priority] || "text-zinc-400"}`} />
                          <span className="text-xs text-zinc-300">{issue.issue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Relevantna wiedza */}
                {relevantExperiences.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">
                      Relevantna wiedza dla tego projektu
                    </div>
                    <div className="space-y-2">
                      {relevantExperiences.map(exp => (
                        <div key={exp.id} className="p-2 bg-emerald-500/5 rounded border border-emerald-500/15">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-xs text-zinc-300 font-medium leading-snug">{exp.title}</div>
                            <span className="text-[10px] text-emerald-400 shrink-0">
                              {Math.round((exp.confidence || 0) * 100)}%
                            </span>
                          </div>
                          {exp.recommended_action && (
                            <div className="text-[10px] text-zinc-500 mt-1">
                              → {exp.recommended_action}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Layers size={32} className="text-zinc-600 mb-3" />
                <div className="text-sm text-zinc-500">Wybierz projekt z listy</div>
                <div className="text-xs text-zinc-600 mt-1">aby zobaczyć szczegóły i relevantną wiedzę</div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "flow" && (
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Diagram przepływu wiedzy */}
          <div className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/30">
            <div className="text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wider">Jak wiedza przepływa</div>
            <div className="flex items-center gap-2 text-xs text-zinc-300 flex-wrap">
              <div className="px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-300">
                Rozmowa z Manusem
              </div>
              <ArrowRight size={14} className="text-zinc-600" />
              <div className="px-3 py-2 bg-zinc-700/40 border border-zinc-600/30 rounded-lg">
                manus_conversation_notes
              </div>
              <ArrowRight size={14} className="text-zinc-600" />
              <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300">
                02:00 Learning Run
              </div>
              <ArrowRight size={14} className="text-zinc-600" />
              <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300">
                manus_experiences
              </div>
              <ArrowRight size={14} className="text-zinc-600" />
              <div className="px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-300">
                Wszystkie projekty
              </div>
            </div>
          </div>

          {/* Stats przepływu */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Projekty w bazie", value: projects.length, color: "text-blue-400" },
              { label: "Doświadczenia", value: experiences.length, color: "text-emerald-400" },
              { label: "Aktywne projekty", value: activeProjects.length, color: "text-amber-400" },
            ].map(stat => (
              <div key={stat.label} className="p-3 bg-zinc-800/40 rounded-lg border border-zinc-700/30 text-center">
                <div className={`text-2xl font-bold font-display ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-zinc-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* GitHub repo info */}
          <div className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/30">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch size={14} className="text-zinc-400" />
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">GitHub — Publiczne Repo</div>
            </div>
            <div className="space-y-2 text-xs text-zinc-300">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 w-24">Repo:</span>
                <a
                  href="https://github.com/szachmacik/manus-brain-skills"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  manus-brain-skills <ExternalLink size={10} />
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 w-24">Zawiera:</span>
                <span>SKILL.md, szablony, migracje, dokumentacja</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 w-24">Użycie:</span>
                <span className="font-mono text-[10px] bg-zinc-700/50 px-2 py-0.5 rounded">
                  /home/ubuntu/skills/manus-brain/SKILL.md
                </span>
              </div>
            </div>
          </div>

          {/* Instrukcja dla nowego projektu */}
          <div className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/30">
            <div className="text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wider">Jak podłączyć nowy projekt</div>
            <div className="space-y-2">
              {[
                "1. Manus automatycznie ładuje kontekst z bazy na początku rozmowy",
                "2. Stosuje doświadczenia z confidence > 0.8 bezwarunkowo",
                "3. Po zakończeniu sesji zapisuje notatkę do manus_conversation_notes",
                "4. Nocny run o 02:00 przetwarza notatki i aktualizuje bazę",
                "5. Jutro rano wiedza jest dostępna dla wszystkich projektów",
              ].map((step, i) => (
                <div key={i} className="flex gap-2 text-xs text-zinc-400">
                  <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
