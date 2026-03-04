import webpush from "web-push";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  upsertPushSubscription,
  getAllActiveSubscriptions,
  deactivateSubscription,
  getSubscriptions,
  createNotification,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
} from "../db.push";

// Configure VAPID
const vapidEmail = process.env.VAPID_EMAIL ?? "mailto:admin@manus.space";
const vapidPublic = process.env.VITE_VAPID_PUBLIC_KEY ?? "";
const vapidPrivate = process.env.VAPID_PRIVATE_KEY ?? "";

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);
}

// Helper: send push to all active subscriptions
export async function sendPushToAll(payload: {
  title: string;
  body: string;
  type: string;
  priority: string;
  url?: string;
  data?: Record<string, unknown>;
}) {
  const subs = await getAllActiveSubscriptions();
  let delivered = 0;
  let failed = 0;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    type: payload.type,
    url: payload.url ?? "/",
    data: payload.data ?? {},
    timestamp: Date.now(),
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        message,
        { TTL: 86400 }
      );
      delivered++;
    } catch (err: any) {
      failed++;
      // 410 Gone = subscription expired, deactivate
      if (err.statusCode === 410 || err.statusCode === 404) {
        await deactivateSubscription(sub.endpoint);
      }
    }
  }

  // Save to notification history
  await createNotification({
    title: payload.title,
    body: payload.body,
    type: payload.type as any,
    priority: payload.priority as any,
    url: payload.url,
    data: payload.data ?? null,
    deliveredCount: delivered,
    failedCount: failed,
  });

  return { delivered, failed };
}

