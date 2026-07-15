import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";
import { learnedRecommendationBoost } from "@/lib/network/recommendationLearning";
import type {
  DiscoveryCandidate,
  DiscoveryEvent,
  DiscoveryEventType,
  DiscoverySessionState,
  ExplorationMode,
  RecommendationLearningProfile,
} from "@/types/network";

export const DISCOVERY_SESSION_SCHEMA_VERSION = 2;
export const DISCOVERY_SESSION_STORAGE_KEY = "song_map_discovery_session_v2";

const EXPLORATION_MODES = new Set<ExplorationMode>([
  "familiar",
  "balanced",
  "adventurous",
]);
const EVENT_TYPES = new Set<DiscoveryEventType>([
  "candidate_shown",
  "candidate_selected",
  "preview_started",
  "preview_completed",
  "candidate_saved",
  "candidate_playlisted",
  "candidate_dismissed",
  "more_like_candidate",
  "recommendation_liked",
  "recommendation_disliked",
]);
const CANDIDATE_STATUSES = new Set([
  "unseen",
  "previewed",
  "saved",
  "dismissed",
]);
const CANDIDATE_CONFIDENCE = new Set(["high", "medium", "low", "weak"]);
const DISCOVERY_SCOPES = new Set(["song", "neighborhood", "cluster"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

const isStringArray = (value: unknown) =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isStoredTrack = (value: unknown) => {
  if (!isRecord(value) || !isRecord(value.album)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.uri === "string" &&
    typeof value.type === "string" &&
    typeof value.is_local === "boolean" &&
    typeof value.duration_ms === "number" &&
    isStringArray(value.genres) &&
    Array.isArray(value.artists) &&
    value.artists.every(
      (artist) =>
        isRecord(artist) &&
        typeof artist.id === "string" &&
        typeof artist.name === "string",
    ) &&
    typeof value.album.id === "string" &&
    typeof value.album.name === "string" &&
    Array.isArray(value.album.images) &&
    value.album.images.every(
      (image) => isRecord(image) && typeof image.url === "string",
    )
  );
};

const isCandidate = (value: unknown): value is DiscoveryCandidate => {
  if (!isRecord(value) || !isRecord(value.proposal)) return false;
  return (
    isStoredTrack(value.track) &&
    typeof value.recommendationId === "string" &&
    typeof value.resolutionConfidence === "number" &&
    Number.isFinite(value.resolutionConfidence) &&
    typeof value.score === "number" &&
    Number.isFinite(value.score) &&
    typeof value.mapped === "boolean" &&
    typeof value.recommendationExploration === "string" &&
    EXPLORATION_MODES.has(
      value.recommendationExploration as ExplorationMode,
    ) &&
    (value.feedback === undefined ||
      value.feedback === "up" ||
      value.feedback === "down") &&
    typeof value.confidence === "string" &&
    CANDIDATE_CONFIDENCE.has(value.confidence) &&
    typeof value.scope === "string" &&
    DISCOVERY_SCOPES.has(value.scope) &&
    typeof value.status === "string" &&
    CANDIDATE_STATUSES.has(value.status) &&
    typeof value.proposal.title === "string" &&
    typeof value.proposal.artist === "string" &&
    typeof value.proposal.reason === "string" &&
    isStringArray(value.proposal.matchedSeedIds) &&
    Array.isArray(value.anchors) &&
    value.anchors.every(
      (anchor) =>
        isRecord(anchor) &&
        typeof anchor.trackId === "string" &&
        typeof anchor.score === "number" &&
        isRecord(anchor.evidence) &&
        typeof anchor.evidence.genre === "number" &&
        typeof anchor.evidence.artist === "number" &&
        typeof anchor.evidence.album === "number" &&
        isStringArray(anchor.evidence.sharedGenres) &&
        isStringArray(anchor.evidence.reasonCodes),
    )
  );
};

const isDiscoveryEvent = (value: unknown): value is DiscoveryEvent =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.recommendationId === "string" &&
  typeof value.trackId === "string" &&
  typeof value.timestamp === "number" &&
  typeof value.type === "string" &&
  EVENT_TYPES.has(value.type as DiscoveryEventType) &&
  typeof value.scope === "string" &&
  DISCOVERY_SCOPES.has(value.scope) &&
  typeof value.exploration === "string" &&
  EXPLORATION_MODES.has(value.exploration as ExplorationMode) &&
  isStringArray(value.artistIds);

export const createEmptyDiscoverySession = (): DiscoverySessionState => ({
  candidates: [],
  dismissedTrackIds: [],
  events: [],
  exploration: "balanced",
  schemaVersion: DISCOVERY_SESSION_SCHEMA_VERSION,
  summary: "",
  updatedAt: 0,
});

export const createDiscoverySessionState = (
  state: Omit<DiscoverySessionState, "schemaVersion">,
): DiscoverySessionState => ({
  ...state,
  schemaVersion: DISCOVERY_SESSION_SCHEMA_VERSION,
});

export const parseDiscoverySession = (
  serialized: string | null,
): DiscoverySessionState => {
  if (!serialized) return createEmptyDiscoverySession();

  try {
    const value = JSON.parse(serialized) as unknown;
    if (
      !isRecord(value) ||
      value.schemaVersion !== DISCOVERY_SESSION_SCHEMA_VERSION ||
      !Array.isArray(value.candidates) ||
      !value.candidates.every(isCandidate) ||
      !isStringArray(value.dismissedTrackIds) ||
      !Array.isArray(value.events) ||
      !value.events.every(isDiscoveryEvent) ||
      typeof value.exploration !== "string" ||
      !EXPLORATION_MODES.has(value.exploration as ExplorationMode) ||
      typeof value.summary !== "string" ||
      typeof value.updatedAt !== "number"
    ) {
      return createEmptyDiscoverySession();
    }

    return {
      candidates: value.candidates.slice(0, 12),
      dismissedTrackIds: Array.from(
        new Set(value.dismissedTrackIds.slice(0, 500)),
      ),
      events: value.events.slice(-500),
      exploration: value.exploration as ExplorationMode,
      schemaVersion: DISCOVERY_SESSION_SCHEMA_VERSION,
      summary: value.summary.slice(0, 1200),
      updatedAt: value.updatedAt,
    };
  } catch {
    return createEmptyDiscoverySession();
  }
};

export const readDiscoverySession = () => {
  if (typeof window === "undefined") return createEmptyDiscoverySession();
  return parseDiscoverySession(
    window.localStorage.getItem(DISCOVERY_SESSION_STORAGE_KEY),
  );
};

export const writeDiscoverySession = (state: DiscoverySessionState) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      DISCOVERY_SESSION_STORAGE_KEY,
      JSON.stringify({ ...state, updatedAt: Date.now() }),
    );
  } catch (error) {
    console.warn("Could not persist the discovery session", error);
  }
};

