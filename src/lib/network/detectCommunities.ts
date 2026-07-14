import louvain from "graphology-communities-louvain";
import {
  GRAPH_COMMUNITY_CONFIG,
} from "@/lib/network/graphConfig";
import { createSeededRandom } from "@/lib/network/hash";
import type { SongGraph } from "@/lib/network/buildGraph";

export const detectCommunities = (graph: SongGraph) => {
  if (graph.order === 0) return;

  if (graph.size === 0) {
    let index = 0;
    graph.forEachNode((node) => {
      graph.setNodeAttribute(node, "clusterId", `community-${index}`);
      index += 1;
    });
    return;
  }

  louvain.assign(graph, {
    getEdgeWeight: "weight",
    nodeCommunityAttribute: "clusterId",
    randomWalk: true,
    resolution: GRAPH_COMMUNITY_CONFIG.resolution,
    rng: createSeededRandom(GRAPH_COMMUNITY_CONFIG.seed),
  });

  graph.forEachNode((node, attributes) => {
    graph.setNodeAttribute(node, "clusterId", `community-${attributes.clusterId}`);
  });
};
