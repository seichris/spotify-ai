import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";
import type {
  DiscoveryCandidate,
  RecommendationImpression,
  RecommendationLearningProfile,
  RecommendationStrategy,
  RecommendationStrategyLearningStats,
  RecommendationStrategyStats,
} from "@/types/network";

export const RECOMMENDATION_PROMPT_VERSION = "feedback-loop-v1";

const STRATEGIES = ["song", "neighborhood"] as const;
const MIN_IMPRESSIONS_PER_STRATEGY = 15;
const MIN_RATINGS_FOR_ADAPTATION = 10;
const EQUAL_SPLIT_EXPLORATION_RATE = 0.2;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const emptyStrategyStats = (
  strategy: RecommendationStrategy,
): RecommendationStrategyLearningStats => ({
  disliked: 0,
  impressions: 0,
  liked: 0,
  strategy,
});

export const createEmptyRecommendationLearningProfile =
  (): RecommendationLearningProfile => ({
    artistAffinities: {},
    artistNames: {},
    avoidedArtists: [],
    avoidedGenres: [],
    energyFitWeight: 0,
    genreAffinities: {},
    noveltyWeight: 0,
    preferredArtists: [],
    preferredGenres: [],
    rejectedTrackIds: [],
    sampleSize: 0,
    strategies: STRATEGIES.map(emptyStrategyStats),
    tempoFitWeight: 0,
  });

const sanitizeStringArray = (value: unknown, limit: number) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, limit)
    : [];

const sanitizeAffinityRecord = (value: unknown) => {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        (entry): entry is [string, number] =>
          Boolean(entry[0]) &&
          typeof entry[1] === "number" &&
          Number.isFinite(entry[1]),
      )
      .slice(0, 40)
      .map(([key, affinity]) => [
        key.trim().slice(0, 120),
        clamp(affinity, -1, 1),
      ])
      .filter(([key]) => Boolean(key)),
  );
};

const sanitizeArtistNames = (value: unknown) => {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        (entry): entry is [string, string] =>
          Boolean(entry[0]) && typeof entry[1] === "string",
      )
      .slice(0, 40)
      .map(([id, name]) => [
        id.trim().slice(0, 120),
        name.trim().slice(0, 120),
      ])
      .filter(([id, name]) => Boolean(id) && Boolean(name)),
  );
};

const sanitizeStrategyStats = (value: unknown) => {
  const supplied = Array.isArray(value) ? value : [];
  const byStrategy = new Map<
    RecommendationStrategy,
    RecommendationStrategyLearningStats
  >();
  supplied.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    if (record.strategy !== "song" && record.strategy !== "neighborhood") {
      return;
    }
    const toCount = (count: unknown) =>
      typeof count === "number" && Number.isFinite(count)
        ? Math.max(0, Math.floor(count))
        : 0;
    byStrategy.set(record.strategy, {
      disliked: toCount(record.disliked),
      impressions: toCount(record.impressions),
      liked: toCount(record.liked),
      strategy: record.strategy,
    });
  });
  return STRATEGIES.map(
    (strategy) => byStrategy.get(strategy) ?? emptyStrategyStats(strategy),
  );
};

export const sanitizeRecommendationLearningProfile = (
  value: unknown,
): RecommendationLearningProfile => {
  if (!value || typeof value !== "object") {
    return createEmptyRecommendationLearningProfile();
  }
  const record = value as Record<string, unknown>;
  const numberWeight = (input: unknown) =>
    typeof input === "number" && Number.isFinite(input)
      ? clamp(input, -1, 1)
      : 0;
  return {
    artistAffinities: sanitizeAffinityRecord(record.artistAffinities),
    artistNames: sanitizeArtistNames(record.artistNames),
    avoidedArtists: sanitizeStringArray(record.avoidedArtists, 8),
    avoidedGenres: sanitizeStringArray(record.avoidedGenres, 8),
    energyFitWeight: numberWeight(record.energyFitWeight),
    genreAffinities: sanitizeAffinityRecord(record.genreAffinities),
    noveltyWeight: numberWeight(record.noveltyWeight),
    preferredArtists: sanitizeStringArray(record.preferredArtists, 8),
    preferredGenres: sanitizeStringArray(record.preferredGenres, 8),
    rejectedTrackIds: sanitizeStringArray(record.rejectedTrackIds, 500),
    sampleSize:
      typeof record.sampleSize === "number" && Number.isFinite(record.sampleSize)
        ? clamp(Math.floor(record.sampleSize), 0, 200)
        : 0,
    strategies: sanitizeStrategyStats(record.strategies),
    tempoFitWeight: numberWeight(record.tempoFitWeight),
  };
};

