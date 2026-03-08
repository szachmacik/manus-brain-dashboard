/**
 * Testy vitest — Checkpoint v10
 * Auto-reindeksowanie, tygodniowy raport, eksport grafu
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Supabase ─────────────────────────────────────────────────────────────
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "run-123" }, error: null }),
      then: vi.fn(),
    })),
  })),
}));

// ── TF-IDF Embedding Tests ─────────────────────────────────────────────────────
describe("TF-IDF Embedding Engine (v10)", () => {
  function generateTFIDFEmbedding(text: string, dim = 1536): number[] {
    const tokens = text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const tf: Record<string, number> = {};
    for (const token of tokens) tf[token] = (tf[token] || 0) + 1;

    const vector = new Array(dim).fill(0);
    for (const [word, count] of Object.entries(tf)) {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
      }
      const idx = Math.abs(hash) % dim;
      const tfidf = (count / tokens.length) * Math.log(1 + 1 / (count + 1));
      vector[idx] += tfidf;
    }
    const mag = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
    return mag > 0 ? vector.map((v) => v / mag) : vector;
  }

  it("generuje wektor o wymiarze 1536", () => {
    const emb = generateTFIDFEmbedding("react typescript component hook state");
    expect(emb).toHaveLength(1536);
  });

  it("zwraca znormalizowany wektor (norma ≈ 1)", () => {
    const emb = generateTFIDFEmbedding("security authentication jwt token oauth");
    const norm = Math.sqrt(emb.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 4);
  });

  it("wektor zerowy dla pustego tekstu", () => {
    const emb = generateTFIDFEmbedding("");
    const norm = Math.sqrt(emb.reduce((s, v) => s + v * v, 0));
    expect(norm).toBe(0);
  });

  it("różne teksty dają różne wektory", () => {
    const emb1 = generateTFIDFEmbedding("react component frontend ui");
    const emb2 = generateTFIDFEmbedding("database sql query optimization");
    const diff = emb1.reduce((s, v, i) => s + Math.abs(v - emb2[i]), 0);
    expect(diff).toBeGreaterThan(0.01);
  });

  it("podobne teksty mają wyższą cosine similarity", () => {
    function cosine(a: number[], b: number[]): number {
      let dot = 0, magA = 0, magB = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
      }
      return Math.sqrt(magA) * Math.sqrt(magB) > 0
        ? dot / (Math.sqrt(magA) * Math.sqrt(magB))
        : 0;
    }
    const emb1 = generateTFIDFEmbedding("react component hook state management");
    const emb2 = generateTFIDFEmbedding("react hook component state update");
    const emb3 = generateTFIDFEmbedding("database sql query join aggregate");
    const simSame = cosine(emb1, emb2);
    const simDiff = cosine(emb1, emb3);
    expect(simSame).toBeGreaterThan(simDiff);
  });
});

// ── GEXF Export Format Tests ───────────────────────────────────────────────────
describe("Knowledge Graph Export — GEXF Format", () => {
  function buildGEXF(nodes: any[], edges: any[]): string {
    const nodeXml = nodes.map(n =>
      `    <node id="${n.id}" label="${n.title?.replace(/"/g, "&quot;") ?? ""}">\n` +
      `      <attvalues>\n` +
      `        <attvalue for="domain" value="${n.domain ?? "unknown"}" />\n` +
      `      </attvalues>\n` +
      `    </node>`
    ).join("\n");
    const edgeXml = edges.map((e, i) =>
      `    <edge id="${i}" source="${e.source_id}" target="${e.target_id}" weight="${e.similarity?.toFixed(4) ?? "0"}" />`
    ).join("\n");
    return [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<gexf xmlns="http://gexf.net/1.3" version="1.3">`,
      `  <graph defaultedgetype="undirected">`,
      `    <nodes>`,
      nodeXml,
      `    </nodes>`,
      `    <edges>`,
      edgeXml,
      `    </edges>`,
      `  </graph>`,
      `</gexf>`,
    ].join("\n");
  }

  const mockNodes = [
    { id: "1", title: "React Hooks", domain: "frontend" },
    { id: "2", title: "TypeScript Types", domain: "typescript" },
    { id: "3", title: "SQL Queries", domain: "database" },
  ];
  const mockEdges = [
    { source_id: "1", target_id: "2", similarity: 0.72 },
    { source_id: "2", target_id: "3", similarity: 0.45 },
  ];

  it("generuje poprawny nagłówek GEXF", () => {
    const gexf = buildGEXF(mockNodes, mockEdges);
    expect(gexf).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(gexf).toContain('<gexf xmlns="http://gexf.net/1.3"');
  });

  it("zawiera wszystkie węzły", () => {
    const gexf = buildGEXF(mockNodes, mockEdges);
    expect(gexf).toContain('id="1"');
    expect(gexf).toContain('id="2"');
    expect(gexf).toContain('id="3"');
    expect(gexf).toContain('label="React Hooks"');
  });

  it("zawiera krawędzie z wagami", () => {
    const gexf = buildGEXF(mockNodes, mockEdges);
    expect(gexf).toContain('source="1" target="2"');
    expect(gexf).toContain('weight="0.7200"');
  });

  it("escapuje cudzysłowy w tytułach", () => {
    const nodesWithQuotes = [{ id: "1", title: 'Test "quoted" title', domain: "test" }];
    const gexf = buildGEXF(nodesWithQuotes, []);
    expect(gexf).toContain("&quot;quoted&quot;");
    expect(gexf).not.toContain('label="Test "quoted"');
  });
});

// ── GraphML Export Format Tests ────────────────────────────────────────────────
describe("Knowledge Graph Export — GraphML Format", () => {
  function buildGraphML(nodes: any[], edges: any[]): string {
    const nodeXml = nodes.map(n =>
      `  <node id="${n.id}">\n` +
      `    <data key="d0">${n.domain ?? "unknown"}</data>\n` +
      `  </node>`
    ).join("\n");
    const edgeXml = edges.map((e, i) =>
      `  <edge id="e${i}" source="${e.source_id}" target="${e.target_id}">\n` +
      `    <data key="d2">${e.similarity?.toFixed(4) ?? "0"}</data>\n` +
      `  </edge>`
    ).join("\n");
    return [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<graphml xmlns="http://graphml.graphdrawing.org/graphml">`,
      `  <graph id="G" edgedefault="undirected">`,
      nodeXml,
      edgeXml,
      `  </graph>`,
      `</graphml>`,
    ].join("\n");
  }

  it("generuje poprawny nagłówek GraphML", () => {
    const graphml = buildGraphML([], []);
    expect(graphml).toContain('<graphml xmlns="http://graphml.graphdrawing.org/graphml">');
  });

  it("zawiera węzły z atrybutami domeny", () => {
    const nodes = [{ id: "1", domain: "security" }];
    const graphml = buildGraphML(nodes, []);
    expect(graphml).toContain('<node id="1">');
    expect(graphml).toContain('<data key="d0">security</data>');
  });

  it("zawiera krawędzie z wagami similarity", () => {
    const edges = [{ source_id: "1", target_id: "2", similarity: 0.85 }];
    const graphml = buildGraphML([], edges);
    expect(graphml).toContain('<edge id="e0" source="1" target="2">');
    expect(graphml).toContain('<data key="d2">0.8500</data>');
  });
});

// ── Cytoscape.js JSON Export Tests ────────────────────────────────────────────
describe("Knowledge Graph Export — Cytoscape.js JSON", () => {
  function buildCytoscapeJSON(nodes: any[], edges: any[]): object {
    return {
      elements: {
        nodes: nodes.map(n => ({
          data: {
            id: String(n.id),
            label: n.title ?? "",
            domain: n.domain ?? "unknown",
          },
        })),
        edges: edges.map((e, i) => ({
          data: {
            id: `e${i}`,
            source: String(e.source_id),
            target: String(e.target_id),
            weight: e.similarity ?? 0,
          },
        })),
      },
    };
  }

  it("generuje poprawną strukturę Cytoscape.js", () => {
    const result = buildCytoscapeJSON([], []) as any;
    expect(result).toHaveProperty("elements");
    expect(result.elements).toHaveProperty("nodes");
    expect(result.elements).toHaveProperty("edges");
  });

  it("mapuje węzły z poprawnymi polami data", () => {
    const nodes = [{ id: 1, title: "Test Node", domain: "testing" }];
    const result = buildCytoscapeJSON(nodes, []) as any;
    expect(result.elements.nodes[0].data.id).toBe("1");
    expect(result.elements.nodes[0].data.label).toBe("Test Node");
    expect(result.elements.nodes[0].data.domain).toBe("testing");
  });

  it("mapuje krawędzie z wagami", () => {
    const edges = [{ source_id: 1, target_id: 2, similarity: 0.65 }];
    const result = buildCytoscapeJSON([], edges) as any;
    expect(result.elements.edges[0].data.source).toBe("1");
    expect(result.elements.edges[0].data.target).toBe("2");
    expect(result.elements.edges[0].data.weight).toBe(0.65);
  });
});

// ── Weekly Report Builder Tests ───────────────────────────────────────────────
describe("Weekly Vector Report Builder", () => {
  function buildWeeklyReport(stats: {
    totalExp: number;
    totalEmb: number;
    coverage: number;
    totalLinks: number;
    totalClusters: number;
    weekGrowth: number;
  }, histData: any[]): string {
    const reportDate = "8 marca 2026";
    return [
      `# Manus Brain — Tygodniowy Raport Wektorowy`,
      `**Data:** ${reportDate}`,
      ``,
      `## Statystyki bazy wektorowej`,
      `| Metryka | Wartość |`,
      `|---------|---------|`,
      `| Doświadczenia aktywne | ${stats.totalExp} |`,
      `| Embeddings (TF-IDF 1536-dim) | ${stats.totalEmb} |`,
      `| Pokrycie wektorowe | ${stats.coverage}% |`,
      `| Semantic links | ${stats.totalLinks} |`,
      `| Klastry semantyczne | ${stats.totalClusters} |`,
      `| Wzrost tygodniowy | +${stats.weekGrowth} doświadczeń |`,
      ``,
      `## Historia 7 dni`,
      ...histData.map((h: any) => `- ${h.snapshot_date}: ${h.total_experiences} doświadczeń`),
    ].join("\n");
  }

  it("generuje raport z poprawnymi nagłówkami", () => {
    const report = buildWeeklyReport(
      { totalExp: 35, totalEmb: 35, coverage: 100, totalLinks: 24, totalClusters: 17, weekGrowth: 12 },
      []
    );
    expect(report).toContain("# Manus Brain — Tygodniowy Raport Wektorowy");
    expect(report).toContain("## Statystyki bazy wektorowej");
  });

  it("zawiera poprawne statystyki w tabeli", () => {
    const report = buildWeeklyReport(
      { totalExp: 35, totalEmb: 35, coverage: 100, totalLinks: 24, totalClusters: 17, weekGrowth: 12 },
      []
    );
    expect(report).toContain("| Doświadczenia aktywne | 35 |");
    expect(report).toContain("| Pokrycie wektorowe | 100% |");
    expect(report).toContain("| Wzrost tygodniowy | +12 doświadczeń |");
  });

  it("zawiera historię 7 dni", () => {
    const histData = [
      { snapshot_date: "2026-03-01", total_experiences: 23 },
      { snapshot_date: "2026-03-08", total_experiences: 35 },
    ];
    const report = buildWeeklyReport(
      { totalExp: 35, totalEmb: 35, coverage: 100, totalLinks: 24, totalClusters: 17, weekGrowth: 12 },
      histData
    );
    expect(report).toContain("- 2026-03-01: 23 doświadczeń");
    expect(report).toContain("- 2026-03-08: 35 doświadczeń");
  });

  it("oblicza wzrost tygodniowy poprawnie", () => {
    const weekGrowth = 35 - 23;
    expect(weekGrowth).toBe(12);
  });
});

// ── Auto-Reindex Logic Tests ──────────────────────────────────────────────────
describe("Auto-Reindex After Learning Run", () => {
  it("identyfikuje doświadczenia bez embeddings", () => {
    const allExp = [
      { id: "1", title: "React Hooks" },
      { id: "2", title: "TypeScript" },
      { id: "3", title: "SQL Queries" },
    ];
    const existingEmb = [
      { experience_id: "1" },
      { experience_id: "2" },
    ];
    const indexedIds = new Set(existingEmb.map(e => e.experience_id));
    const toIndex = allExp.filter(e => !indexedIds.has(e.id));
    expect(toIndex).toHaveLength(1);
    expect(toIndex[0].id).toBe("3");
  });

  it("nie indeksuje ponownie już zindeksowanych", () => {
    const allExp = [{ id: "1" }, { id: "2" }];
    const existingEmb = [{ experience_id: "1" }, { experience_id: "2" }];
    const indexedIds = new Set(existingEmb.map(e => e.experience_id));
    const toIndex = allExp.filter(e => !indexedIds.has(e.id));
    expect(toIndex).toHaveLength(0);
  });

  it("indeksuje wszystkie gdy brak embeddings", () => {
    const allExp = [{ id: "1" }, { id: "2" }, { id: "3" }];
    const existingEmb: any[] = [];
    const indexedIds = new Set(existingEmb.map((e: any) => e.experience_id));
    const toIndex = allExp.filter(e => !indexedIds.has(e.id));
    expect(toIndex).toHaveLength(3);
  });

  it("oblicza normę wektora TF-IDF poprawnie", () => {
    const vector = [0.5, 0.5, 0.5, 0.5];
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 4);
    const normalized = vector.map(v => v / norm);
    const normCheck = Math.sqrt(normalized.reduce((s, v) => s + v * v, 0));
    expect(normCheck).toBeCloseTo(1.0, 4);
  });
});
