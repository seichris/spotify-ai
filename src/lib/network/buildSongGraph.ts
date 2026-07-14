import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";
import { buildClusterProfiles, applyCachedClusterProfiles } from "@/lib/network/buildClusterProfiles";
import { buildSongGraph as constructSongGraph } from "@/lib/network/buildGraph";
import { detectCommunities } from "@/lib/network/detectCommunities";
import {
  GRAPH_CACHE_SCHEMA_VERSION,
  GRAPH_LAYOUT_VERSION,
  GRAPH_MODEL_VERSION,
} from "@/lib/network/graphConfig";
import {
  createLibraryFingerprint,
  isGraphCacheValid,
} from "@/lib/network/graphCache";
import { layoutSongGraph } from "@/lib/network/layoutGraph";
import type {
  GraphCachePayload,
  SongGraphBuildResult,
  SongGraphBuildStage,
} from "@/types/network";

export type GraphBuildProgress = (
  stage: SongGraphBuildStage,
  progress: number,
) => void;

export const buildSongGraph = (
  tracks: EnrichedTrack[],
  cachedGraph: GraphCachePayload | null,
  reportProgress: GraphBuildProgress = () => undefined,
): SongGraphBuildResult => {
  reportProgress("normalizing", 8);
  const libraryFingerprint = createLibraryFingerprint(tracks);
  reportProgress("relationships", 18);
  const construction = constructSongGraph(tracks);

  reportProgress("relationships", 48);
  const validCache =
    cachedGraph && isGraphCacheValid(cachedGraph, libraryFingerprint)
      ? cachedGraph
      : null;
  let clusters = validCache?.clusters ?? [];
  const usedCachedClusters =
    validCache !== null &&
    applyCachedClusterProfiles(construction.graph, clusters);

  if (!usedCachedClusters) {
    detectCommunities(construction.graph);
    clusters = buildClusterProfiles(construction.graph, construction.genreIdf);
  }

  reportProgress("communities", 62);
  const layout = layoutSongGraph(
    construction.graph,
    validCache?.positions,
  );
  reportProgress("layout", 94);

  const cache: GraphCachePayload = {
    cacheSchemaVersion: GRAPH_CACHE_SCHEMA_VERSION,
    clusters,
    createdAt: Date.now(),
    layoutVersion: GRAPH_LAYOUT_VERSION,
    libraryFingerprint,
    modelVersion: GRAPH_MODEL_VERSION,
    positions: layout.positions,
  };
  const isolatedNodeCount = construction.graph.filterNodes(
    (node) => construction.graph.degree(node) === 0,
  ).length;
  const sameArtistEdgeCount = construction.graph.filterEdges(
    (_edge, attributes) => attributes.evidence.artist > 0,
  ).length;

  reportProgress("ready", 100);
  return {
    cache,
    clusters,
    graph: construction.graph.export(),
    stats: {
      cacheHit: layout.cacheHit && usedCachedClusters,
      candidatePairs: construction.candidatePairCount,
      clusterCount: clusters.length,
      edgeCount: construction.graph.size,
      isolatedNodeCount,
      neighborhoodCount: clusters.filter((cluster) => cluster.nodeIds.length > 1)
        .length,
      nodeCount: construction.graph.order,
      sameArtistEdgeCount,
    },
  };
};