export interface RecommendationStrategyAllocation {
  neighborhood: number;
  song: number;
}

export const chooseRecommendationStrategyAllocation = (
  profile: RecommendationLearningProfile,
  random: () => number = Math.random,
): RecommendationStrategyAllocation => {
  const [song, neighborhood] = STRATEGIES.map(
    (strategy) =>
      profile.strategies.find((item) => item.strategy === strategy) ??
      emptyStrategyStats(strategy),
  );
  const ratings =
    song.liked + song.disliked + neighborhood.liked + neighborhood.disliked;
  const hasEnoughEvidence =
    ratings >= MIN_RATINGS_FOR_ADAPTATION &&
    song.impressions >= MIN_IMPRESSIONS_PER_STRATEGY &&
    neighborhood.impressions >= MIN_IMPRESSIONS_PER_STRATEGY;

  if (!hasEnoughEvidence || random() < EQUAL_SPLIT_EXPLORATION_RATE) {
    return { neighborhood: 5, song: 5 };
  }

  const songRate = (song.liked + 1) / (song.impressions + 2);
  const neighborhoodRate =
    (neighborhood.liked + 1) / (neighborhood.impressions + 2);
  if (Math.abs(songRate - neighborhoodRate) < 0.03) {
    return { neighborhood: 5, song: 5 };
  }
  return songRate > neighborhoodRate
    ? { neighborhood: 3, song: 7 }
    : { neighborhood: 7, song: 3 };
};

const meanAffinity = (values: string[], affinities: Record<string, number>) =>
  values.length === 0
    ? 0
    : values.reduce((total, value) => total + (affinities[value] ?? 0), 0) /
      values.length;

export const learnedRecommendationBoost = (
  candidate: DiscoveryCandidate,
  knownArtist: boolean,
  profile: RecommendationLearningProfile,
) => {
  if (profile.sampleSize < 3) return 0;
  const artist = meanAffinity(
    candidate.track.artists.map((item) => item.id),
    profile.artistAffinities,
  );
  const genre = meanAffinity(candidate.track.genres, profile.genreAffinities);
  const evidence = candidate.anchors[0]?.evidence;
  const tempoFit = evidence?.tempo ?? 0.5;
  const energyFit = evidence?.energy ?? 0.5;
  const noveltyDirection = knownArtist ? -1 : 1;
  return clamp(
    artist * 0.07 +
      genre * 0.07 +
      (tempoFit - 0.5) * 2 * profile.tempoFitWeight * 0.05 +
      (energyFit - 0.5) * 2 * profile.energyFitWeight * 0.05 +
      noveltyDirection * profile.noveltyWeight * 0.04,
    -0.24,
    0.24,
  );
};

