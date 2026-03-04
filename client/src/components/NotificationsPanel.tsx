import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  learning_complete: { label: "Uczenie zakończone", color: "text-emerald-400", icon: "🧠" },
  action_required:  { label: "Wymagana akcja",     color: "text-yellow-400",  icon: "⚡" },
  health_alert:     { label: "Alert zdrowia",       color: "text-red-400",     icon: "❤️" },
  budget_alert:     { label: "Alert budżetu",       color: "text-orange-400",  icon: "💰" },
  project_update:   { label: "Aktualizacja projektu", color: "text-blue-400",  icon: "📦" },
  procedure_update: { label: "Aktualizacja procedur", color: "text-purple-400", icon: "📋" },
  test:             { label: "Test",                color: "text-muted-foreground", icon: "🔔" },
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "border-l-red-500 bg-red-500/5",
  high:     "border-l-orange-500 bg-orange-500/5",
  medium:   "border-l-yellow-500 bg-yellow-500/5",
  low:      "border-l-border bg-transparent",
};

export default function NotificationsPanel() {
  const [labelInput, setLabelInput] = useState("Mój telefon");
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{ delivered: number; failed: number } | null>(null);

  const push = usePushNotifications();
  const { data: history, refetch: refetchHistory } = trpc.push.getHistory.useQuery({ limit: 50 });
  const { data: subs, refetch: refetchSubs } = trpc.push.listSubscriptions.useQuery();
  const { data: unread } = trpc.push.unreadCount.useQuery();
  const markAllRead = trpc.push.markAllRead.useMutation({ onSuccess: () => refetchHistory() });

  const handleSubscribe = async () => {
    const ok = await push.subscribe(labelInput);
    if (ok) {
      setSubscribeSuccess(true);
      refetchSubs();
      setTimeout(() => setSubscribeSuccess(false), 4000);
    }
  };

  const handleUnsubscribe = async () => {
    await push.unsubscribe();
    refetchSubs();
  };

  const handleTest = async () => {
    const result = await push.sendTest();
    if (result) {
      setTestResult(result);
      refetchHistory();
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const formatTime = (d: Date | string) => {
    const date = typeof d === "string" ? new Date(d) : d;
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return "przed chwilą";
    if (diff < 3600) return `${Math.floor(diff / 60)} min temu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h temu`;
    return date.toLocaleDateString("pl-PL");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Powiadomienia</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Web Push — alerty na telefon i komputer w czasie rzeczywistym
          </p>
        </div>
        {(unread?.count ?? 0) > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            className="px-3 py-1.5 text-xs rounded-lg border border-border hover:border-primary/50 hover:text-primary transition-colors"
          >
            Oznacz wszystkie jako przeczytane ({unread?.count})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* === LEWA KOLUMNA: Konfiguracja === */}
        <div className="space-y-4">

          {/* Status karty */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                push.permission === "granted" && push.isSubscribed
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                  : push.permission === "denied"
                  ? "bg-red-400"
                  : "bg-yellow-400"
              }`} />
              <div>
                <p className="font-medium text-foreground text-sm">
                  {push.permission === "unsupported"
                    ? "Przeglądarka nie obsługuje Web Push"
                    : push.permission === "denied"
                    ? "Powiadomienia zablokowane"
                    : push.permission === "granted" && push.isSubscribed
                    ? "Powiadomienia aktywne"
                    : "Powiadomienia nieaktywne"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {push.permission === "denied"
                    ? "Odblokuj w ustawieniach przeglądarki"
                    : push.permission === "granted" && push.isSubscribed
                    ? "Będziesz otrzymywać alerty na to urządzenie"
                    : "Kliknij Włącz aby aktywować"}
                </p>
              </div>
            </div>

            {push.error && (
              <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {push.error}
              </div>
            )}

            {subscribeSuccess && (
              <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                ✓ Subskrypcja aktywna! Wyślij test aby sprawdzić.
              </div>
            )}

            {testResult && (
              <div className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs">
                Test wysłany: {testResult.delivered} dostarczono, {testResult.failed} błędów
              </div>
            )}

            {!push.isSubscribed && push.permission !== "denied" && push.isSupported && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Nazwa urządzenia</label>
                  <input
                    type="text"
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    placeholder="np. Mój iPhone, Laptop"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                  />
                </div>
                <button
                  onClick={handleSubscribe}
                  disabled={push.isLoading}
                  className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {push.isLoading ? "Aktywowanie..." : "🔔 Włącz powiadomienia"}
                </button>
              </div>
            )}

            {push.isSubscribed && (
              <div className="flex gap-2">
                <button
                  onClick={handleTest}
                  disabled={push.isLoading}
                  className="flex-1 py-2 rounded-lg border border-primary/30 text-primary text-sm hover:bg-primary/10 transition-colors"
                >
                  Wyślij test
                </button>
                <button
                  onClick={handleUnsubscribe}
                  disabled={push.isLoading}
                  className="flex-1 py-2 rounded-lg border border-border text-muted-foreground text-sm hover:border-red-500/30 hover:text-red-400 transition-colors"
                >
                  Wyłącz
                </button>
              </div>
            )}
          </div>

          {/* Aktywne urządzenia */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-medium text-foreground text-sm mb-3">
              Aktywne urządzenia ({subs?.filter(s => s.isActive).length ?? 0})
            </h3>
            {!subs || subs.length === 0 ? (
              <p className="text-xs text-muted-foreground">Brak zarejestrowanych urządzeń</p>
            ) : (
              <div className="space-y-2">
                {subs.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm text-foreground">{sub.label ?? "Urządzenie"}</p>
                      <p className="text-xs text-muted-foreground">
                        Ostatnio: {formatTime(sub.lastUsedAt)}
                      </p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${sub.isActive ? "bg-emerald-400" : "bg-muted-foreground"}`} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Typy alertów */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-medium text-foreground text-sm mb-3">Typy alertów</h3>
            <div className="space-y-2">
              {Object.entries(TYPE_LABELS).filter(([k]) => k !== "test").map(([key, info]) => (
                <div key={key} className="flex items-center gap-3 py-1.5">
                  <span className="text-base">{info.icon}</span>
                  <div className="flex-1">
                    <p className={`text-xs font-medium ${info.color}`}>{info.label}</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-400/60" />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Alerty są wysyłane automatycznie przez learning engine i skrypty nocne.
            </p>
          </div>
        </div>

        {/* === PRAWA KOLUMNA: Historia === */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-medium text-foreground text-sm mb-4">
            Historia powiadomień
            {(unread?.count ?? 0) > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-xs">
                {unread?.count} nowych
              </span>
            )}
          </h3>

          {!history || history.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🔕</div>
              <p className="text-sm text-muted-foreground">Brak powiadomień</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Włącz push i wyślij test aby zobaczyć historię
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {history.map((notif) => {
                const typeInfo = TYPE_LABELS[notif.type] ?? TYPE_LABELS.test;
                const priorityClass = PRIORITY_COLORS[notif.priority] ?? PRIORITY_COLORS.low;
                return (
                  <div
                    key={notif.id}
                    className={`border-l-2 pl-3 py-2 rounded-r-lg ${priorityClass} ${
                      !notif.isRead ? "opacity-100" : "opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-sm">{typeInfo.icon}</span>
                          <p className="text-sm font-medium text-foreground truncate">{notif.title}</p>
                          {!notif.isRead && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{notif.body}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-xs ${typeInfo.color}`}>{typeInfo.label}</span>
                          <span className="text-xs text-muted-foreground/50">
                            ✓{notif.deliveredCount} ✗{notif.failedCount}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground/50 flex-shrink-0 mt-0.5">
                        {formatTime(notif.sentAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
