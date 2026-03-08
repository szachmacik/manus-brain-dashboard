/**
 * Manus Brain — Scheduler Panel
 * Zarządzanie zaplanowanymi zadaniami: full pipeline, status, historia
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Play, Clock, CheckCircle2, XCircle, RefreshCw, Zap, Database, Link2, Layers, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Nigdy";
  const d = new Date(iso);
  return d.toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function ResultCard({ result }: { result: any }) {
  if (!result) return null;
  const parsed = typeof result === "string" ? JSON.parse(result) : result;

  return (
    <div className="grid grid-cols-3 gap-2 mt-2">
      {parsed.indexing && (
        <div className="bg-[#0a0a0a] rounded-lg p-2 border border-[#1a1a1a]">
          <div className="flex items-center gap-1 mb-1">
            <Database className="w-3 h-3 text-[#10b981]" />
            <span className="text-xs text-[#6b7280]">Indeksowanie</span>
          </div>
          <div className="text-xs text-white">
            <span className="text-[#10b981]">+{parsed.indexing.indexed}</span>
            {" "}nowych
          </div>
          <div className="text-xs text-[#6b7280]">{parsed.indexing.skipped} pominięto</div>
        </div>
      )}
      {parsed.links && (
        <div className="bg-[#0a0a0a] rounded-lg p-2 border border-[#1a1a1a]">
          <div className="flex items-center gap-1 mb-1">
            <Link2 className="w-3 h-3 text-[#8b5cf6]" />
            <span className="text-xs text-[#6b7280]">Linki</span>
          </div>
          <div className="text-xs text-white">
            <span className="text-[#8b5cf6]">{parsed.links.created}</span>
            {" "}semantic links
          </div>
        </div>
      )}
      {parsed.snapshot && (
        <div className="bg-[#0a0a0a] rounded-lg p-2 border border-[#1a1a1a]">
          <div className="flex items-center gap-1 mb-1">
            <Layers className="w-3 h-3 text-[#f59e0b]" />
            <span className="text-xs text-[#6b7280]">Snapshot</span>
          </div>
          <div className="text-xs text-white">
            {parsed.snapshot.saved > 0
              ? <span className="text-[#f59e0b]">{parsed.snapshot.saved} klastrów</span>
              : <span className="text-[#6b7280]">już dzisiaj</span>
            }
          </div>
        </div>
      )}
    </div>
  );
}

export default function SchedulerPanel() {
  const [lastRunResult, setLastRunResult] = useState<any>(null);

  const historyQuery = trpc.scheduler.history.useQuery({ limit: 10 });
  const runMutation = trpc.scheduler.runFullPipeline.useMutation({
    onSuccess: (data) => {
      setLastRunResult(data);
      historyQuery.refetch();
    },
  });
  const weeklyReportMutation = trpc.scheduler.weeklyVectorReport.useMutation({
    onSuccess: () => historyQuery.refetch(),
  });

  const lastRun = historyQuery.data?.runs?.[0];

  // Scheduled jobs config (informacyjne)
  const scheduledJobs = [
    {
      name: "Full Pipeline",
      description: "Indeksowanie + semantic links + cluster snapshot",
      schedule: "Co 6h (ręcznie lub przez cron)",
      icon: Zap,
      color: "#10b981",
    },
    {
      name: "Weekly Vector Report",
      description: "Eksport raportu wektorowego do Google Drive",
      schedule: "Co poniedziałek 08:00",
      icon: Calendar,
      color: "#8b5cf6",
    },
    {
      name: "Cluster Evolution Snapshot",
      description: "Zapis stanu klastrów do historii",
      schedule: "Codziennie 00:00",
      icon: Layers,
      color: "#f59e0b",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Pipeline Manager</h2>
          <p className="text-xs text-[#6b7280] mt-0.5">
            Zarządzaj indeksowaniem wektorowym i zaplanowanymi zadaniami
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            className="bg-[#10b981] hover:bg-[#059669] text-black font-semibold gap-2"
          >
            {runMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {runMutation.isPending ? "Uruchamiam..." : "Full Pipeline"}
          </Button>
          <Button
            onClick={() => weeklyReportMutation.mutate()}
            disabled={weeklyReportMutation.isPending}
            variant="outline"
            className="border-[#8b5cf6]/40 text-[#8b5cf6] hover:bg-[#8b5cf6]/10 gap-2"
          >
            {weeklyReportMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Calendar className="w-4 h-4" />
            )}
            Raport tygodniowy
          </Button>
        </div>
      </div>

      {/* Last run result */}
      {(lastRunResult || lastRun) && (
        <div className="bg-[#0d0d0d] border border-[#10b981]/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
              <span className="text-sm font-semibold text-white">Ostatnie uruchomienie</span>
            </div>
            <div className="flex items-center gap-2">
              {lastRun?.last_duration_ms && (
                <Badge variant="outline" className="text-xs border-[#1a1a1a] text-[#6b7280]">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatDuration(lastRun.last_duration_ms)}
                </Badge>
              )}
              <span className="text-xs text-[#6b7280]">
                {formatDate(lastRun?.last_run_at ?? null)}
              </span>
            </div>
          </div>
          <ResultCard result={lastRunResult?.results ?? lastRun?.last_result} />
        </div>
      )}

      {/* Error state */}
      {runMutation.isError && (
        <div className="bg-red-900/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-400">Błąd: {runMutation.error?.message}</span>
        </div>
      )}

      {/* Scheduled jobs */}
      <div>
        <h3 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-3">
          Zaplanowane zadania
        </h3>
        <div className="space-y-2">
          {scheduledJobs.map((job) => (
            <div
              key={job.name}
              className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4 flex items-center gap-4"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${job.color}15` }}
              >
                <job.icon className="w-4 h-4" style={{ color: job.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{job.name}</p>
                <p className="text-xs text-[#6b7280] mt-0.5">{job.description}</p>
              </div>
              <Badge
                variant="outline"
                className="text-xs border-[#1a1a1a] text-[#4b5563] shrink-0"
              >
                <Clock className="w-3 h-3 mr-1" />
                {job.schedule}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Run history */}
      <div>
        <h3 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider mb-3">
          Historia uruchomień
        </h3>
        {historyQuery.isLoading ? (
          <div className="text-center py-6 text-[#6b7280]">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : (historyQuery.data?.runs ?? []).length === 0 ? (
          <div className="text-center py-6 text-[#6b7280] text-sm">
            Brak historii. Uruchom pipeline po raz pierwszy.
          </div>
        ) : (
          <div className="space-y-1">
            {(historyQuery.data?.runs ?? []).map((run: any) => (
              <div
                key={run.id}
                className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-3 flex items-center gap-3"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white capitalize">{run.job_name?.replace("_", " ")}</p>
                  <p className="text-xs text-[#6b7280]">{formatDate(run.last_run_at)}</p>
                </div>
                {run.last_duration_ms && (
                  <span className="text-xs font-mono text-[#4b5563]">
                    {formatDuration(run.last_duration_ms)}
                  </span>
                )}
                <Badge
                  variant="outline"
                  className="text-xs"
                  style={{
                    borderColor: run.status === "success" ? "#10b98130" : "#ef444430",
                    color: run.status === "success" ? "#10b981" : "#ef4444",
                  }}
                >
                  {run.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
