import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";
import {
  buildFeatures,
  createSongFeatures,
} from "@/lib/network/buildFeatures";
import { calculateSimilarity } from "@/lib/network/calculateSimilarity";
import {
  DISCOVERY_EXPLORATION_CONFIG,
  GRAPH_NEIGHBOR_CONFIG,
} from "@/lib/network/graphConfig";
import type {
  DiscoveryCandidate,
  DiscoveryConfidence,
  DiscoveryContext,
  ResolvedDiscoverySuggestion,
} from "@/types/network";

const confidenceFor = (score: number): DiscoveryConfidence => {
  if (score >= 0.35) return "high";
  if (score >= 0.16) return "medium";
  if (score >= GRAPH_NEIGHBOR_CONFIG.minimumSimilarity) return "low";
  return "weak";
};

export const scoreDiscoveryCandidates = (
  suggestions: ResolvedDiscoverySuggestion[],
  likedTracks: EnrichedTrack[],
  context: DiscoveryContext,
): DiscoveryCandidate[] => {
  const existingIds = new Set(likedTracks.map((track) => track.id));
  const dismissedIds = new Set(context.dismissedTrackIds);
  const uniqueSuggestions = Array.from(
    new Map(suggestions.map((suggestion) => [suggestion.track.id, suggestion])).values(),
  ).filter(
    (suggestion) =>
      !existingIds.has(suggestion.track.id) && !dismissedIds.has(suggestion.track.id),
  );
  const { features: likedFeatures, genreIdf } = buildFeatures(likedTracks);
  const candidateFeatures = createSongFeatures(
    uniqueSuggestions.map((suggestion) => suggestion.track),
  );
  const featuresById = new Map(
    [...likedFeatures, ...candidateFeatures].map((feature) => [
      feature.track.id,
      feature,
    ]),
  );
  const minimumSimilarity =
    DISCOVERY_EXPLORATION_CONFIG[context.exploration].minimumSimilarity;

  return uniqueSuggestions
    .map((suggestion) => {
      const candidateFeature = featuresById.get(suggestion.track.id);
      const scoredAnchors = candidateFeature
        ? context.anchorTracks
            .flatMap((anchor) => {
              const anchorFeature = featuresById.get(anchor.id);
              if (!anchorFeature) return [];
              const result = calculateSimilarity(
                candidateFeature,
                anchorFeature,
                genreIdf,
              );
              return [
                {
                  evidence: result.evidence,
                  score: result.score,
                  trackId: anchor.id,
                },
              ];
            })
            .sort(
              (left, right) =>
                right.score - left.score || left.trackId.localeCompare(right.trackId),
            )
        : [];
      const score = scoredAnchors[0]?.score ?? 0;
      const anchors = scoredAnchors
        .filter((anchor) => anchor.score >= minimumSimilarity)
        .slice(0, 3);

      return {
        ...suggestion,
        anchors,
        confidence: confidenceFor(score),
        mapped: anchors.length > 0,
        score,
        scope: context.scope,
        status: "unseen" as const,
      };
    })
    .sort(
      (left, right) =>
        Number(right.mapped) - Number(left.mapped) ||
        right.score - left.score ||
        left.track.id.localeCompare(right.track.id),
    );
};
