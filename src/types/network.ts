import type { SerializedGraph } from "graphology-types";
import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";
import type { TrackAudioFeatures } from "@/types/audio";

export type SongNodeKind = "liked" | "candidate";

export type CandidateStatus =
  | "unseen"
  | "previewed"
  | "saved"
  | "dismissed";

export interface SimilarityEvidence {
  album: number;
  artist: number;
  energy?: number;
  genre: number;
  reasonCodes: string[];
  semantic?: number;
  sharedGenres: string[];
  tempo?: number;
}

export interface SongGraphNodeAttributes {
  albumId: string;
  albumName: string;
  artistIds: string[];
  artistNames: string[];
  candidateStatus?: CandidateStatus;
  clusterId?: string;
  color: string;
  forceLabel?: boolean;
  genres: string[];
  hidden?: boolean;
  highlighted?: boolean;
  image?: string;
  kind: SongNodeKind;
  label: string;
  recommendationId?: string;
  size: number;
  type: "image";
  uri: string;
  x: number;
  y: number;
}

export interface SongGraphEdgeAttributes {
  color?: string;
  evidence: SimilarityEvidence;
  hidden?: boolean;
  size?: number;
  weight: number;
}

export interface ClusterProfile {
  color: string;
  id: string;
  label: string;
  nodeIds: string[];
  representativeArtistIds: string[];
  representativeTrackIds: string[];
  topGenres: Array<{ name: string; weight: number }>;
}

export interface GraphCachePayload {
  cacheSchemaVersion: number;
  clusters: ClusterProfile[];
  createdAt: number;
  layoutVersion: string;
  libraryFingerprint: string;
  modelVersion: string;
  positions: Record<string, { x: number; y: number }>;
}

export type SongGraphBuildStage =
  | "normalizing"
  | "relationships"
  | "communities"
  | "layout"
  | "ready";

export interface SongGraphBuildStats {
  cacheHit: boolean;
  candidatePairs: number;
  clusterCount: number;
  edgeCount: number;
  isolatedNodeCount: number;
  neighborhoodCount: number;
  nodeCount: number;
  sameArtistEdgeCount: number;
}

export interface SongGraphBuildResult {
  cache: GraphCachePayload;
  clusters: ClusterProfile[];
  graph: SerializedGraph<SongGraphNodeAttributes, SongGraphEdgeAttributes>;
  stats: SongGraphBuildStats;
}

export type DiscoveryScope = "song" | "neighborhood" | "cluster";

export type ExplorationMode = "familiar" | "balanced" | "adventurous";

export type RecommendationStrategy = "song" | "neighborhood";

export type RecommendationFeedback = "up" | "down";

export type RecommendationFeedbackState =
  | "saving"
  | "saved"
  | "error";

export interface RecommendationStrategyStats {
  disliked: number;
  impressions: number;
  liked: number;
  likeRate: number | null;
  positiveRate: number | null;
  ratingRate: number | null;
  strategy: RecommendationStrategy;
  total: number;
}

export interface RecommendationStrategyLearningStats {
  disliked: number;
  impressions: number;
  liked: number;
  strategy: RecommendationStrategy;
}

export interface RecommendationLearningProfile {
  artistAffinities: Record<string, number>;
  artistNames: Record<string, string>;
  avoidedArtists: string[];
  avoidedGenres: string[];
  energyFitWeight: number;
  genreAffinities: Record<string, number>;
  noveltyWeight: number;
  preferredArtists: string[];
  preferredGenres: string[];
  rejectedTrackIds: string[];
  sampleSize: number;
  strategies: RecommendationStrategyLearningStats[];
  tempoFitWeight: number;
}

export interface RecommendationImpressionFeatures {
  artistIds: string[];
  artistNames: string[];
  energy: number | null;
  energyFit: number | null;
  genres: string[];
  knownArtist: boolean;
  mapScore: number;
  model: string;
  promptVersion: string;
  resolutionConfidence: number;
  seedTrackIds: string[];
  tempo: number | null;
  tempoFit: number | null;
  trackName: string;
}

export interface RecommendationImpression {
  exploration: ExplorationMode;
  features: RecommendationImpressionFeatures;
  rank: number;
  recommendationId: string;
  strategy: RecommendationStrategy;
  trackId: string;
}

export type DiscoveryEventType =
  | "candidate_shown"
  | "candidate_selected"
  | "preview_started"
  | "preview_completed"
  | "candidate_saved"
  | "candidate_playlisted"
  | "candidate_dismissed"
  | "more_like_candidate"
  | "recommendation_liked"
  | "recommendation_disliked";

export type DiscoveryConfidence = "high" | "medium" | "low" | "weak";

export type CandidateSaveState =
  | "saving"
  | "saved"
  | "error"
  | "reauthorize";

export interface DiscoveryTrackSummary {
  artistIds: string[];
  artistNames: string[];
  features: TrackAudioFeatures | null;
  genres: string[];
  id: string;
  name: string;
}

export interface DiscoveryContext {
  anchorTracks: DiscoveryTrackSummary[];
  clusterLabel?: string;
  dismissedTrackIds: string[];
  existingTrackIds: string[];
  exploration: ExplorationMode;
  learningProfile?: RecommendationLearningProfile;
  resultLimit?: number;
  scope: DiscoveryScope;
  seedTracks: DiscoveryTrackSummary[];
  topGenres: string[];
}

export interface DiscoveryEvent {
  artistIds: string[];
  exploration: ExplorationMode;
  id: string;
  recommendationId: string;
  scope: DiscoveryScope;
  timestamp: number;
  trackId: string;
  type: DiscoveryEventType;
}

export interface DiscoverySessionState {
  candidates: DiscoveryCandidate[];
  dismissedTrackIds: string[];
  events: DiscoveryEvent[];
  exploration: ExplorationMode;
  schemaVersion: number;
  summary: string;
  updatedAt: number;
}

export interface DiscoveryProposal {
  artist: string;
  matchedSeedIds: string[];
  reason: string;
  title: string;
}

export interface ResolvedDiscoverySuggestion {
  proposal: DiscoveryProposal;
  recommendationId: string;
  recommendationModel?: string;
  recommendationPromptVersion?: string;
  resolutionConfidence: number;
  track: EnrichedTrack;
}

export interface CandidateAnchor {
  evidence: SimilarityEvidence;
  score: number;
  trackId: string;
}

export interface DiscoveryCandidate extends ResolvedDiscoverySuggestion {
  anchors: CandidateAnchor[];
  confidence: DiscoveryConfidence;
  feedback?: RecommendationFeedback;
  mapped: boolean;
  recommendationExploration: ExplorationMode;
  score: number;
  scope: DiscoveryScope;
  status: CandidateStatus;
}
