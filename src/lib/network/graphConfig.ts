export const GRAPH_CACHE_SCHEMA_VERSION = 2;
export const GRAPH_MODEL_VERSION = "metadata-audio-v2";
export const GRAPH_LAYOUT_VERSION = "forceatlas2-v2";

export const GRAPH_SIMILARITY_WEIGHTS = {
  genre: 0.58,
  artist: 0.14,
  album: 0.08,
  tempo: 0.1,
  energy: 0.1,
} as const;

export const GRAPH_NEIGHBOR_CONFIG = {
  maxNeighbors: 8,
  maxSameArtistNeighbors: 2,
  minimumSimilarity: 0.08,
} as const;

export const DISCOVERY_EXPLORATION_CONFIG = {
  adventurous: { minimumSimilarity: 0.06 },
  balanced: { minimumSimilarity: GRAPH_NEIGHBOR_CONFIG.minimumSimilarity },
  familiar: { minimumSimilarity: 0.12 },
} as const;

export const GRAPH_LAYOUT_CONFIG = {
  iterations: 350,
  cachedIterations: 0,
  settings: {
    adjustSizes: false,
    barnesHutOptimize: true,
    barnesHutTheta: 0.5,
    edgeWeightInfluence: 1,
    gravity: 1,
    linLogMode: true,
    outboundAttractionDistribution: false,
    scalingRatio: 10,
    slowDown: 2,
    strongGravityMode: false,
  },
} as const;

export const GRAPH_COMMUNITY_CONFIG = {
  resolution: 1,
  seed: 0x5eed1234,
} as const;

export const GRAPH_CLUSTER_COLORS = [
  "#22c55e",
  "#a855f7",
  "#06b6d4",
  "#f97316",
  "#ec4899",
  "#eab308",
  "#3b82f6",
  "#14b8a6",
  "#f43f5e",
  "#8b5cf6",
  "#84cc16",
  "#0ea5e9",
] as const;
