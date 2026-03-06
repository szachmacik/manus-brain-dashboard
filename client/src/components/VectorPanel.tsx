/**
 * Manus Brain — Vector Panel
 * Wizualizacja bazy wektorowej: knowledge graph, semantic search, klastry
 * Używa D3-force dla grafu i TF-IDF embeddings
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Search, Brain, Network, Layers, RefreshCw, Zap, Target, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

// ─── DOMAIN COLORS ───────────────────────────────────────────────────────────
const DOMAIN_COLORS: Record<string, string> = {
  supabase: "#3ECF8E",
  react: "#61DAFB",
  tailwind: "#38BDF8",
  manus: "#10b981",
  openai: "#74AA9C",
  github: "#F0F6FF",
  security: "#EF4444",
  optimization: "#F59E0B",
  backend: "#8B5CF6",
  frontend: "#EC4899",
  devops: "#6366F1",
  "google-drive": "#4285F4",
  ai: "#A78BFA",
  vercel: "#FFFFFF",
  unknown: "#6B7280",
};

function getDomainColor(domain: string): string {
  return DOMAIN_COLORS[domain] ?? DOMAIN_COLORS.unknown;
}

// ─── FORCE GRAPH ─────────────────────────────────────────────────────────────
interface GraphNode {
  id: string;
  sourceId: string;
  label: string;
  domain: string;
  category: string;
  confidence: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  similarity: number;
  type: string;
}

function ForceGraph({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [simNodes, setSimNodes] = useState<GraphNode[]>([]);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const frameRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);

  useEffect(() => {
    if (nodes.length === 0) return;

    // Inicjalizuj pozycje losowo w okręgu
    const W = 600, H = 400;
    const initialized = nodes.map((n, i) => ({
      ...n,
      x: W / 2 + Math.cos((i / nodes.length) * Math.PI * 2) * 150 + (Math.random() - 0.5) * 50,
      y: H / 2 + Math.sin((i / nodes.length) * Math.PI * 2) * 150 + (Math.random() - 0.5) * 50,
      vx: 0,
      vy: 0,
    }));
    nodesRef.current = initialized;
    setSimNodes([...initialized]);

    // Force simulation
    const edgeMap = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!edgeMap.has(e.source)) edgeMap.set(e.source, new Set());
      if (!edgeMap.has(e.target)) edgeMap.set(e.target, new Set());
      edgeMap.get(e.source)!.add(e.target);
      edgeMap.get(e.target)!.add(e.source);
    }

    let iteration = 0;
    const MAX_ITER = 200;
    const alpha = 0.3;

    function tick() {
      if (iteration >= MAX_ITER) return;
      iteration++;

      const ns = nodesRef.current;
      const cooling = 1 - iteration / MAX_ITER;

      // Repulsion between all nodes
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = (ns[j].x ?? 0) - (ns[i].x ?? 0);
          const dy = (ns[j].y ?? 0) - (ns[i].y ?? 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (50 * 50) / dist;
          const fx = (dx / dist) * force * 0.1;
          const fy = (dy / dist) * force * 0.1;
          ns[i].vx = ((ns[i].vx ?? 0) - fx) * 0.9;
          ns[i].vy = ((ns[i].vy ?? 0) - fy) * 0.9;
          ns[j].vx = ((ns[j].vx ?? 0) + fx) * 0.9;
          ns[j].vy = ((ns[j].vy ?? 0) + fy) * 0.9;
        }
      }

      // Attraction for connected nodes
      for (const edge of edges) {
        const srcNode = ns.find((n) => n.id === edge.source);
        const tgtNode = ns.find((n) => n.id === edge.target);
        if (!srcNode || !tgtNode) continue;

        const dx = (tgtNode.x ?? 0) - (srcNode.x ?? 0);
        const dy = (tgtNode.y ?? 0) - (srcNode.y ?? 0);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDist = 80 + (1 - edge.similarity) * 100;
        const force = (dist - targetDist) * 0.05 * edge.similarity;

        srcNode.vx = ((srcNode.vx ?? 0) + (dx / dist) * force) * 0.9;
        srcNode.vy = ((srcNode.vy ?? 0) + (dy / dist) * force) * 0.9;
        tgtNode.vx = ((tgtNode.vx ?? 0) - (dx / dist) * force) * 0.9;
        tgtNode.vy = ((tgtNode.vy ?? 0) - (dy / dist) * force) * 0.9;
      }

      // Center gravity
      for (const n of ns) {
        n.vx = ((n.vx ?? 0) + (W / 2 - (n.x ?? 0)) * 0.01) * 0.9;
        n.vy = ((n.vy ?? 0) + (H / 2 - (n.y ?? 0)) * 0.01) * 0.9;
      }

      // Update positions
      for (const n of ns) {
        n.x = Math.max(20, Math.min(W - 20, (n.x ?? 0) + (n.vx ?? 0) * cooling));
        n.y = Math.max(20, Math.min(H - 20, (n.y ?? 0) + (n.vy ?? 0) * cooling));
      }

      nodesRef.current = [...ns];
      if (iteration % 5 === 0) setSimNodes([...ns]);

      frameRef.current = requestAnimationFrame(() => tick());
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [nodes, edges]);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[#6b7280]">
        <div className="text-center">
          <Network className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Brak danych grafu</p>
        </div>
      </div>
    );
  }

  const W = 600, H = 400;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-lg bg-[#0a0a0a] border border-[#1a1a1a]"
        style={{ height: "300px" }}
      >
        {/* Edges */}
        {edges.map((edge, i) => {
          const src = simNodes.find((n) => n.id === edge.source);
          const tgt = simNodes.find((n) => n.id === edge.target);
          if (!src || !tgt) return null;
          const opacity = 0.2 + edge.similarity * 0.6;
          return (
            <line
              key={i}
              x1={src.x}
              y1={src.y}
              x2={tgt.x}
              y2={tgt.y}
              stroke="#10b981"
              strokeWidth={edge.similarity * 2}
              strokeOpacity={opacity}
            />
          );
        })}

        {/* Nodes */}
        {simNodes.map((node) => {
          const color = getDomainColor(node.domain);
          const isHovered = hoveredNode?.id === node.id;
          const r = 6 + (node.confidence / 100) * 4;
          return (
            <g key={node.id}>
              {/* Glow effect */}
              {isHovered && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r + 8}
                  fill={color}
                  fillOpacity={0.15}
                />
              )}
              <circle
                cx={node.x}
                cy={node.y}
                r={r}
                fill={color}
                fillOpacity={0.8}
                stroke={isHovered ? color : "#1a1a1a"}
                strokeWidth={isHovered ? 2 : 1}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
              />
              {/* Label for hovered */}
              {isHovered && (
                <text
                  x={(node.x ?? 0) + 12}
                  y={(node.y ?? 0) + 4}
                  fill="white"
                  fontSize="10"
                  className="pointer-events-none"
                  style={{ textShadow: "0 0 4px black" }}
                >
                  {node.label.substring(0, 30)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-2">
        {Object.entries(DOMAIN_COLORS).slice(0, 8).map(([domain, color]) => (
          <div key={domain} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-[#6b7280]">{domain}</span>
          </div>
        ))}
      </div>

      {/* Hover tooltip */}
      {hoveredNode && (
        <div className="absolute top-2 left-2 bg-[#111] border border-[#10b981]/30 rounded-lg p-3 max-w-xs z-10">
          <p className="text-sm font-medium text-white">{hoveredNode.label}</p>
          <div className="flex gap-2 mt-1">
            <Badge variant="outline" className="text-xs border-[#10b981]/30 text-[#10b981]">
              {hoveredNode.domain}
            </Badge>
            <Badge variant="outline" className="text-xs border-[#6b7280]/30 text-[#9ca3af]">
              {hoveredNode.category}
            </Badge>
          </div>
          <p className="text-xs text-[#6b7280] mt-1">
            Confidence: {hoveredNode.confidence}%
          </p>
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function VectorPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"graph" | "search" | "clusters" | "coverage">("graph");

  const statsQuery = trpc.vector.stats.useQuery();
  const graphQuery = trpc.vector.knowledgeGraph.useQuery();
  const clustersQuery = trpc.vector.clusters.useQuery();
  const coverageQuery = trpc.vector.coverage.useQuery();
  const searchQuery2 = trpc.vector.semanticSearch.useQuery(
    { query: activeSearch, limit: 8, threshold: 0.05 },
    { enabled: activeSearch.length > 2 }
  );
  const indexMutation = trpc.vector.indexNew.useMutation({
    onSuccess: () => {
      statsQuery.refetch();
      graphQuery.refetch();
    },
  });

  const handleSearch = useCallback(() => {
    if (searchQuery.trim().length > 2) {
      setActiveSearch(searchQuery.trim());
      setActiveTab("search");
    }
  }, [searchQuery]);

  const stats = statsQuery.data;
  const graph = graphQuery.data;
  const clusters = clustersQuery.data ?? [];
  const coverage = coverageQuery.data;
  const searchResults = searchQuery2.data;

  const tabs = [
    { id: "graph" as const, label: "Knowledge Graph", icon: Network },
    { id: "search" as const, label: "Semantic Search", icon: Search },
    { id: "clusters" as const, label: "Klastry", icon: Layers },
    { id: "coverage" as const, label: "Pokrycie", icon: Target },
  ];

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Embeddings", value: stats?.embeddings ?? 0, icon: Brain, color: "#10b981" },
          { label: "Semantic Links", value: stats?.links ?? 0, icon: GitBranch, color: "#8b5cf6" },
          { label: "Klastry", value: stats?.clusters ?? 0, icon: Layers, color: "#f59e0b" },
          { label: "Pokrycie", value: `${stats?.coverage ?? 0}%`, icon: Target, color: "#3b82f6" },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
              <span className="text-xs text-[#6b7280]">{stat.label}</span>
            </div>
            <div className="text-2xl font-bold text-white font-mono">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Search Bar */}
      <div className="flex gap-2">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Szukaj semantycznie... (np. 'optymalizacja kredytów', 'React hooks')"
          className="bg-[#0d0d0d] border-[#1a1a1a] text-white placeholder:text-[#4b5563] focus:border-[#10b981]"
        />
        <Button
          onClick={handleSearch}
          className="bg-[#10b981] hover:bg-[#059669] text-black font-semibold"
          disabled={searchQuery.length < 3}
        >
          <Search className="w-4 h-4" />
        </Button>
        <Button
          onClick={() => indexMutation.mutate()}
          variant="outline"
          className="border-[#1a1a1a] text-[#9ca3af] hover:border-[#10b981] hover:text-[#10b981]"
          disabled={indexMutation.isPending}
          title="Re-indeksuj nowe doświadczenia"
        >
          <RefreshCw className={`w-4 h-4 ${indexMutation.isPending ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0a0a0a] rounded-lg p-1 border border-[#1a1a1a]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all ${
              activeTab === tab.id
                ? "bg-[#10b981] text-black font-semibold"
                : "text-[#6b7280] hover:text-white"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "graph" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#9ca3af]">
              Graf wiedzy — {graph?.nodes.length ?? 0} węzłów, {graph?.edges.length ?? 0} krawędzi
            </h3>
            <Badge variant="outline" className="text-xs border-[#10b981]/30 text-[#10b981]">
              <Zap className="w-3 h-3 mr-1" />
              Live simulation
            </Badge>
          </div>
          {graphQuery.isLoading ? (
            <div className="h-64 flex items-center justify-center text-[#6b7280]">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              Ładowanie grafu...
            </div>
          ) : (
            <ForceGraph
              nodes={graph?.nodes ?? []}
              edges={graph?.edges ?? []}
            />
          )}
        </div>
      )}

      {activeTab === "search" && (
        <div className="space-y-3">
          {!activeSearch ? (
            <div className="text-center py-8 text-[#6b7280]">
              <Search className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Wpisz zapytanie i naciśnij Enter lub kliknij szukaj</p>
              <p className="text-xs mt-1">Przykłady: "optymalizacja API", "React hooks", "bezpieczeństwo"</p>
            </div>
          ) : searchQuery2.isLoading ? (
            <div className="text-center py-8 text-[#6b7280]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Szukam semantycznie...
            </div>
          ) : (
            <>
              <div className="text-sm text-[#6b7280]">
                Wyniki dla: <span className="text-[#10b981] font-medium">"{activeSearch}"</span>
                {" "}— {searchResults?.totalFound ?? 0} dopasowań
              </div>
              {(searchResults?.results ?? []).length === 0 ? (
                <div className="text-center py-6 text-[#6b7280]">
                  <p>Brak wyników. Spróbuj innych słów kluczowych.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(searchResults?.results ?? []).map((result) => (
                    <div
                      key={result.id}
                      className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4 hover:border-[#10b981]/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{result.title}</p>
                          <p className="text-xs text-[#6b7280] mt-1 line-clamp-2">{result.summary}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            <Badge
                              variant="outline"
                              className="text-xs border-[#1a1a1a] text-[#9ca3af]"
                              style={{ borderColor: getDomainColor(result.domain) + "40" }}
                            >
                              {result.domain}
                            </Badge>
                            {(result.tags ?? []).slice(0, 3).map((tag: string) => (
                              <Badge key={tag} variant="outline" className="text-xs border-[#1a1a1a] text-[#6b7280]">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div
                            className="text-lg font-bold font-mono"
                            style={{ color: result.similarity > 0.3 ? "#10b981" : result.similarity > 0.15 ? "#f59e0b" : "#6b7280" }}
                          >
                            {Math.round(result.similarity * 100)}%
                          </div>
                          <div className="text-xs text-[#6b7280]">match</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "clusters" && (
        <div className="space-y-2">
          {clustersQuery.isLoading ? (
            <div className="text-center py-8 text-[#6b7280]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto" />
            </div>
          ) : clusters.length === 0 ? (
            <div className="text-center py-8 text-[#6b7280]">
              <Layers className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Brak klastrów. Uruchom indeksowanie.</p>
            </div>
          ) : (
            clusters.map((cluster: any) => (
              <div
                key={cluster.id}
                className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4 hover:border-[#10b981]/20 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getDomainColor(cluster.name) }}
                    />
                    <div>
                      <p className="text-sm font-semibold text-white capitalize">{cluster.name}</p>
                      <p className="text-xs text-[#6b7280]">{cluster.description}</p>
                    </div>
                  </div>
                  <Badge className="bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20">
                    {cluster.member_count} exp.
                  </Badge>
                </div>
                {(cluster.keywords ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(cluster.keywords ?? []).slice(0, 6).map((kw: string) => (
                      <span key={kw} className="text-xs text-[#4b5563] bg-[#111] rounded px-1.5 py-0.5">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "coverage" && (
        <div className="space-y-4">
          {/* Overall coverage */}
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[#9ca3af]">Ogólne pokrycie bazy</span>
              <span className="text-lg font-bold text-[#10b981] font-mono">
                {coverage?.percentage ?? 0}%
              </span>
            </div>
            <Progress value={coverage?.percentage ?? 0} className="h-2 bg-[#1a1a1a]" />
            <p className="text-xs text-[#6b7280] mt-2">
              {coverage?.indexed ?? 0} z {coverage?.total ?? 0} doświadczeń ma embeddings
            </p>
          </div>

          {/* Per domain */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider">Pokrycie per domena</h4>
            {(coverage?.byDomain ?? []).map((d: any) => (
              <div key={d.domain} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getDomainColor(d.domain) }}
                    />
                    <span className="text-sm text-white capitalize">{d.domain}</span>
                  </div>
                  <span className="text-sm font-mono" style={{ color: d.percentage === 100 ? "#10b981" : "#f59e0b" }}>
                    {d.indexed}/{d.total}
                  </span>
                </div>
                <Progress value={d.percentage} className="h-1 bg-[#1a1a1a]" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
