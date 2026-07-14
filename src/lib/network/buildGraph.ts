import Graph from "graphology";
import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";
import { buildFeatures, type SongFeature } from "@/lib/network/buildFeatures";
import { calculateSimilarity } from "@/lib/network/calculateSimilarity";
import {
  GRAPH_NEIGHBOR_CONFIG,
} from "@/lib/network/graphConfig";
import { hashUnit } from "@/lib/network/hash";
import type {
  SongGraphEdgeAttributes,
  SongGraphNodeAttributes,
} from "@/types/network";

export type SongGraph = Graph<
  SongGraphNodeAttributes,
  SongGraphEdgeAttributes
>;

interface RankedNeighbor {
  neighborId: string;
  score: number;
  sharedArtist: boolean;
  evidence: SongGraphEdgeAttributes["evidence"];
}

export interface SongGraphConstruction {
  candidatePairCount: number;
  genreIdf: Map<string, number>;
  graph: SongGraph;
}

const PAIR_SEPARATOR = "\u0000";
const CROSS_ARTIST_NEAR_TIE = 0.03;

const pairKey = (left: string, right: string) =>
  left < right
    ? `${left}${PAIR_SEPARATOR}${right}`
    : `${right}${PAIR_SEPARATOR}${left}`;

const splitPairKey = (key: string) =>
  key.split(PAIR_SEPARATOR) as [string, string];

const getImageUrl = (track: EnrichedTrack) =>
  track.album.images[1]?.url ??
  track.album.images[0]?.url ??
  track.album.images[2]?.url;

const addToIndex = (
  index: Map<string, string[]>,
  key: string,
  trackId: string,
) => {
  if (!key) return;
  const values = index.get(key);
  if (values) values.push(trackId);
  else index.set(key, [trackId]);
};

const addIndexPairs = (
  index: Map<string, string[]>,
  candidatePairs: Set<string>,
) => {
  index.forEach((trackIds) => {
    for (let left = 0; left < trackIds.length; left += 1) {
      for (let right = left + 1; right < trackIds.length; right += 1) {
        candidatePairs.add(pairKey(trackIds[left], trackIds[right]));
      }
    }
  });
};

const compareNeighbors = (left: RankedNeighbor, right: RankedNeighbor) => {
  if (
    left.sharedArtist !== right.sharedArtist &&
    Math.abs(left.score - right.score) <= CROSS_ARTIST_NEAR_TIE
  ) {
    return left.sharedArtist ? 1 : -1;
  }

  return right.score - left.score || left.neighborId.localeCompare(right.neighborId);
};

const chooseNeighbors = (ranked: RankedNeighbor[]) => {
  const selected = new Set<string>();
  let sameArtistCount = 0;

  for (const candidate of ranked) {
    if (selected.size >= GRAPH_NEIGHBOR_CONFIG.maxNeighbors) break;
    if (
      candidate.sharedArtist &&
      sameArtistCount >= GRAPH_NEIGHBOR_CONFIG.maxSameArtistNeighbors
    ) {
      continue;
    }

    selected.add(candidate.neighborId);
    if (candidate.sharedArtist) sameArtistCount += 1;
  }

  return selected;
};

