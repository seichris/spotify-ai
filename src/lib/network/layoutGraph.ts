import forceAtlas2 from "graphology-layout-forceatlas2";
import noverlap from "graphology-layout-noverlap";
import {
  GRAPH_LAYOUT_CONFIG,
  GRAPH_NOVERLAP_CONFIG,
} from "@/lib/network/graphConfig";
import { hashUnit } from "@/lib/network/hash";
import type { SongGraph } from "@/lib/network/buildGraph";

export interface LayoutResult {
  cacheHit: boolean;
  positions: Record<string, { x: number; y: number }>;
}

const isFinitePosition = (position?: { x: number; y: number }) =>
  Boolean(
    position && Number.isFinite(position.x) && Number.isFinite(position.y),
  );

const cacheCoversGraph = (
  graph: SongGraph,
  positions?: Record<string, { x: number; y: number }>,
) =>
  Boolean(
    positions &&
      Object.keys(positions).length === graph.order &&
      graph.everyNode((node) => isFinitePosition(positions[node])),
  );

const placeIsolates = (graph: SongGraph) => {
  const isolates = graph.filterNodes((node) => graph.degree(node) === 0).sort();
  if (isolates.length === 0) return;

  const connectedNodes = graph.filterNodes((node) => graph.degree(node) > 0);
  const connectedRadius = connectedNodes.reduce((maximum, node) => {
    const { x, y } = graph.getNodeAttributes(node);
    return Math.max(maximum, Math.hypot(x, y));
  }, 8);
  const radius = Math.max(connectedRadius * 1.18, 12);

  isolates.forEach((node, index) => {
    const baseAngle = (Math.PI * 2 * index) / isolates.length;
    const offset = (hashUnit(`${node}:isolate`) - 0.5) * 0.12;
    graph.mergeNodeAttributes(node, {
      x: Math.cos(baseAngle + offset) * radius,
      y: Math.sin(baseAngle + offset) * radius,
    });
  });
};

const ensureFinitePositions = (graph: SongGraph) => {
  graph.forEachNode((node, attributes) => {
    if (Number.isFinite(attributes.x) && Number.isFinite(attributes.y)) return;
    const angle = hashUnit(`${node}:layout-fallback`) * Math.PI * 2;
    graph.mergeNodeAttributes(node, {
      x: Math.cos(angle) * 5,
      y: Math.sin(angle) * 5,
    });
  });
};

const seedCommunityPositions = (graph: SongGraph) => {
  const communities = new Map<string, string[]>();
  graph.forEachNode((node, attributes) => {
    if (graph.degree(node) === 0) return;
    const clusterId = attributes.clusterId ?? `orphan-${node}`;
    const nodes = communities.get(clusterId);
    if (nodes) nodes.push(node);
    else communities.set(clusterId, [node]);
  });

  Array.from(communities.entries())
    .sort(
      (left, right) =>
        right[1].length - left[1].length || left[0].localeCompare(right[0]),
    )
    .forEach(([clusterId, nodes], clusterIndex) => {
      const clusterAngle = clusterIndex * Math.PI * (3 - Math.sqrt(5));
      const clusterRadius = Math.sqrt(clusterIndex) * 18;
      const centerX = Math.cos(clusterAngle) * clusterRadius;
      const centerY = Math.sin(clusterAngle) * clusterRadius;
      nodes.sort().forEach((node, nodeIndex) => {
        const angle =
          hashUnit(`${clusterId}:${node}:angle`) * Math.PI * 2 + nodeIndex;
        const radius = 1.5 + Math.sqrt(nodeIndex) * 1.4;
        graph.mergeNodeAttributes(node, {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
        });
      });
    });
};

const readPositions = (graph: SongGraph) => {
  const positions: Record<string, { x: number; y: number }> = {};
  graph.forEachNode((node, attributes) => {
    positions[node] = { x: attributes.x, y: attributes.y };
  });
  return positions;
};

export const layoutSongGraph = (
  graph: SongGraph,
  cachedPositions?: Record<string, { x: number; y: number }>,
): LayoutResult => {
  if (cacheCoversGraph(graph, cachedPositions)) {
    graph.forEachNode((node) => {
      graph.mergeNodeAttributes(node, cachedPositions?.[node] ?? { x: 0, y: 0 });
    });
    return { cacheHit: true, positions: readPositions(graph) };
  }

  if (graph.order > 1 && graph.size > 0) {
    seedCommunityPositions(graph);
    forceAtlas2.assign(graph, {
      iterations: GRAPH_LAYOUT_CONFIG.iterations,
      settings: GRAPH_LAYOUT_CONFIG.settings,
    });
  }

  ensureFinitePositions(graph);
  placeIsolates(graph);
  if (graph.order > 1) {
    noverlap.assign(graph, GRAPH_NOVERLAP_CONFIG);
  }
  return { cacheHit: false, positions: readPositions(graph) };
};
