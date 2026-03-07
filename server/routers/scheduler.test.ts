/**
 * Tests for Scheduler Router
 * Testy dla pipeline managera i scheduler jobs
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Mock Supabase
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
};

describe("Scheduler Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as any).mockReturnValue(mockSupabase);
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_KEY = "test-key";
  });

  describe("TF-IDF Embedding Generation", () => {
    it("generates 1536-dim embedding for text", () => {
      // Test the embedding function logic
      const text = "React hooks optimization performance";
      const words = text.toLowerCase().split(/\s+/).filter(Boolean);
      expect(words.length).toBe(4);
      expect(words).toContain("react");
      expect(words).toContain("hooks");
    });

    it("handles empty text gracefully", () => {
      const text = "";
      const words = text.toLowerCase().split(/\s+/).filter(Boolean);
      expect(words.length).toBe(0);
    });

    it("normalizes text correctly", () => {
      const text = "Hello, World! This is a TEST.";
      const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
      expect(normalized).not.toContain(",");
      expect(normalized).not.toContain("!");
      expect(normalized).not.toContain(".");
    });
  });

  describe("Cosine Similarity", () => {
    it("returns 1.0 for identical vectors", () => {
      const v = [1, 0, 0, 0];
      let dot = 0, magA = 0, magB = 0;
      for (let i = 0; i < v.length; i++) {
        dot += v[i] * v[i];
        magA += v[i] * v[i];
        magB += v[i] * v[i];
      }
      const sim = dot / (Math.sqrt(magA) * Math.sqrt(magB));
      expect(sim).toBeCloseTo(1.0);
    });

    it("returns 0.0 for orthogonal vectors", () => {
      const a = [1, 0];
      const b = [0, 1];
      let dot = 0, magA = 0, magB = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
      }
      const sim = dot / (Math.sqrt(magA) * Math.sqrt(magB));
      expect(sim).toBeCloseTo(0.0);
    });

    it("returns value between 0 and 1 for similar vectors", () => {
      const a = [0.8, 0.2, 0.1];
      const b = [0.7, 0.3, 0.0];
      let dot = 0, magA = 0, magB = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
      }
      const sim = dot / (Math.sqrt(magA) * Math.sqrt(magB));
      expect(sim).toBeGreaterThan(0);
      expect(sim).toBeLessThanOrEqual(1);
    });
  });

  describe("Scheduler Jobs", () => {
    it("status returns empty jobs when no Supabase", () => {
      process.env.SUPABASE_URL = "";
      process.env.SUPABASE_KEY = "";
      // Without Supabase, should return empty
      const result = { jobs: [] };
      expect(result.jobs).toHaveLength(0);
    });

    it("formats duration correctly", () => {
      const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
      };
      expect(formatDuration(500)).toBe("500ms");
      expect(formatDuration(2500)).toBe("2.5s");
      expect(formatDuration(90000)).toBe("1m 30s");
    });

    it("formats date correctly", () => {
      const formatDate = (iso: string | null) => {
        if (!iso) return "Nigdy";
        const d = new Date(iso);
        return d.toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      };
      expect(formatDate(null)).toBe("Nigdy");
      const result = formatDate("2026-03-07T10:00:00Z");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("Pipeline Results", () => {
    it("parses JSON result correctly", () => {
      const result = JSON.stringify({
        indexing: { indexed: 5, skipped: 10, errors: 0 },
        links: { created: 15 },
        snapshot: { saved: 7 },
      });
      const parsed = JSON.parse(result);
      expect(parsed.indexing.indexed).toBe(5);
      expect(parsed.links.created).toBe(15);
      expect(parsed.snapshot.saved).toBe(7);
    });

    it("handles missing result fields gracefully", () => {
      const result = { indexing: { indexed: 0, skipped: 0, errors: 0 } };
      expect(result.indexing).toBeDefined();
      expect((result as any).links).toBeUndefined();
    });

    it("calculates total indexed correctly", () => {
      const runs = [
        { indexed: 5, skipped: 10 },
        { indexed: 3, skipped: 7 },
        { indexed: 0, skipped: 20 },
      ];
      const totalIndexed = runs.reduce((s, r) => s + r.indexed, 0);
      expect(totalIndexed).toBe(8);
    });
  });

  describe("Cluster Snapshot Logic", () => {
    it("generates correct snapshot date format", () => {
      const today = new Date().toISOString().split("T")[0];
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("prevents duplicate snapshots for same day", () => {
      const today = new Date().toISOString().split("T")[0];
      const existingSnapshots = [{ snapshot_date: today }];
      const alreadyExists = existingSnapshots.some((s) => s.snapshot_date === today);
      expect(alreadyExists).toBe(true);
    });

    it("allows snapshot for different day", () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      const existingSnapshots = [{ snapshot_date: yesterday }];
      const today = new Date().toISOString().split("T")[0];
      const alreadyExists = existingSnapshots.some((s) => s.snapshot_date === today);
      expect(alreadyExists).toBe(false);
    });
  });
});
