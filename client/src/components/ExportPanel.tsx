/**
 * ExportPanel — eksport danych bazy wiedzy do JSON, CSV lub Markdown
 * Z historią eksportów i podglądem rozmiaru pliku
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Download, FileJson, FileText, File, Clock, CheckCircle, Loader2, AlertCircle, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type ExportFormat = "json" | "csv" | "markdown";
type ExportScope = "all" | "experiences" | "notes" | "projects" | "patterns" | "analytics";

const FORMAT_CONFIG: Record<ExportFormat, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  json: { label: "JSON", icon: <FileJson size={20} />, color: "text-amber-400", desc: "Pełna struktura danych, idealna do importu" },
  csv: { label: "CSV", icon: <File size={20} />, color: "text-green-400", desc: "Arkusz kalkulacyjny, Excel/Google Sheets" },
  markdown: { label: "Markdown", icon: <FileText size={20} />, color: "text-blue-400", desc: "Czytelny dokument, GitHub/Notion" },
};

const SCOPE_CONFIG: Record<ExportScope, { label: string; desc: string }> = {
  all: { label: "Wszystko", desc: "Doświadczenia + notatki + projekty + wzorce" },
  experiences: { label: "Doświadczenia", desc: "Cała baza doświadczeń Manusa" },
  notes: { label: "Notatki", desc: "Notatki z rozmów i sesji" },
  projects: { label: "Projekty", desc: "Kontekst i status projektów" },
  patterns: { label: "Wzorce", desc: "Dobre praktyki i anty-wzorce" },
  analytics: { label: "Analityka", desc: "Statystyki i metryki systemu" },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function ExportPanel() {
  const [format, setFormat] = useState<ExportFormat>("json");
  const [scope, setScope] = useState<ExportScope>("all");

  const exportMutation = trpc.brain.export.useMutation({
    onSuccess: (data) => {
      if ("error" in data) {
        toast.error(data.error as string);
        return;
      }
      // Trigger download
      const blob = new Blob([data.content], { type: data.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Pobrano ${data.fileName} (${data.recordCount} rekordów, ${formatBytes(data.sizeBytes)})`);
      historyQuery.refetch();
    },
    onError: (err) => toast.error(`Błąd eksportu: ${err.message}`),
  });

  const historyQuery = trpc.brain.exportHistory.useQuery(undefined, { staleTime: 30000 });

  const handleExport = () => {
    exportMutation.mutate({ format, scope });
  };

  return (
    <div className="h-full flex flex-col gap-5 p-6 overflow-y-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white font-display">Eksport Danych</h2>
        <p className="text-sm text-gray-400 mt-0.5">Pobierz bazę wiedzy Manusa w wybranym formacie</p>
      </div>

      {/* Format Selection */}
      <div>
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Format pliku</h3>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(FORMAT_CONFIG) as ExportFormat[]).map(f => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`p-4 rounded-xl border text-left transition-all ${
                format === f
                  ? "border-emerald-400/40 bg-emerald-400/10"
                  : "border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5"
              }`}
            >
              <div className={`mb-2 ${format === f ? "text-emerald-400" : FORMAT_CONFIG[f].color}`}>
                {FORMAT_CONFIG[f].icon}
              </div>
              <div className={`text-sm font-semibold ${format === f ? "text-emerald-400" : "text-white"}`}>
                {FORMAT_CONFIG[f].label}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{FORMAT_CONFIG[f].desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Scope Selection */}
      <div>
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Zakres danych</h3>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(SCOPE_CONFIG) as ExportScope[]).map(s => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`p-3 rounded-xl border text-left transition-all ${
                scope === s
                  ? "border-emerald-400/40 bg-emerald-400/10"
                  : "border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5"
              }`}
            >
              <div className={`text-sm font-medium ${scope === s ? "text-emerald-400" : "text-white"}`}>
                {SCOPE_CONFIG[s].label}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{SCOPE_CONFIG[s].desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Export Button */}
      <div className="p-4 rounded-xl bg-white/3 border border-white/8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-medium text-white">
              {SCOPE_CONFIG[scope].label} → {FORMAT_CONFIG[format].label}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{SCOPE_CONFIG[scope].desc}</div>
          </div>
          <div className={`p-2 rounded-lg ${FORMAT_CONFIG[format].color} bg-white/5`}>
            {FORMAT_CONFIG[format].icon}
          </div>
        </div>
        <Button
          onClick={handleExport}
          disabled={exportMutation.isPending}
          className="w-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-400/30"
        >
          {exportMutation.isPending ? (
            <><Loader2 size={16} className="mr-2 animate-spin" /> Generowanie...</>
          ) : (
            <><Download size={16} className="mr-2" /> Pobierz eksport</>
          )}
        </Button>
        {exportMutation.isError && (
          <div className="flex items-center gap-2 mt-2 text-xs text-red-400">
            <AlertCircle size={12} />
            {exportMutation.error.message}
          </div>
        )}
      </div>

      {/* Export History */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className="text-gray-400" />
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Historia eksportów</h3>
        </div>
        {historyQuery.isLoading ? (
          <div className="text-center py-4 text-gray-500 text-sm">
            <Loader2 size={16} className="animate-spin inline mr-2" />Ładowanie...
          </div>
        ) : historyQuery.data && historyQuery.data.length > 0 ? (
          <div className="space-y-2">
            {historyQuery.data.map(exp => (
              <div key={exp.id} className="flex items-center justify-between p-3 rounded-xl bg-white/3 border border-white/8">
                <div className="flex items-center gap-3">
                  <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-sm text-white font-mono">{exp.fileName}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {exp.recordCount} rekordów · {formatBytes(exp.fileSizeBytes ?? 0)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">{formatDate(exp.createdAt)}</div>
                  <div className="flex items-center gap-1 mt-0.5 justify-end">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-gray-400 uppercase">{exp.format}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-gray-400">{exp.scope}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            <Database size={24} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Brak historii eksportów</p>
            <p className="text-xs mt-1">Pierwszy eksport pojawi się tutaj po pobraniu</p>
          </div>
        )}
      </div>
    </div>
  );
}
