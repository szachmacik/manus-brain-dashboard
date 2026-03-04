/*
 * ProjectsPanel — aktywne projekty Manusa
 * Design: Dark Intelligence Dashboard | Emerald accents
 */

import { FolderOpen, ExternalLink, Clock, AlertCircle, CheckCircle2, Tag } from "lucide-react";

interface ProjectsPanelProps {
  projects: any[];
}

export default function ProjectsPanel({ projects }: ProjectsPanelProps) {
  if (!projects.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <FolderOpen className="w-10 h-10 opacity-30" />
        <p className="text-sm">Brak projektów. System uruchomi się dziś w nocy.</p>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    active:    "bg-primary/20 text-primary border-primary/30",
    paused:    "bg-yellow-400/20 text-yellow-400 border-yellow-400/30",
    completed: "bg-blue-400/20 text-blue-400 border-blue-400/30",
    archived:  "bg-muted text-muted-foreground border-border",
  };

  const statusLabel: Record<string, string> = {
    active: "Aktywny", paused: "Wstrzymany", completed: "Ukończony", archived: "Archiwum"
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Projekty</h2>
        <p className="text-muted-foreground text-sm mt-1">Kontekst aktywnych projektów Manusa</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {projects.map((project) => {
          const openIssues = Array.isArray(project.open_issues) ? project.open_issues : [];
          const recentProgress = Array.isArray(project.recent_progress) ? project.recent_progress : [];
          const techStack = Array.isArray(project.tech_stack) ? project.tech_stack : [];

          return (
            <div key={project.id} className="glass-card rounded-xl p-5 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-semibold text-foreground truncate">
                      {project.display_name || project.project_name}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor[project.status] || statusColor.archived}`}>
                      {statusLabel[project.status] || project.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{project.project_name}</p>
                </div>
                {project.url && (
                  <a href={project.url} target="_blank" rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>

              {/* Tech stack */}
              {techStack.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {techStack.map((tech: string) => (
                    <span key={tech} className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                      {tech}
                    </span>
                  ))}
                </div>
              )}

              {/* Recent progress */}
              {recentProgress.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ostatnie postępy</p>
                  {recentProgress.slice(0, 2).map((p: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-foreground/80 text-xs">{p.what}</span>
                      {p.date && <span className="text-muted-foreground text-xs ml-auto flex-shrink-0">{p.date}</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Open issues */}
              {openIssues.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Otwarte zadania</p>
                  {openIssues.slice(0, 3).map((issue: any, i: number) => {
                    const text = typeof issue === "string" ? issue : issue.issue || JSON.stringify(issue);
                    const priority = typeof issue === "object" ? issue.priority : null;
                    return (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <AlertCircle className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${priority === "high" ? "text-red-400" : "text-yellow-400"}`} />
                        <span className="text-foreground/70">{text}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{project.last_activity || "—"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  <span>{project.note_count || 0} notatek</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