export const pushRouter = router({
  // Get VAPID public key for Service Worker
  getVapidKey: publicProcedure.query(() => ({
    publicKey: vapidPublic,
  })),

  // Register push subscription
  subscribe: publicProcedure
    .input(
      z.object({
        endpoint: z.string(),
        p256dh: z.string(),
        auth: z.string(),
        label: z.string().optional(),
        userAgent: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const sub = await upsertPushSubscription({
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        label: input.label ?? "Moje urządzenie",
        userAgent: input.userAgent,
        isActive: true,
      });
      return { success: true, id: sub?.id };
    }),

  // Unsubscribe
  unsubscribe: publicProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ input }) => {
      await deactivateSubscription(input.endpoint);
      return { success: true };
    }),

  // List subscriptions (without sensitive keys)
  listSubscriptions: publicProcedure.query(async () => {
    return getSubscriptions();
  }),

  // Send test notification
  sendTest: publicProcedure.mutation(async () => {
    const result = await sendPushToAll({
      title: "🧠 Manus Brain — Test",
      body: "Powiadomienia Web Push działają poprawnie!",
      type: "test",
      priority: "low",
      url: "/",
    });
    return result;
  }),

  // Send custom notification (owner only in prod)
  sendNotification: publicProcedure
    .input(
      z.object({
        title: z.string(),
        body: z.string(),
        type: z.enum([
          "learning_complete",
          "action_required",
          "health_alert",
          "budget_alert",
          "project_update",
          "procedure_update",
          "test",
        ]),
        priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
        url: z.string().optional(),
        data: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      return sendPushToAll(input);
    }),

  // Get notification history
  getHistory: publicProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ input }) => {
      return getNotifications(input.limit);
    }),

  // Mark as read
  markRead: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await markNotificationRead(input.id);
      return { success: true };
    }),

  // Mark all read
  markAllRead: publicProcedure.mutation(async () => {
    const db = await import("../db").then(m => m.getDb());
    if (db) await markAllNotificationsRead();
    return { success: true };
  }),

  // Unread count
  unreadCount: publicProcedure.query(async () => {
    const count = await getUnreadCount();
    return { count };
  }),

  // Send weekly report push (manual trigger or scheduled)
  sendWeeklyReport: publicProcedure.mutation(async () => {
    // Fetch stats from Supabase via direct DB queries
    const { getDb } = await import("../db");
    const db = await getDb();

    // Collect data for the past 7 days
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let newExperiences = 0;
    let learningRuns = 0;
    let successfulRuns = 0;
    let totalCost = 0;
    let pendingNotes = 0;
    let currentHealth = 0;
    let healthTrend = 0;
    let budgetPct = 0;
    let cacheHitRate = 0;
    let totalExperiences = 0;

    try {
      // Use Supabase REST directly for simplicity
      const supabaseUrl = process.env.SUPABASE_URL!;
      const supabaseKey = process.env.SUPABASE_KEY!;
      const headers = {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      };

      const [expRes, runsRes, notesRes, healthRes, budgetRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/manus_experiences?created_at=gte.${weekAgo.toISOString()}&select=id`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/manus_learning_runs?started_at=gte.${weekAgo.toISOString()}&select=status,cost_estimate_usd,cache_hit_rate`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/manus_conversation_notes?processed_at=is.null&select=id`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/manus_system_health?select=overall_health,total_experiences&order=snapshot_date.desc&limit=2`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/manus_credit_budget?period_type=eq.monthly&select=budget_usd,spent_usd&order=period_start.desc&limit=1`, { headers }),
      ]);

      const [expData, runsData, notesData, healthData, budgetData] = await Promise.all([
        expRes.json(), runsRes.json(), notesRes.json(), healthRes.json(), budgetRes.json(),
      ]);

      newExperiences = Array.isArray(expData) ? expData.length : 0;
      const runs = Array.isArray(runsData) ? runsData : [];
      learningRuns = runs.length;
      successfulRuns = runs.filter((r: any) => r.status === "completed").length;
      totalCost = runs.reduce((s: number, r: any) => s + (r.cost_estimate_usd || 0), 0);
      cacheHitRate = runs.length > 0
        ? runs.reduce((s: number, r: any) => s + (r.cache_hit_rate || 0), 0) / runs.length
        : 0;
      pendingNotes = Array.isArray(notesData) ? notesData.length : 0;

      const health = Array.isArray(healthData) ? healthData : [];
      currentHealth = health[0]?.overall_health ?? 0;
      healthTrend = health.length > 1 ? currentHealth - (health[1]?.overall_health ?? currentHealth) : 0;
      totalExperiences = health[0]?.total_experiences ?? 0;

      const budget = Array.isArray(budgetData) && budgetData.length > 0 ? budgetData[0] : null;
      budgetPct = budget ? Math.round((budget.spent_usd / Math.max(budget.budget_usd, 0.001)) * 100) : 0;
    } catch (err) {
      console.error("[WeeklyReport] Error fetching stats:", err);
    }

    // Build report message
    const healthEmoji = currentHealth >= 70 ? "🟢" : currentHealth >= 40 ? "🟡" : "🔴";
    const trendArrow = healthTrend > 0 ? "↑" : healthTrend < 0 ? "↓" : "→";
    const priority = currentHealth < 40 || budgetPct > 80 ? "high" : currentHealth < 70 ? "medium" : "low";
    const priorityEmoji = priority === "high" ? "🔴" : priority === "medium" ? "🟡" : "🟢";

    const weekStr = new Date().toLocaleDateString("pl-PL", { day: "numeric", month: "long" });
    const title = `${priorityEmoji} Manus Brain — Raport tygodniowy (${weekStr})`;
    const body = [
      `${healthEmoji} Health: ${currentHealth.toFixed(0)}/100 ${trendArrow}${Math.abs(healthTrend).toFixed(0)}`,
      `Nowe wnioski: ${newExperiences} | Runy: ${successfulRuns}/${learningRuns}`,
      `Koszt tygodnia: $${totalCost.toFixed(4)} | Cache: ${(cacheHitRate * 100).toFixed(0)}%`,
      pendingNotes > 0 ? `⚠️ ${pendingNotes} notatek czeka na przetworzenie` : "✓ Wszystkie notatki przetworzone",
    ].join(" · ");

    const result = await sendPushToAll({
      title,
      body,
      type: "learning_complete",
      priority,
      url: "/",
      data: {
        report_type: "weekly",
        health: currentHealth,
        new_experiences: newExperiences,
        cost_usd: totalCost,
        pending_notes: pendingNotes,
        budget_pct: budgetPct,
        cache_hit_rate: cacheHitRate,
        total_experiences: totalExperiences,
      },
    });

    return { ...result, stats: { currentHealth, newExperiences, totalCost, pendingNotes, budgetPct } };
  }),
});
