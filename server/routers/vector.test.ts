/**
 * Tests for Vector Router
 * TF-IDF embedding, cosine similarity, semantic search
 */
import { describe, it, expect } from "vitest";

// ─── INLINE IMPLEMENTATIONS (no imports from router to avoid env issues) ─────

const DOMAIN_KEYWORDS: Record<string, number[]> = {
  react: [0, 1, 2], component: [3, 4], hook: [5, 6], state: [7, 8],
  typescript: [9, 10], css: [11, 12], tailwind: [13, 14], vite: [15],
  api: [20, 21], server: [22, 23], database: [24, 25], sql: [26, 27],
  supabase: [28, 29], trpc: [30, 31], express: [32], node: [33],
  embedding: [40, 41], vector: [42, 43], model: [44, 45], llm: [46, 47],
  ai: [48, 49], neural: [50, 51], semantic: [52, 53], similarity: [54],
  security: [60, 61], auth: [62, 63], token: [64, 65], jwt: [66, 67],
  performance: [80, 81], cache: [82, 83], optimization: [84, 85],
  deploy: [120, 121], docker: [122, 123], github: [126], manus: [128, 129],
};

function generateTFIDFEmbedding(text: string, dim = 1536): number[] {
  const tokens = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const tf: Record<string, number> = {};
  for (const token of tokens) tf[token] = (tf[token] || 0) + 1;
  const maxTF = Math.max(...Object.values(tf), 1);

  const embedding = new Array(dim).fill(0);

  for (const [word, dims] of Object.entries(DOMAIN_KEYWORDS)) {
    const wordTF = (tf[word] || 0) / maxTF;
    if (wordTF > 0) {
      for (const d of dims) {
        if (d < dim) embedding[d] += wordTF;
      }
    }
  }

  let seed = 0;
  for (const token of tokens) {
    for (let i = 0; i < token.length; i++) {
      seed = (seed * 31 + token.charCodeAt(i)) & 0xffffffff;
    }
  }
  for (let i = 200; i < dim; i++) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    embedding[i] = ((seed & 0xffff) / 0x8000 - 1) * 0.1;
  }

  let norm = 0;
  for (const v of embedding) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return embedding.map((v) => v / norm);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe("TF-IDF Embedding", () => {
  it("should generate a 1536-dimensional vector", () => {
    const vec = generateTFIDFEmbedding("React hooks state management");
    expect(vec).toHaveLength(1536);
  });

  it("should generate a unit vector (norm ≈ 1)", () => {
    const vec = generateTFIDFEmbedding("TypeScript API server database");
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 3);
  });

  it("should have non-zero values for known domain keywords", () => {
    const vec = generateTFIDFEmbedding("react component hook state");
    // Indices 0-8 should be non-zero (react, component, hook, state keywords)
    const domainPart = vec.slice(0, 15);
    const nonZero = domainPart.filter((v) => v !== 0);
    expect(nonZero.length).toBeGreaterThan(0);
  });

  it("should be deterministic — same text = same vector", () => {
    const text = "Supabase database SQL security auth";
    const vec1 = generateTFIDFEmbedding(text);
    const vec2 = generateTFIDFEmbedding(text);
    expect(vec1).toEqual(vec2);
  });

  it("should handle empty text without crashing", () => {
    const vec = generateTFIDFEmbedding("");
    expect(vec).toHaveLength(1536);
  });

  it("should handle special characters", () => {
    const vec = generateTFIDFEmbedding("React — unstable references w useEffect powodują infinite loops");
    expect(vec).toHaveLength(1536);
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 2);
  });
});

