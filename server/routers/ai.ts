/**
 * Multi-AI Router — Manus Brain
 * Obsługuje: Claude (Anthropic), Kimi (Moonshot), DeepSeek, Manus (built-in)
 * Wszystkie modele są OpenAI-compatible (poza Claude który ma własne SDK)
 * Klucze API: ANTHROPIC_API_KEY, MOONSHOT_API_KEY, DEEPSEEK_API_KEY
 * Manus: BUILT_IN_FORGE_API_KEY / BUILT_IN_FORGE_API_URL (już wstrzyknięte)
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { aiUsageLogs } from "../../drizzle/schema";

// ─── Typy ────────────────────────────────────────────────────────────────────

export type AIProvider = "claude" | "kimi" | "deepseek" | "manus";

export interface AIModel {
  id: string;
  provider: AIProvider;
  name: string;
  description: string;
  contextWindow: number;
  inputCostPer1M: number;  // USD
  outputCostPer1M: number; // USD
  strengths: string[];
  available: boolean;
}

export const AI_MODELS: AIModel[] = [
  // Claude
  {
    id: "claude-3-5-sonnet-20241022",
    provider: "claude",
    name: "Claude 3.5 Sonnet",
    description: "Najlepszy do analizy, kodu i złożonych zadań",
    contextWindow: 200000,
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    strengths: ["kod", "analiza", "pisanie", "bezpieczeństwo"],
    available: !!process.env.ANTHROPIC_API_KEY,
  },
  {
    id: "claude-3-haiku-20240307",
    provider: "claude",
    name: "Claude 3 Haiku",
    description: "Szybki i tani Claude do prostych zadań",
    contextWindow: 200000,
    inputCostPer1M: 0.25,
    outputCostPer1M: 1.25,
    strengths: ["szybkość", "klasyfikacja", "streszczenia"],
    available: !!process.env.ANTHROPIC_API_KEY,
  },
  // Kimi (Moonshot)
  {
    id: "kimi-k2-turbo-preview",
    provider: "kimi",
    name: "Kimi K2 Turbo",
    description: "Najnowszy Kimi — długi kontekst, agentowe zadania",
    contextWindow: 128000,
    inputCostPer1M: 0.6,
    outputCostPer1M: 2.5,
    strengths: ["długi kontekst", "agenty", "bazy danych", "wielojęzyczność"],
    available: !!process.env.MOONSHOT_API_KEY,
  },
  {
    id: "moonshot-v1-128k",
    provider: "kimi",
    name: "Moonshot v1 128K",
    description: "Stabilny model Moonshot z 128K kontekstem",
    contextWindow: 128000,
    inputCostPer1M: 0.6,
    outputCostPer1M: 2.5,
    strengths: ["długi kontekst", "dokumenty", "RAG"],
    available: !!process.env.MOONSHOT_API_KEY,
  },
  // DeepSeek
  {
    id: "deepseek-chat",
    provider: "deepseek",
    name: "DeepSeek V3.2 Chat",
    description: "Najtańszy — idealny do rutynowych zadań i syntezy",
    contextWindow: 128000,
    inputCostPer1M: 0.028, // cache hit
    outputCostPer1M: 0.42,
    strengths: ["koszt", "kod", "synteza", "cache"],
    available: !!process.env.DEEPSEEK_API_KEY,
  },
  {
    id: "deepseek-reasoner",
    provider: "deepseek",
    name: "DeepSeek R1 Reasoner",
    description: "Model myślący — złożone rozumowanie i matematyka",
    contextWindow: 128000,
    inputCostPer1M: 0.028,
    outputCostPer1M: 0.42,
    strengths: ["rozumowanie", "matematyka", "logika", "chain-of-thought"],
    available: !!process.env.DEEPSEEK_API_KEY,
  },
  // Manus (built-in)
  {
    id: "manus-default",
    provider: "manus",
    name: "Manus Built-in",
    description: "Wbudowany model Manusa — zawsze dostępny, bez kluczy",
    contextWindow: 128000,
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    strengths: ["zawsze dostępny", "integracja", "sandbox"],
    available: true,
  },
];

// ─── Routing intelligence — dobór modelu do zadania ──────────────────────────

export function selectBestModel(
  taskType: string,
  preferCheap: boolean,
  availableProviders: AIProvider[]
): string {
  const available = AI_MODELS.filter(m =>
    m.available && availableProviders.includes(m.provider)
  );

  if (available.length === 0) return "manus-default";

  if (preferCheap) {
    // Sortuj po koszcie output
    const cheapest = [...available].sort(
      (a, b) => a.outputCostPer1M - b.outputCostPer1M
    );
    return cheapest[0].id;
  }

  // Routing per task type
  const routingMap: Record<string, AIProvider[]> = {
    code: ["claude", "deepseek", "kimi", "manus"],
    analysis: ["claude", "kimi", "deepseek", "manus"],
    reasoning: ["deepseek", "claude", "kimi", "manus"],
    synthesis: ["deepseek", "kimi", "claude", "manus"],
    longdoc: ["kimi", "claude", "deepseek", "manus"],
    security: ["claude", "deepseek", "kimi", "manus"],
    database: ["kimi", "deepseek", "claude", "manus"],
    general: ["deepseek", "kimi", "claude", "manus"],
  };

  const preferred = routingMap[taskType] || routingMap.general;

  for (const provider of preferred) {
    const model = available.find(m => m.provider === provider);
    if (model) return model.id;
  }

  return available[0].id;
}

// ─── API call helpers ─────────────────────────────────────────────────────────

async function callClaude(
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  // Anthropic SDK format
  const systemMsg = messages.find(m => m.role === "system");
  const userMsgs = messages.filter(m => m.role !== "system");

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: userMsgs,
  };
  if (systemMsg) body.system = systemMsg.content;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    content: Array<{ text: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };
  return {
    content: data.content[0]?.text ?? "",
    inputTokens: data.usage.input_tokens,
    outputTokens: data.usage.output_tokens,
  };
}

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number };
  };
  return {
    content: data.choices[0]?.message?.content ?? "",
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

async function callManus(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const apiUrl = process.env.BUILT_IN_FORGE_API_URL;
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
  if (!apiUrl || !apiKey) throw new Error("Manus API not configured");

  return callOpenAICompatible(apiUrl, apiKey, "gpt-4.1-mini", messages, maxTokens);
}

// ─── Główna funkcja routingu ──────────────────────────────────────────────────

export async function routeToAI(
  modelId: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens = 2000
): Promise<{
  content: string;
  modelId: string;
  provider: AIProvider;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
}> {
  const model = AI_MODELS.find(m => m.id === modelId) ?? AI_MODELS.find(m => m.id === "manus-default")!;
  const start = Date.now();

  let result: { content: string; inputTokens: number; outputTokens: number };

  try {
    if (model.provider === "claude") {
      result = await callClaude(model.id, messages, maxTokens);
    } else if (model.provider === "kimi") {
      const key = process.env.MOONSHOT_API_KEY!;
      result = await callOpenAICompatible("https://api.moonshot.ai/v1", key, model.id, messages, maxTokens);
    } else if (model.provider === "deepseek") {
      const key = process.env.DEEPSEEK_API_KEY!;
      result = await callOpenAICompatible("https://api.deepseek.com/v1", key, model.id, messages, maxTokens);
    } else {
      // manus fallback
      result = await callManus(messages, maxTokens);
    }
  } catch (err) {
    // Fallback do Manus jeśli wybrany model nie działa
    console.warn(`[AI Router] ${model.provider} failed, falling back to Manus:`, err);
    result = await callManus(messages, maxTokens);
  }

  const latencyMs = Date.now() - start;
  const costUsd =
    (result.inputTokens / 1_000_000) * model.inputCostPer1M +
    (result.outputTokens / 1_000_000) * model.outputCostPer1M;

  return {
    content: result.content,
    modelId: model.id,
    provider: model.provider,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd,
    latencyMs,
  };
}

// ─── tRPC Router ──────────────────────────────────────────────────────────────

export const aiRouter = router({
  // Lista dostępnych modeli
  listModels: publicProcedure.query(() => {
    return AI_MODELS.map(m => ({
      ...m,
      available: m.provider === "manus"
        ? true
        : m.provider === "claude"
          ? !!process.env.ANTHROPIC_API_KEY
          : m.provider === "kimi"
            ? !!process.env.MOONSHOT_API_KEY
            : !!process.env.DEEPSEEK_API_KEY,
    }));
  }),

  // Wyślij wiadomość do wybranego modelu
  chat: protectedProcedure
    .input(z.object({
      modelId: z.string(),
      messages: z.array(z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string(),
      })),
      maxTokens: z.number().min(100).max(8000).default(2000),
      taskType: z.string().default("general"),
      saveLog: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await routeToAI(input.modelId, input.messages, input.maxTokens);

      // Zapisz log użycia
      if (input.saveLog) {
        try {
          const db = await getDb();
          if (db) {
            await db.insert(aiUsageLogs).values({
              userId: ctx.user.id,
              provider: result.provider,
              modelId: result.modelId,
              taskType: input.taskType,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              costUsd: result.costUsd.toFixed(6),
              latencyMs: result.latencyMs,
              success: true,
            });
          }
        } catch (e) {
          console.warn("[AI Router] Failed to save usage log:", e);
        }
      }

      return result;
    }),

  // Auto-routing — dobierz najlepszy model do zadania
  autoRoute: protectedProcedure
    .input(z.object({
      messages: z.array(z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string(),
      })),
      taskType: z.enum(["code", "analysis", "reasoning", "synthesis", "longdoc", "security", "database", "general"]).default("general"),
      preferCheap: z.boolean().default(false),
      maxTokens: z.number().min(100).max(8000).default(2000),
    }))
    .mutation(async ({ input, ctx }) => {
      const availableProviders: AIProvider[] = ["manus"];
      if (process.env.ANTHROPIC_API_KEY) availableProviders.push("claude");
      if (process.env.MOONSHOT_API_KEY) availableProviders.push("kimi");
      if (process.env.DEEPSEEK_API_KEY) availableProviders.push("deepseek");

      const modelId = selectBestModel(input.taskType, input.preferCheap, availableProviders);
      const result = await routeToAI(modelId, input.messages, input.maxTokens);

      // Zapisz log
      try {
        const db = await getDb();
        if (db) {
          await db.insert(aiUsageLogs).values({
            userId: ctx.user.id,
            provider: result.provider,
            modelId: result.modelId,
            taskType: input.taskType,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            costUsd: result.costUsd.toFixed(6),
            latencyMs: result.latencyMs,
            success: true,
          });
        }
      } catch (e) {
        console.warn("[AI Router] Failed to save usage log:", e);
      }

      return { ...result, autoSelected: true };
    }),

  // Statystyki użycia modeli
  usageStats: protectedProcedure.query(async ({ ctx }) => {
    try {
      const db = await getDb();
      if (!db) return { logs: [], summary: [] };

      const logs = await db
        .select()
        .from(aiUsageLogs)
        .orderBy(aiUsageLogs.createdAt)
        .limit(200);

      // Grupuj po providerze
      const summary = Object.entries(
        logs.reduce((acc, log) => {
          const key = log.provider;
          if (!acc[key]) acc[key] = { provider: key, calls: 0, totalCost: 0, totalTokens: 0, avgLatency: 0 };
          acc[key].calls++;
          acc[key].totalCost += parseFloat(log.costUsd ?? "0");
          acc[key].totalTokens += (log.inputTokens ?? 0) + (log.outputTokens ?? 0);
          acc[key].avgLatency = (acc[key].avgLatency * (acc[key].calls - 1) + (log.latencyMs ?? 0)) / acc[key].calls;
          return acc;
        }, {} as Record<string, { provider: string; calls: number; totalCost: number; totalTokens: number; avgLatency: number }>)
      ).map(([, v]) => v);

      return { logs: logs.slice(-50), summary };
    } catch {
      return { logs: [], summary: [] };
    }
  }),

  // Test połączenia z modelem
  testConnection: protectedProcedure
    .input(z.object({ provider: z.enum(["claude", "kimi", "deepseek", "manus"]) }))
    .mutation(async ({ input }) => {
      const modelMap: Record<AIProvider, string> = {
        claude: "claude-3-haiku-20240307",
        kimi: "moonshot-v1-128k",
        deepseek: "deepseek-chat",
        manus: "manus-default",
      };

      const modelId = modelMap[input.provider];
      const start = Date.now();

      try {
        const result = await routeToAI(
          modelId,
          [{ role: "user", content: "Reply with exactly: OK" }],
          50
        );
        return {
          success: true,
          latencyMs: Date.now() - start,
          response: result.content.substring(0, 100),
          provider: input.provider,
        };
      } catch (err: unknown) {
        return {
          success: false,
          latencyMs: Date.now() - start,
          error: err instanceof Error ? err.message : "Unknown error",
          provider: input.provider,
        };
      }
    }),
});
