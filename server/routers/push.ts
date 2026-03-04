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
});