const createNodeAttributes = (
  feature: SongFeature,
): SongGraphNodeAttributes => {
  const angle = hashUnit(`${feature.track.id}:angle`) * Math.PI * 2;
  const radius = 1 + Math.sqrt(hashUnit(`${feature.track.id}:radius`)) * 4;

  return {
    albumId: feature.albumId,
    albumName: feature.track.album.name,
    artistIds: feature.artistIds,
    artistNames: feature.track.artists.map((artist) => artist.name),
    color: "#71717a",
    genres: feature.genres,
    image: getImageUrl(feature.track),
    kind: "liked",
    label: feature.track.name,
    size: 6,
    type: "image",
    uri: feature.track.uri,
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
};

export const buildSongGraph = (
  tracks: EnrichedTrack[],
): SongGraphConstruction => {
  const { features, genreIdf } = buildFeatures(tracks);
  const graph: SongGraph = new Graph({ type: "undirected" });
  const featuresById = new Map(
    features.map((feature) => [feature.track.id, feature]),
  );
  const genreIndex = new Map<string, string[]>();
  const artistIndex = new Map<string, string[]>();
  const albumIndex = new Map<string, string[]>();
  const candidatePairs = new Set<string>();

  features.forEach((feature) => {
    graph.addNode(feature.track.id, createNodeAttributes(feature));
    feature.genres.forEach((genre) =>
      addToIndex(genreIndex, genre, feature.track.id),
    );
    feature.artistIds.forEach((artistId) =>
      addToIndex(artistIndex, artistId, feature.track.id),
    );
    addToIndex(albumIndex, feature.albumId, feature.track.id);
  });

  addIndexPairs(genreIndex, candidatePairs);
  addIndexPairs(artistIndex, candidatePairs);
  addIndexPairs(albumIndex, candidatePairs);

  const rankedByTrack = new Map<string, RankedNeighbor[]>(
    features.map((feature) => [feature.track.id, []]),
  );
  const pairResults = new Map<string, RankedNeighbor>();

  candidatePairs.forEach((key) => {
    const [leftId, rightId] = splitPairKey(key);
    const left = featuresById.get(leftId);
    const right = featuresById.get(rightId);
    if (!left || !right) return;

    const result = calculateSimilarity(left, right, genreIdf);
    if (result.score < GRAPH_NEIGHBOR_CONFIG.minimumSimilarity) return;

    const sharedArtist = result.evidence.artist > 0;
    const leftNeighbor: RankedNeighbor = {
      evidence: result.evidence,
      neighborId: rightId,
      score: result.score,
      sharedArtist,
    };
    const rightNeighbor: RankedNeighbor = {
      ...leftNeighbor,
      neighborId: leftId,
    };

    rankedByTrack.get(leftId)?.push(leftNeighbor);
    rankedByTrack.get(rightId)?.push(rightNeighbor);
    pairResults.set(key, leftNeighbor);
  });

  rankedByTrack.forEach((neighbors) => neighbors.sort(compareNeighbors));
  const selectedByTrack = new Map<string, Set<string>>();
  rankedByTrack.forEach((neighbors, trackId) => {
    selectedByTrack.set(trackId, chooseNeighbors(neighbors));
  });

  const degrees = new Map(features.map((feature) => [feature.track.id, 0]));
  const sameArtistDegrees = new Map(
    features.map((feature) => [feature.track.id, 0]),
  );

  const addGraphEdge = (leftId: string, rightId: string, pair: RankedNeighbor) => {
    if (graph.hasEdge(leftId, rightId)) return false;
    if (
      pair.sharedArtist &&
      ((sameArtistDegrees.get(leftId) ?? 0) >=
        GRAPH_NEIGHBOR_CONFIG.maxSameArtistNeighbors ||
        (sameArtistDegrees.get(rightId) ?? 0) >=
          GRAPH_NEIGHBOR_CONFIG.maxSameArtistNeighbors)
    ) {
      return false;
    }

    graph.addEdgeWithKey(pairKey(leftId, rightId), leftId, rightId, {
      color: "#52525b",
      evidence: pair.evidence,
      hidden: true,
      size: 0.5 + pair.score * 1.5,
      weight: pair.score,
    });
    degrees.set(leftId, (degrees.get(leftId) ?? 0) + 1);
    degrees.set(rightId, (degrees.get(rightId) ?? 0) + 1);
    if (pair.sharedArtist) {
      sameArtistDegrees.set(leftId, (sameArtistDegrees.get(leftId) ?? 0) + 1);
      sameArtistDegrees.set(rightId, (sameArtistDegrees.get(rightId) ?? 0) + 1);
    }
    return true;
  };

  Array.from(pairResults.entries())
    .sort((left, right) => right[1].score - left[1].score || left[0].localeCompare(right[0]))
    .forEach(([key, pair]) => {
      const [leftId, rightId] = splitPairKey(key);
      if (
        selectedByTrack.get(leftId)?.has(rightId) &&
        selectedByTrack.get(rightId)?.has(leftId)
      ) {
        addGraphEdge(leftId, rightId, pair);
      }
    });

  graph.forEachNode((trackId) => {
    if ((degrees.get(trackId) ?? 0) > 0) return;

    const fallbackCandidates = rankedByTrack.get(trackId) ?? [];
    for (const fallback of fallbackCandidates) {
      if (
        (degrees.get(fallback.neighborId) ?? 0) >
        GRAPH_NEIGHBOR_CONFIG.maxNeighbors
      ) {
        continue;
      }
      if (addGraphEdge(trackId, fallback.neighborId, fallback)) break;
    }
  });

  return {
    candidatePairCount: candidatePairs.size,
    genreIdf,
    graph,
  };
};