export const recommendationImpressionFor = (
  candidate: DiscoveryCandidate,
  rank: number,
  likedTracks: EnrichedTrack[],
): RecommendationImpression | null => {
  if (candidate.scope !== "song" && candidate.scope !== "neighborhood") {
    return null;
  }
  const likedArtistIds = new Set(
    likedTracks.flatMap((track) => track.artists.map((artist) => artist.id)),
  );
  const strongestEvidence = candidate.anchors[0]?.evidence;
  return {
    exploration: candidate.recommendationExploration,
    features: {
      artistIds: candidate.track.artists.map((artist) => artist.id),
      artistNames: candidate.track.artists.map((artist) => artist.name),
      energy: candidate.track.features?.energy ?? null,
      energyFit: strongestEvidence?.energy ?? null,
      genres: candidate.track.genres,
      knownArtist: candidate.track.artists.some((artist) =>
        likedArtistIds.has(artist.id),
      ),
      mapScore: candidate.score,
      model: candidate.recommendationModel ?? "unknown",
      promptVersion:
        candidate.recommendationPromptVersion ?? RECOMMENDATION_PROMPT_VERSION,
      resolutionConfidence: candidate.resolutionConfidence,
      seedTrackIds: candidate.proposal.matchedSeedIds,
      tempo: candidate.track.features?.tempo ?? null,
      tempoFit: strongestEvidence?.tempo ?? null,
      trackName: candidate.track.name,
    },
    rank,
    recommendationId: candidate.recommendationId,
    strategy: candidate.scope,
    trackId: candidate.track.id,
  };
};

interface RecommendationImpressionWriteResult {
  error?: string;
  stats?: RecommendationStrategyStats[];
  success: boolean;
}

export const persistRecommendationImpressionBatch = async (
  candidates: DiscoveryCandidate[],
  likedTracks: EnrichedTrack[],
  recordImpressions: (
    impressions: RecommendationImpression[],
  ) => Promise<RecommendationImpressionWriteResult>,
) => {
  const impressions = candidates.flatMap((candidate, rank) => {
    const impression = recommendationImpressionFor(candidate, rank, likedTracks);
    return impression ? [impression] : [];
  });
  let error = "Could not record recommendation impressions.";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await recordImpressions(impressions);
      if (result.success) {
        return { error: null, impressions, stats: result.stats };
      }
      error = result.error ?? error;
    } catch {
      // The write is idempotent, so one retry safely covers interrupted responses.
    }
  }
  return { error, impressions, stats: undefined };
};

export const recommendationStatsAfterImpressions = (
  current: RecommendationStrategyStats[],
  impressions: RecommendationImpression[],
): RecommendationStrategyStats[] =>
  STRATEGIES.map((strategy) => {
    const existing = current.find((item) => item.strategy === strategy);
    const impressionCount = impressions.filter(
      (impression) => impression.strategy === strategy,
    ).length;
    const disliked = existing?.disliked ?? 0;
    const liked = existing?.liked ?? 0;
    const total = existing?.total ?? liked + disliked;
    const updatedImpressions = (existing?.impressions ?? 0) + impressionCount;
    return {
      disliked,
      impressions: updatedImpressions,
      liked,
      likeRate: total > 0 ? liked / total : null,
      positiveRate:
        updatedImpressions > 0 ? liked / updatedImpressions : null,
      ratingRate:
        updatedImpressions > 0 ? total / updatedImpressions : null,
      strategy,
      total,
    };
  });

const fitPreference = (weight: number) => {
  if (weight >= 0.15) return "prefer a close match";
  if (weight <= -0.15) return "allow more contrast";
  return "no strong learned preference";
};

export const feedbackGuidanceForPrompt = (
  profile: RecommendationLearningProfile,
) =>
  profile.sampleSize < 3
    ? undefined
    : {
        avoidedArtists: profile.avoidedArtists,
        avoidedGenres: profile.avoidedGenres,
        energyFit: fitPreference(profile.energyFitWeight),
        evidenceRatings: profile.sampleSize,
        novelty:
          profile.noveltyWeight >= 0.15
            ? "prefer new artists"
            : profile.noveltyWeight <= -0.15
              ? "known artists are acceptable"
              : "keep artist novelty balanced",
        preferredArtists: profile.preferredArtists,
        preferredGenres: profile.preferredGenres,
        tempoFit: fitPreference(profile.tempoFitWeight),
      };
