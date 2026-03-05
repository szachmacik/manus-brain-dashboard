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
    "weekly_report",
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
  provider: varchar("provider", { length: 32 }).notNull(),
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

// Activity Log — chronologiczna oś czasu wszystkich aktywności Manusa
export const activityLog = mysqlTable("activity_log", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", [
    "note_added",
    "experience_learned",
    "pattern_detected",
    "project_updated",
    "learning_run",
    "push_sent",
    "ai_call",
    "export_created",
    "health_check",
    "procedure_updated",
  ]).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  entityType: varchar("entityType", { length: 64 }), // "note" | "experience" | "project" | etc.
  entityId: varchar("entityId", { length: 128 }), // ID encji w Supabase lub MySQL
  metadata: json("metadata"),
  importance: int("importance").default(5), // 1-10
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = typeof activityLog.$inferInsert;

// Tags — tagi dla notatek, doświadczeń i projektów
export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  color: varchar("color", { length: 16 }).default("#10b981"), // emerald
  category: varchar("category", { length: 64 }).default("general"),
  usageCount: int("usageCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

// Search Cache — cache wyników wyszukiwania (optymalizacja kredytów)
export const searchCache = mysqlTable("search_cache", {
  id: int("id").autoincrement().primaryKey(),
  queryHash: varchar("queryHash", { length: 64 }).notNull().unique(), // SHA256 zapytania
  query: text("query").notNull(),
  results: json("results").notNull(),
  resultCount: int("resultCount").default(0).notNull(),
  hitCount: int("hitCount").default(0).notNull(), // ile razy użyto cache
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(), // TTL
});

export type SearchCache = typeof searchCache.$inferSelect;
export type InsertSearchCache = typeof searchCache.$inferInsert;

// Data Exports — historia eksportów danych
export const dataExports = mysqlTable("data_exports", {
  id: int("id").autoincrement().primaryKey(),
  format: mysqlEnum("format", ["json", "csv", "markdown"]).notNull(),
  scope: mysqlEnum("scope", [
    "all",
    "experiences",
    "notes",
    "projects",
    "patterns",
    "analytics",
  ]).notNull(),
  fileName: varchar("fileName", { length: 256 }).notNull(),
  recordCount: int("recordCount").default(0).notNull(),
  fileSizeBytes: int("fileSizeBytes").default(0).notNull(),
  downloadUrl: text("downloadUrl"), // URL do S3 lub base64
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DataExport = typeof dataExports.$inferSelect;
export type InsertDataExport = typeof dataExports.$inferInsert;

// System Config — konfiguracja systemu (klucze, ustawienia, flagi)
export const systemConfig = mysqlTable("system_config", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: text("value"),
  description: text("description"),
  isSecret: boolean("isSecret").default(false).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = typeof systemConfig.$inferInsert;
