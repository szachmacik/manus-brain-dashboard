import { boolean, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Web Push subscriptions
export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("userAgent"),
  label: varchar("label", { length: 128 }).default("Mój telefon"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastUsedAt: timestamp("lastUsedAt").defaultNow().notNull(),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

// Notification history
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  body: text("body").notNull(),
  type: mysqlEnum("type", [
    "learning_complete",
    "action_required",
    "health_alert",
    "budget_alert",
    "project_update",
    "procedure_update",
    "test",
  ]).default("test").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  url: text("url"),
  data: json("data"),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  deliveredCount: int("deliveredCount").default(0).notNull(),
  failedCount: int("failedCount").default(0).notNull(),
  isRead: boolean("isRead").default(false).notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// Multi-AI Router — logi użycia modeli
export const aiUsageLogs = mysqlTable("ai_usage_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  provider: varchar("provider", { length: 32 }).notNull(), // claude | kimi | deepseek | manus
  modelId: varchar("modelId", { length: 128 }).notNull(),
  taskType: varchar("taskType", { length: 64 }).default("general"),
  inputTokens: int("inputTokens").default(0),
  outputTokens: int("outputTokens").default(0),
  costUsd: varchar("costUsd", { length: 20 }).default("0"),
  latencyMs: int("latencyMs").default(0),
  success: boolean("success").default(true).notNull(),
  errorMsg: text("errorMsg"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AIUsageLog = typeof aiUsageLogs.$inferSelect;
export type InsertAIUsageLog = typeof aiUsageLogs.$inferInsert;
