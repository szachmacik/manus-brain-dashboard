/**
 * vault.ts — tRPC router dla Secure Vault (autodeployment keys)
 * Przechowuje klucze w Supabase autodeploy_vault (zaszyfrowane)
 * Używany przez VaultPanel do zarządzania kluczami Coolify/GitHub
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Klucze wymagane do autodeploymentu
const VAULT_KEYS = [
  {
    key: "COOLIFY_TOKEN",
    label: "Coolify API Token",
    description: "coolify.ofshore.dev → Settings → API Tokens → New Token",
    required: true,
    sensitive: true,
  },
  {
    key: "COOLIFY_WEBHOOK_URL",
    label: "Coolify Deploy Webhook URL",
    description: "Coolify → aplikacja → Webhooks → Deploy Webhook URL",
    required: true,
    sensitive: false,
  },
  {
    key: "GITHUB_PAT",
    label: "GitHub Personal Access Token",
    description: "github.com → Settings → Developer settings → PAT → scope: repo",
    required: true,
    sensitive: true,
  },
  {
    key: "DIGITALOCEAN_TOKEN",
    label: "DigitalOcean API Token",
    description: "cloud.digitalocean.com → API → Tokens → Generate (opcjonalny)",
    required: false,
    sensitive: true,
  },
  {
    key: "CLOUDFLARE_TOKEN",
    label: "Cloudflare API Token",
    description: "dash.cloudflare.com → Profile → API Tokens (opcjonalny)",
    required: false,
    sensitive: true,
  },
];

export const vaultRouter = router({
  // ── STATUS — sprawdź które klucze są ustawione ────────────────────────────
  status: publicProcedure.query(async () => {
    const supabase = getSupabase();
    if (!supabase) return { keys: VAULT_KEYS.map(k => ({ ...k, isSet: false, maskedValue: null })), ready: false };

    const { data } = await supabase
      .from("autodeploy_vault")
      .select("key_name, key_value")
      .in("key_name", VAULT_KEYS.map(k => k.key));

    const vaultMap: Record<string, string> = {};
    for (const row of data ?? []) {
      vaultMap[row.key_name] = row.key_value;
    }

    const keys = VAULT_KEYS.map(k => {
      const val = vaultMap[k.key] ?? "";
      const isSet = val.length > 0;
      const maskedValue = isSet
        ? (k.sensitive
          ? val.slice(0, 4) + "•".repeat(Math.min(val.length - 8, 20)) + val.slice(-4)
          : val)
        : null;
      return { ...k, isSet, maskedValue };
    });

    const requiredKeys = keys.filter(k => k.required);
    const ready = requiredKeys.every(k => k.isSet);

    return { keys, ready };
  }),

  // ── SET KEY — zapisz klucz do Vault ─────────────────────────────────────
  setKey: publicProcedure
    .input(z.object({
      key: z.string().min(1),
      value: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const supabase = getSupabase();
      if (!supabase) return { success: false, error: "Supabase not configured" };

      // Sprawdź czy klucz jest dozwolony
      const allowed = VAULT_KEYS.map(k => k.key);
      if (!allowed.includes(input.key)) {
        return { success: false, error: "Unknown key" };
      }

      // Upsert do autodeploy_vault
      const { error } = await supabase
        .from("autodeploy_vault")
        .upsert(
          { key_name: input.key, key_value: input.value, updated_at: new Date().toISOString() },
          { onConflict: "key_name" }
        );

      return { success: !error, error: error?.message };
    }),

  // ── DELETE KEY — usuń klucz z Vault ─────────────────────────────────────
  deleteKey: publicProcedure
    .input(z.object({ key: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const supabase = getSupabase();
      if (!supabase) return { success: false };
      const { error } = await supabase
        .from("autodeploy_vault")
        .update({ key_value: "", updated_at: new Date().toISOString() })
        .eq("key_name", input.key);
      return { success: !error };
    }),

  // ── TRIGGER DEPLOY — wywołaj deploy przez Coolify API ───────────────────
  triggerDeploy: publicProcedure.mutation(async () => {
    const supabase = getSupabase();
    if (!supabase) return { success: false, error: "Supabase not configured" };

    // Pobierz klucze z Vault
    const { data } = await supabase
      .from("autodeploy_vault")
      .select("key_name, key_value")
      .in("key_name", ["COOLIFY_TOKEN", "COOLIFY_WEBHOOK_URL"]);

    const vaultMap: Record<string, string> = {};
    for (const row of data ?? []) vaultMap[row.key_name] = row.key_value;

    const webhookUrl = vaultMap["COOLIFY_WEBHOOK_URL"];
    const token = vaultMap["COOLIFY_TOKEN"];

    if (!webhookUrl || !token) {
      return { success: false, error: "COOLIFY_TOKEN lub COOLIFY_WEBHOOK_URL nie są ustawione w Vault" };
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        // Zapisz log deployu
        await supabase.from("manus_scheduler_jobs").insert({
          job_type: "manual_deploy",
          status: "completed",
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          result: JSON.stringify({ triggered: true, url: webhookUrl.replace(/token=[^&]+/, "token=***") }),
        });
        return { success: true, message: "Deploy triggered successfully" };
      } else {
        return { success: false, error: `Coolify returned HTTP ${response.status}` };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }),
});
