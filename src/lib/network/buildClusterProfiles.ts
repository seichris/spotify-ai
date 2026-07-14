import { GRAPH_CLUSTER_COLORS } from "@/lib/network/graphConfig";
import { hashHex } from "@/lib/network/hash";
import type { SongGraph } from "@/lib/network/buildGraph";
import type { ClusterProfile } from "@/types/network";

const titleCaseGenre = (genre: string) =>
  genre
    .split(" ")
    .map((word) =>
      word === "r&b" ? "R&B" : `${word.charAt(0).toUpperCase()}${word.slice(1)}`,
    )
    .join(" ");

const rankCounts = (counts: Map<string, number>) =>
  Array.from(counts.entries()).sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  );

export const applyCachedClusterProfiles = (
  graph: SongGraph,
  profiles: ClusterProfile[],
) => {
  const coveredNodes = new Set(profiles.flatMap((profile) => profile.nodeIds));
  if (
    coveredNodes.size !== graph.order ||
    graph.someNode((node) => !coveredNodes.has(node))
  ) {
    return false;
  }

  profiles.forEach((profile, profileIndex) => {
    profile.nodeIds.forEach((node) => {
      graph.mergeNodeAttributes(node, {
        clusterId: profile.id,
        color: profile.color,
      });
    });
    const labelNode = profile.representativeTrackIds[0];
    if (labelNode && profile.nodeIds.length >= 4 && profileIndex < 10) {
      graph.mergeNodeAttributes(labelNode, {
        forceLabel: true,
        label: profile.label,
      });
    }
  });
  return true;
};

export const buildClusterProfiles = (
  graph: SongGraph,
  genreIdf: Map<string, number>,
): ClusterProfile[] => {
  const communities = new Map<string, string[]>();

  graph.forEachNode((node, attributes) => {
    const community = attributes.clusterId ?? `orphan-${node}`;
    const nodes = communities.get(community);
    if (nodes) nodes.push(node);
    else communities.set(community, [node]);
  });

  const groups = Array.from(communities.values())
    .map((nodeIds) => nodeIds.sort())
    .sort(
      (left, right) =>
        right.length - left.length || left[0].localeCompare(right[0]),
    );

  return groups.map((nodeIds, clusterIndex) => {
    const nodeSet = new Set(nodeIds);
    const id = `cluster-${hashHex(nodeIds.join("|"))}`;
    const color = GRAPH_CLUSTER_COLORS[
      clusterIndex % GRAPH_CLUSTER_COLORS.length
    ];
    const genreCounts = new Map<string, number>();
    const artistCounts = new Map<string, number>();
    const artistNames = new Map<string, string>();
    const centrality = new Map(nodeIds.map((node) => [node, 0]));

    nodeIds.forEach((node) => {
      const attributes = graph.getNodeAttributes(node);
      attributes.genres.forEach((genre) => {
        genreCounts.set(
          genre,
          (genreCounts.get(genre) ?? 0) + (genreIdf.get(genre) ?? 1),
        );
      });
      attributes.artistIds.forEach((artistId, index) => {
        artistCounts.set(artistId, (artistCounts.get(artistId) ?? 0) + 1);
        artistNames.set(
          artistId,
          attributes.artistNames[index] ?? artistId,
        );
      });
      graph.forEachEdge(node, (_edge, edgeAttributes, source, target) => {
        const neighbor = source === node ? target : source;
        if (nodeSet.has(neighbor)) {
          centrality.set(node, (centrality.get(node) ?? 0) + edgeAttributes.weight);
        }
      });
    });

    const topGenres = rankCounts(genreCounts)
      .slice(0, 4)
      .map(([name, weight]) => ({
        name,
        weight: weight / Math.max(nodeIds.length, 1),
      }));
    const representativeArtistIds = rankCounts(artistCounts)
      .slice(0, 3)
      .map(([artistId]) => artistId);
    const representativeTrackIds = Array.from(centrality.entries())
      .sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
      )
      .slice(0, 3)
      .map(([node]) => node);
    const label =
      topGenres.length > 0
        ? topGenres
            .slice(0, 2)
            .map(({ name }) => titleCaseGenre(name))
            .join(" / ")
        : representativeArtistIds
            .slice(0, 2)
            .map((artistId) => artistNames.get(artistId) ?? artistId)
            .join(" / ") || "Unmapped Island";

    nodeIds.forEach((node) => {
      graph.mergeNodeAttributes(node, { clusterId: id, color });
    });

    if (
      representativeTrackIds[0] &&
      nodeIds.length >= 4 &&
      clusterIndex < 10
    ) {
      graph.mergeNodeAttributes(representativeTrackIds[0], {
        forceLabel: true,
        label,
      });
    }

    return {
      color,
      id,
      label,
      nodeIds,
      representativeArtistIds,
      representativeTrackIds,
      topGenres,
    };
  });
};