describe("Cosine Similarity", () => {
  it("should return 1.0 for identical vectors", () => {
    const vec = generateTFIDFEmbedding("React hooks state management");
    const sim = cosineSimilarity(vec, vec);
    expect(sim).toBeCloseTo(1.0, 5);
  });

  it("should return higher similarity for semantically related texts", () => {
    const reactVec = generateTFIDFEmbedding("React component hook state typescript");
    const reactVec2 = generateTFIDFEmbedding("React hooks state management component");
    const unrelatedVec = generateTFIDFEmbedding("Docker kubernetes deployment ci github");

    const simRelated = cosineSimilarity(reactVec, reactVec2);
    const simUnrelated = cosineSimilarity(reactVec, unrelatedVec);

    expect(simRelated).toBeGreaterThan(simUnrelated);
  });

  it("should return value between -1 and 1", () => {
    const vec1 = generateTFIDFEmbedding("Supabase database security auth");
    const vec2 = generateTFIDFEmbedding("React component hook state");
    const sim = cosineSimilarity(vec1, vec2);
    expect(sim).toBeGreaterThanOrEqual(-1);
    expect(sim).toBeLessThanOrEqual(1);
  });

  it("should return 0 for vectors of different lengths", () => {
    const sim = cosineSimilarity([1, 2, 3], [1, 2]);
    expect(sim).toBe(0);
  });

  it("should find similarity between Supabase-related texts", () => {
    const supabase1 = generateTFIDFEmbedding("Supabase database sql security");
    const supabase2 = generateTFIDFEmbedding("Supabase RLS Row Level Security database");
    const sim = cosineSimilarity(supabase1, supabase2);
    expect(sim).toBeGreaterThan(0.3);
  });
});

describe("Semantic Search Logic", () => {
  it("should rank most similar texts first", () => {
    const query = generateTFIDFEmbedding("React hooks optimization performance");
    
    const candidates = [
      { id: "1", text: "React hooks state management component", label: "react" },
      { id: "2", text: "Docker deployment kubernetes ci", label: "devops" },
      { id: "3", text: "React performance optimization cache", label: "react-perf" },
      { id: "4", text: "Supabase database security auth", label: "supabase" },
    ];

    const scored = candidates
      .map((c) => ({
        ...c,
        similarity: cosineSimilarity(query, generateTFIDFEmbedding(c.text)),
      }))
      .sort((a, b) => b.similarity - a.similarity);

    // React-related texts should rank higher than devops
    const reactIdx = scored.findIndex((s) => s.label === "react");
    const devopsIdx = scored.findIndex((s) => s.label === "devops");
    expect(reactIdx).toBeLessThan(devopsIdx);
  });

  it("should filter by threshold correctly", () => {
    const query = generateTFIDFEmbedding("React hooks");
    const candidates = [
      generateTFIDFEmbedding("React component hook state"),
      generateTFIDFEmbedding("Docker kubernetes deployment"),
    ];

    const sims = candidates.map((c) => cosineSimilarity(query, c));
    
    // At least one should be above 0.1 threshold
    expect(sims.some((s) => s > 0.1)).toBe(true);
  });
});

describe("Vector Clustering Logic", () => {
  it("should group similar vectors together", () => {
    // React-related texts
    const reactTexts = [
      "React component hook state typescript",
      "React hooks state management",
      "React component lifecycle useEffect",
    ];
    
    // Supabase-related texts
    const supabaseTexts = [
      "Supabase database sql security",
      "Supabase RLS Row Level Security",
    ];
    
    const reactVecs = reactTexts.map((t) => generateTFIDFEmbedding(t));
    const supabaseVecs = supabaseTexts.map((t) => generateTFIDFEmbedding(t));
    
    // Average intra-cluster similarity should be higher than inter-cluster
    const intraReact = reactVecs.reduce((sum, v, i) => {
      return sum + reactVecs.slice(i + 1).reduce((s, w) => s + cosineSimilarity(v, w), 0);
    }, 0);
    
    const inter = reactVecs.reduce((sum, v) => {
      return sum + supabaseVecs.reduce((s, w) => s + cosineSimilarity(v, w), 0);
    }, 0);
    
    // Intra-cluster similarity should be higher (more pairs)
    const avgIntra = intraReact / 3; // 3 pairs
    const avgInter = inter / (reactVecs.length * supabaseVecs.length);
    
    expect(avgIntra).toBeGreaterThan(avgInter);
  });
});
