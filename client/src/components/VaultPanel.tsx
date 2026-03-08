/**
 * VaultPanel — Bezpieczna przestrzeń do zarządzania kluczami autodeploymentu
 * Coolify Token, Webhook URL, GitHub PAT, DigitalOcean Token, Cloudflare Token
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Shield, Key, CheckCircle2, XCircle, Eye, EyeOff, Rocket, RefreshCw, AlertTriangle, ExternalLink, Lock } from "lucide-react";

interface KeyFormState {
  [key: string]: { value: string; editing: boolean; showValue: boolean };
}

export default function VaultPanel() {
  const [formState, setFormState] = useState<KeyFormState>({});
  const [deployStatus, setDeployStatus] = useState<{ loading: boolean; result: string | null; success: boolean | null }>({
    loading: false, result: null, success: null
  });

  const { data: vaultStatus, isLoading, refetch } = trpc.vault.status.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const setKeyMutation = trpc.vault.setKey.useMutation({
    onSuccess: () => refetch(),
  });

  const deleteKeyMutation = trpc.vault.deleteKey.useMutation({
    onSuccess: () => refetch(),
  });

  const triggerDeployMutation = trpc.vault.triggerDeploy.useMutation({
    onMutate: () => setDeployStatus({ loading: true, result: null, success: null }),
    onSuccess: (data) => setDeployStatus({
      loading: false,
      result: data.success ? data.message ?? "Deploy triggered!" : data.error ?? "Unknown error",
      success: data.success,
    }),
    onError: (err) => setDeployStatus({ loading: false, result: err.message, success: false }),
  });

  const getFieldState = (key: string) => formState[key] ?? { value: "", editing: false, showValue: false };

  const startEdit = (key: string) => {
    setFormState(prev => ({ ...prev, [key]: { ...getFieldState(key), editing: true } }));
  };

  const cancelEdit = (key: string) => {
    setFormState(prev => ({ ...prev, [key]: { ...getFieldState(key), editing: false, value: "" } }));
  };

  const saveKey = async (key: string) => {
    const val = getFieldState(key).value.trim();
    if (!val) return;
    await setKeyMutation.mutateAsync({ key, value: val });
    setFormState(prev => ({ ...prev, [key]: { value: "", editing: false, showValue: false } }));
  };

  const toggleShow = (key: string) => {
    setFormState(prev => ({ ...prev, [key]: { ...getFieldState(key), showValue: !getFieldState(key).showValue } }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  const keys = vaultStatus?.keys ?? [];
  const ready = vaultStatus?.ready ?? false;
  const requiredKeys = keys.filter(k => k.required);
  const optionalKeys = keys.filter(k => !k.required);
  const setCount = requiredKeys.filter(k => k.isSet).length;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
              Secure Vault
            </h2>
            <p className="text-sm text-muted-foreground">Klucze autodeploymentu — Digital Ocean · Coolify · Cloudflare</p>
          </div>
        </div>
        <button onClick={() => refetch()} className="p-2 rounded-md hover:bg-muted transition-colors">
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Status bar */}
      <div className={`rounded-lg border p-4 flex items-center gap-4 ${ready ? "border-primary/30 bg-primary/5" : "border-yellow-500/30 bg-yellow-500/5"}`}>
        {ready ? (
          <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
        )}
        <div className="flex-1">
          <div className={`text-sm font-semibold ${ready ? "text-primary" : "text-yellow-500"}`}>
            {ready ? "✅ Vault gotowy — autodeployment skonfigurowany" : `⚠️ Brakuje ${requiredKeys.length - setCount} z ${requiredKeys.length} wymaganych kluczy`}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {setCount}/{requiredKeys.length} wymaganych kluczy ustawionych
          </div>
        </div>
        {/* Progress */}
        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(setCount / requiredKeys.length) * 100}%`,
              background: ready ? "var(--color-primary)" : "#f59e0b"
            }}
          />
        </div>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 p-3 rounded-md bg-muted/30 border border-border">
        <Lock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          Klucze są przechowywane w tabeli <code className="bg-muted px-1 rounded">autodeploy_vault</code> w Supabase.
          Wartości wrażliwych kluczy są maskowane po zapisaniu. Nigdy nie wpisuj kluczy bezpośrednio w czacie.
        </p>
      </div>

      {/* Required keys */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          Wymagane klucze
        </h3>
        <div className="space-y-3">
          {requiredKeys.map((k) => (
            <KeyCard
              key={k.key}
              keyDef={k}
              fieldState={getFieldState(k.key)}
              onEdit={() => startEdit(k.key)}
              onCancel={() => cancelEdit(k.key)}
              onSave={() => saveKey(k.key)}
              onDelete={() => deleteKeyMutation.mutate({ key: k.key })}
              onToggleShow={() => toggleShow(k.key)}
              onChange={(val) => setFormState(prev => ({ ...prev, [k.key]: { ...getFieldState(k.key), value: val } }))}
              saving={setKeyMutation.isPending}
            />
          ))}
        </div>
      </div>

      {/* Optional keys */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <Key className="w-4 h-4 text-muted-foreground" />
          Opcjonalne klucze
        </h3>
        <div className="space-y-3">
          {optionalKeys.map((k) => (
            <KeyCard
              key={k.key}
              keyDef={k}
              fieldState={getFieldState(k.key)}
              onEdit={() => startEdit(k.key)}
              onCancel={() => cancelEdit(k.key)}
              onSave={() => saveKey(k.key)}
              onDelete={() => deleteKeyMutation.mutate({ key: k.key })}
              onToggleShow={() => toggleShow(k.key)}
              onChange={(val) => setFormState(prev => ({ ...prev, [k.key]: { ...getFieldState(k.key), value: val } }))}
              saving={setKeyMutation.isPending}
            />
          ))}
        </div>
      </div>

      {/* Deploy trigger */}
      <div className="rounded-lg border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Rocket className="w-4 h-4 text-primary" />
          Ręczny Deploy
        </h3>
        <p className="text-xs text-muted-foreground">
          Wywołaj deploy natychmiast przez Coolify Webhook. Wymaga ustawionych kluczy COOLIFY_TOKEN i COOLIFY_WEBHOOK_URL.
        </p>

        {deployStatus.result && (
          <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${deployStatus.success ? "bg-primary/10 text-primary border border-primary/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
            {deployStatus.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
            {deployStatus.result}
          </div>
        )}

        <button
          onClick={() => triggerDeployMutation.mutate()}
          disabled={!ready || deployStatus.loading}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {deployStatus.loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Rocket className="w-4 h-4" />
          )}
          {deployStatus.loading ? "Deploying..." : "Trigger Deploy Now"}
        </button>
      </div>

      {/* Links */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        {[
          { label: "Coolify Dashboard", url: "https://coolify.ofshore.dev" },
          { label: "GitHub Actions", url: "https://github.com/szachmacik/manus-brain-dashboard/actions" },
          { label: "DigitalOcean", url: "https://cloud.digitalocean.com" },
          { label: "Cloudflare DNS", url: "https://dash.cloudflare.com" },
        ].map(link => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 rounded-md border border-border hover:border-primary/40 hover:text-primary transition-colors text-muted-foreground"
          >
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── KeyCard subcomponent ─────────────────────────────────────────────────────

interface KeyCardProps {
  keyDef: {
    key: string;
    label: string;
    description: string;
    required: boolean;
    sensitive: boolean;
    isSet: boolean;
    maskedValue: string | null;
  };
  fieldState: { value: string; editing: boolean; showValue: boolean };
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
  onToggleShow: () => void;
  onChange: (val: string) => void;
  saving: boolean;
}

function KeyCard({ keyDef, fieldState, onEdit, onCancel, onSave, onDelete, onToggleShow, onChange, saving }: KeyCardProps) {
  return (
    <div className={`rounded-lg border p-4 transition-all ${keyDef.isSet ? "border-primary/20 bg-primary/3" : "border-border bg-card"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {keyDef.isSet ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            )}
            <span className="text-sm font-semibold text-foreground">{keyDef.label}</span>
            <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">{keyDef.key}</code>
          </div>
          <p className="text-xs text-muted-foreground">{keyDef.description}</p>

          {keyDef.isSet && keyDef.maskedValue && (
            <div className="mt-2 flex items-center gap-2">
              <code className="text-xs font-mono text-primary/80 bg-primary/5 px-2 py-1 rounded">
                {fieldState.showValue ? keyDef.maskedValue : "•".repeat(20)}
              </code>
              <button onClick={onToggleShow} className="text-muted-foreground hover:text-foreground transition-colors">
                {fieldState.showValue ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!fieldState.editing ? (
            <>
              <button
                onClick={onEdit}
                className="px-2.5 py-1 text-xs rounded-md border border-border hover:border-primary/40 hover:text-primary transition-colors"
              >
                {keyDef.isSet ? "Zmień" : "Ustaw"}
              </button>
              {keyDef.isSet && (
                <button
                  onClick={onDelete}
                  className="px-2.5 py-1 text-xs rounded-md border border-destructive/30 text-destructive/70 hover:border-destructive hover:text-destructive transition-colors"
                >
                  Usuń
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={onCancel}
                className="px-2.5 py-1 text-xs rounded-md border border-border hover:bg-muted transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={onSave}
                disabled={!fieldState.value.trim() || saving}
                className="px-2.5 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? "..." : "Zapisz"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Inline input */}
      {fieldState.editing && (
        <div className="mt-3">
          <input
            type={keyDef.sensitive ? "password" : "text"}
            value={fieldState.value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
            placeholder={`Wklej ${keyDef.label}...`}
            autoFocus
            className="w-full px-3 py-2 text-sm rounded-md border border-primary/40 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Enter aby zapisać · Escape aby anulować · Wartość jest bezpiecznie przechowywana w Supabase Vault
          </p>
        </div>
      )}
    </div>
  );
}