export const clearDiscoverySession = () => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(DISCOVERY_SESSION_STORAGE_KEY);
  }
};

const EVENT_WEIGHTS: Record<DiscoveryEventType, number> = {
  candidate_dismissed: -1,
  candidate_playlisted: 0.7,
  candidate_saved: 1,
  candidate_selected: 0.05,
  candidate_shown: 0,
  more_like_candidate: 0.4,
  preview_completed: 0.25,
  preview_started: 0.12,
  recommendation_disliked: -1,
  recommendation_liked: 1,
};

export const rerankDiscoveryCandidates = (
  candidates: DiscoveryCandidate[],
  likedTracks: EnrichedTrack[],
  exploration: ExplorationMode,
  events: DiscoveryEvent[],
  learningProfile?: RecommendationLearningProfile,
) => {
  const likedArtistIds = new Set(
    likedTracks.flatMap((track) => track.artists.map((artist) => artist.id)),
  );
  const artistAffinity = new Map<string, number>();

  events.forEach((event) => {
    const weight = EVENT_WEIGHTS[event.type];
    event.artistIds.forEach((artistId) => {
      artistAffinity.set(
        artistId,
        Math.max(-3, Math.min(3, (artistAffinity.get(artistId) ?? 0) + weight)),
      );
    });
  });

  const rank = (candidate: DiscoveryCandidate) => {
    const artistIds = candidate.track.artists.map((artist) => artist.id);
    const knownArtist = artistIds.some((artistId) => likedArtistIds.has(artistId));
    const feedback = artistIds.length
      ? artistIds.reduce(
          (total, artistId) => total + (artistAffinity.get(artistId) ?? 0),
          0,
        ) / artistIds.length
      : 0;
    const resolutionBonus = candidate.resolutionConfidence * 0.02;
    const learnedBoost = learningProfile
      ? learnedRecommendationBoost(candidate, knownArtist, learningProfile)
      : 0;

    if (exploration === "familiar") {
      return candidate.score * 1.2 + Number(knownArtist) * 0.07 + feedback * 0.05 + resolutionBonus + learnedBoost;
    }
    if (exploration === "adventurous") {
      return candidate.score * 0.7 + Number(!knownArtist) * 0.15 + feedback * 0.08 + resolutionBonus + learnedBoost;
    }
    return candidate.score + Number(!knownArtist) * 0.05 + feedback * 0.07 + resolutionBonus + learnedBoost;
  };

  return [...candidates].sort(
    (left, right) =>
      Number(right.mapped) - Number(left.mapped) ||
      rank(right) - rank(left) ||
      left.track.id.localeCompare(right.track.id),
  );
};
