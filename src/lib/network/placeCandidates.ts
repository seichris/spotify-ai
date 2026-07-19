import type { SongGraph } from "@/lib/network/buildGraph";
import { GRAPH_NOVERLAP_CONFIG } from "@/lib/network/graphConfig";
import { hashUnit } from "@/lib/network/hash";
import type { DiscoveryCandidate } from "@/types/network";

interface OccupiedPosition {
  size: number;
  x: number;
  y: number;
}

const CANDIDATE_PLACEMENT_RINGS = 12;
const CANDIDATE_PLACEMENT_SPOKES = 16;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const COLLISION_MARGIN = GRAPH_NOVERLAP_CONFIG.settings.margin;
const COLLISION_RATIO = GRAPH_NOVERLAP_CONFIG.settings.ratio;

const collidesWithOccupiedNode = (
  occupied: OccupiedPosition[],
  position: OccupiedPosition,
) =>
  occupied.some((node) => {
    const minimumDistance =
      position.size * COLLISION_RATIO +
      COLLISION_MARGIN +
      (node.size * COLLISION_RATIO + COLLISION_MARGIN);
    return Math.hypot(position.x - node.x, position.y - node.y) < minimumDistance;
  });

const findAvailablePosition = (
  occupied: OccupiedPosition[],
  center: { x: number; y: number },
  preferredAngle: number,
  preferredOffset: number,
  size: number,
) => {
  const scaledRadius = size * COLLISION_RATIO + COLLISION_MARGIN;
  const initialRadius = Math.max(preferredOffset, scaledRadius);

  for (let ring = 0; ring < CANDIDATE_PLACEMENT_RINGS; ring += 1) {
    const radius = initialRadius + ring * scaledRadius;
    const ringRotation = preferredAngle + ring * GOLDEN_ANGLE;
    for (let spoke = 0; spoke < CANDIDATE_PLACEMENT_SPOKES; spoke += 1) {
      const angle =
        ringRotation + (spoke * Math.PI * 2) / CANDIDATE_PLACEMENT_SPOKES;
      const position = {
        size,
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      };
      if (!collidesWithOccupiedNode(occupied, position)) return position;
    }
  }

  const escapeRadius = occupied.reduce((maximum, node) => {
    const requiredDistance =
      Math.hypot(node.x - center.x, node.y - center.y) +
      scaledRadius +
      node.size * COLLISION_RATIO +
      COLLISION_MARGIN;
    return Math.max(maximum, requiredDistance);
  }, initialRadius);
  return {
    size,
    x: center.x + Math.cos(preferredAngle) * escapeRadius,
    y: center.y + Math.sin(preferredAngle) * escapeRadius,
  };
};

export const placeCandidates = (
  baseGraph: SongGraph,
  candidates: DiscoveryCandidate[],
): SongGraph => {
  if (candidates.every((candidate) => !candidate.mapped)) return baseGraph;

  const graph = baseGraph.copy();
  const occupied = graph.mapNodes((_node, attributes) => ({
    size: attributes.size,
    x: attributes.x,
    y: attributes.y,
  }));
  candidates
    .filter((candidate) => candidate.mapped && candidate.anchors.length > 0)
    .forEach((candidate, candidateIndex) => {
      if (graph.hasNode(candidate.track.id)) return;
      const usableAnchors = candidate.anchors.filter((anchor) =>
        graph.hasNode(anchor.trackId),
      );
      if (usableAnchors.length === 0) return;
      const totalWeight = usableAnchors.reduce(
        (total, anchor) => total + anchor.score,
        0,
      );
      const center = usableAnchors.reduce(
        (position, anchor) => {
          const attributes = graph.getNodeAttributes(anchor.trackId);
          const weight = anchor.score / Math.max(totalWeight, Number.EPSILON);
          return {
            x: position.x + attributes.x * weight,
            y: position.y + attributes.y * weight,
          };
        },
        { x: 0, y: 0 },
      );
      const angle = hashUnit(`${candidate.track.id}:candidate`) * Math.PI * 2;
      const offset = 2.4 + candidateIndex * 0.45;
      const strongestAnchor = usableAnchors[0];
      const anchorAttributes = graph.getNodeAttributes(strongestAnchor.trackId);
      const isSaved = candidate.status === "saved";
      const size = isSaved ? 6 : 8;
      const position = findAvailablePosition(
        occupied,
        center,
        angle,
        offset,
        size,
      );

      graph.addNode(candidate.track.id, {
        albumId: candidate.track.album.id,
        albumName: candidate.track.album.name,
        artistIds: candidate.track.artists.map((artist) => artist.id),
        artistNames: candidate.track.artists.map((artist) => artist.name),
        candidateStatus: candidate.status,
        clusterId: anchorAttributes.clusterId,
        color: isSaved ? anchorAttributes.color : "#facc15",
        genres: candidate.track.genres,
        image:
          candidate.track.album.images[1]?.url ??
          candidate.track.album.images[0]?.url ??
          candidate.track.album.images[2]?.url,
        kind: isSaved ? "liked" : "candidate",
        label: candidate.track.name,
        recommendationId: candidate.recommendationId,
        size,
        type: "image",
        uri: candidate.track.uri,
        x: position.x,
        y: position.y,
      });
      occupied.push(position);

      usableAnchors.forEach((anchor) => {
        graph.addEdgeWithKey(
          `candidate:${candidate.track.id}:${anchor.trackId}`,
          candidate.track.id,
          anchor.trackId,
          {
            color: "#facc15",
            evidence: anchor.evidence,
            hidden: false,
            size: 0.8 + anchor.score * 1.8,
            weight: anchor.score,
          },
        );
      });
    });

  return graph;
};
