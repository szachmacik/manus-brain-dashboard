import { eq, desc, and } from "drizzle-orm";
import { getDb } from "./db";
import { pushSubscriptions, notifications, InsertPushSubscription, InsertNotification } from "../drizzle/schema";

// ── Push Subscriptions ──────────────────────────────────────────────────────

export async function upsertPushSubscription(data: InsertPushSubscription) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if endpoint already exists
  const existing = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, data.endpoint))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(pushSubscriptions)
      .set({ p256dh: data.p256dh, auth: data.auth, isActive: true, lastUsedAt: new Date() })
      .where(eq(pushSubscriptions.endpoint, data.endpoint));
    return existing[0];
  }

  await db.insert(pushSubscriptions).values(data);
  const inserted = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, data.endpoint))
    .limit(1);
  return inserted[0];
}

export async function getAllActiveSubscriptions() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.isActive, true));
}

export async function deactivateSubscription(endpoint: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(pushSubscriptions)
    .set({ isActive: false })
    .where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function getSubscriptions() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: pushSubscriptions.id,
      label: pushSubscriptions.label,
      userAgent: pushSubscriptions.userAgent,
      isActive: pushSubscriptions.isActive,
      createdAt: pushSubscriptions.createdAt,
      lastUsedAt: pushSubscriptions.lastUsedAt,
    })
    .from(pushSubscriptions)
    .orderBy(desc(pushSubscriptions.createdAt));
}

// ── Notifications ───────────────────────────────────────────────────────────

export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(notifications).values(data);
}

export async function getNotifications(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.sentAt))
    .limit(limit);
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}

export async function markAllNotificationsRead() {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.isRead, false));
}

export async function getUnreadCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(eq(notifications.isRead, false));
  return result.length;
}
