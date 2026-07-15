import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";
import type { SongGraph } from "@/lib/network/buildGraph";
import { createDiscoveryContext } from "@/lib/network/discoveryContext";
import { rerankDiscoveryCandidates } from "@/lib/network/discoveryFeedback";
import { mixDiscoveryCandidates } from "@/lib/network/mixDiscoveryCandidates";
import { scoreDiscoveryCandidates } from "@/lib/network/scoreDiscoveryCandidates";
import type {
  DiscoveryContext,
  DiscoveryEvent,
  ExplorationMode,
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

interface DiscoverMixedCandidatesOptions {
  dismissedTrackIds?: string[];
  events?: DiscoveryEvent[];
  exploration?: ExplorationMode;
  fetchCandidates: DiscoveryCandidatesFetcher;
  graph: SongGraph;
  likedTracks: EnrichedTrack[];
  random?: () => number;
  selectedTrackId: string;
}

export const discoverMixedCandidates = async ({
  dismissedTrackIds = [],
  events = [],
  exploration = "balanced",
  fetchCandidates,
  graph,
  likedTracks,
  random = Math.random,
  selectedTrackId,
}: DiscoverMixedCandidatesOptions) => {
  const contexts = (["song", "neighborhood"] as const).map((scope) =>
    createDiscoveryContext({
      dismissedTrackIds,
      exploration,
      graph,
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
      ).slice(0, 5);
    }),
  );

  return mixDiscoveryCandidates(
    rankedByStrategy[0],
    rankedByStrategy[1],
    random,
  );
};
