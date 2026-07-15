import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";
import type { SongGraph } from "@/lib/network/buildGraph";
import { createDiscoveryContext } from "@/lib/network/discoveryContext";
import { rerankDiscoveryCandidates } from "@/lib/network/discoveryFeedback";
import { mixDiscoveryCandidates } from "@/lib/network/mixDiscoveryCandidates";
import {
  chooseRecommendationStrategyAllocation,
  createEmptyRecommendationLearningProfile,
  sanitizeRecommendationLearningProfile,
} from "@/lib/network/recommendationLearning";
import { scoreDiscoveryCandidates } from "@/lib/network/scoreDiscoveryCandidates";
import type {
  DiscoveryContext,
  DiscoveryEvent,
  ExplorationMode,
  RecommendationLearningProfile,
  ResolvedDiscoverySuggestion,
} from "@/types/network";

interface DiscoveryCandidatesResult {
  error?: string;
  success: boolean;
  suggestions?: ResolvedDiscoverySuggestion[];
}

export type DiscoveryCandidatesFetcher = (
  context: DiscoveryContext,
) => Promise<DiscoveryCandidatesResult>;

interface RecommendationLearningProfileResult {
  profile?: RecommendationLearningProfile;
  success: boolean;
}

export type RecommendationLearningProfileFetcher =
  () => Promise<RecommendationLearningProfileResult>;

interface DiscoverMixedCandidatesOptions {
  dismissedTrackIds?: string[];
  events?: DiscoveryEvent[];
  exploration?: ExplorationMode;
  fetchCandidates: DiscoveryCandidatesFetcher;
  fetchLearningProfile?: RecommendationLearningProfileFetcher;
  graph: SongGraph;
  likedTracks: EnrichedTrack[];
  onLearningProfile?: (profile: RecommendationLearningProfile) => void;
  random?: () => number;
  selectedTrackId: string;
}

export const discoverMixedCandidates = async ({
  dismissedTrackIds = [],
  events = [],
  exploration = "balanced",
  fetchCandidates,
  fetchLearningProfile,
  graph,
  likedTracks,
  onLearningProfile,
  random = Math.random,
  selectedTrackId,
}: DiscoverMixedCandidatesOptions) => {
  let learningProfile = createEmptyRecommendationLearningProfile();
  if (fetchLearningProfile) {
    try {
      const result = await fetchLearningProfile();
      if (result.success && result.profile) {
        learningProfile = sanitizeRecommendationLearningProfile(result.profile);
      }
    } catch {
      // Personalization is best effort; base discovery remains available.
    }
  }
  onLearningProfile?.(learningProfile);
  const allocation = chooseRecommendationStrategyAllocation(
    learningProfile,
    random,
  );
  const contexts = (["song", "neighborhood"] as const).map((scope) =>
    createDiscoveryContext({
      dismissedTrackIds,
      exploration,
      graph,
      learningProfile,
      resultLimit: allocation[scope],
      scope,
      selectedTrackId,
      tracks: likedTracks,
    }),
  );
  const rankedByStrategy = await Promise.all(
    contexts.map(async (context) => {
      const result = await fetchCandidates(context);
      if (!result.success || !result.suggestions) {
        throw new Error(result.error ?? "Discovery failed.");
      }
      const scored = scoreDiscoveryCandidates(
        result.suggestions,
        likedTracks,
        context,
      );
      return rerankDiscoveryCandidates(
        scored,
        likedTracks,
        exploration,
        events,
        learningProfile,
      ).slice(0, context.resultLimit ?? 5);
    }),
  );

  return mixDiscoveryCandidates(
    rankedByStrategy[0],
    rankedByStrategy[1],
    random,
    allocation,
  );
};
