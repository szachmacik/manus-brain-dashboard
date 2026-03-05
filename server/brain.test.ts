import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock getDb to avoid real DB connection in tests
vi.mock("./db.push", () => ({
  getPushSubscriptions: vi.fn().mockResolvedValue([]),
  saveSubscription: vi.fn().mockResolvedValue({ id: 1 }),
  deleteSubscription: vi.fn().mockResolvedValue(undefined),
  saveNotification: vi.fn().mockResolvedValue({ id: 1 }),
  getNotifications: vi.fn().mockResolvedValue([]),
  markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }),
  },
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user-123",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "admin" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("auth.me", () => {
  it("returns null for unauthenticated user", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.openId).toBe("test-user-123");
  });
});

describe("push.getHistory", () => {
  it("returns empty array when no notifications", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.push.getHistory({ limit: 10, offset: 0 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("ai.listModels", () => {
  it("returns list of AI models with manus always available", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.ai.listModels();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    // Sprawdź że każdy model ma wymagane pola
    for (const model of result) {
      expect(model).toHaveProperty("id");
      expect(model).toHaveProperty("name");
      expect(model).toHaveProperty("available");
    }
  });
});

describe("brain.stats", () => {
  it("returns stats object with required fields", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.brain.stats();
    // Sprawdź pola z MySQL DB
    expect(result).toHaveProperty("notifications");
    expect(result).toHaveProperty("aiCallsToday");
    expect(result).toHaveProperty("activityEvents");
    // Sprawdź pola z Supabase
    expect(result).toHaveProperty("experiences");
    expect(result).toHaveProperty("patterns");
    expect(result).toHaveProperty("healthScore");
    expect(typeof result.notifications).toBe("number");
    expect(typeof result.healthScore).toBe("number");
  });
});

describe("brain.search", () => {
  it("returns search results object with results array", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.brain.search({ query: "test", limit: 5 });
    expect(result).toHaveProperty("results");
    expect(Array.isArray(result.results)).toBe(true);
    expect(result).toHaveProperty("fromCache");
  });

  it("rejects empty query", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.brain.search({ query: "", limit: 5 })).rejects.toThrow();
  });
});

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });
});
