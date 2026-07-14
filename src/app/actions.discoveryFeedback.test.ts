import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyRecommendationFeedbackToken } from "@/lib/recommendationFeedbackToken";
import type { DiscoveryContext } from "@/types/network";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  fetchSpotify: vi.fn(),
  generateStructuredSongSuggestions: vi.fn(),
  searchSpotify: vi.fn(),
  selectBestSpotifyMatch: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/spotify", () => ({
  addTracksToPlaylist: vi.fn(),
  createPlaylist: vi.fn(),
  fetchSpotify: mocks.fetchSpotify,
  getArtistTopTracks: vi.fn(),
  getAudioFeatures: vi.fn(),
  getLikedSongs: vi.fn(),
  replacePlaylistTracks: vi.fn(),
  saveItemsToLibrary: vi.fn(),
  searchSpotify: mocks.searchSpotify,
}));
vi.mock("@/lib/gemini", () => ({
  generateSongSuggestions: vi.fn(),
  generateStructuredSongSuggestions:
    mocks.generateStructuredSongSuggestions,
}));
vi.mock("@/lib/discoveryResolution", () => ({
  selectBestSpotifyMatch: mocks.selectBestSpotifyMatch,
}));
vi.mock("@/lib/recommendationFeedback", () => ({
  getRecommendationFeedbackStats: vi.fn(),
  recordRecommendationFeedback: vi.fn(),
}));

import { getMapDiscoveryCandidatesAction } from "@/app/actions";

const context: DiscoveryContext = {
  anchorTracks: [
    {
      artistIds: ["artist-seed"],
      artistNames: ["Seed Artist"],
      genres: ["dream pop"],
      id: "seed-track",
      name: "Seed Track",
    },
  ],
  dismissedTrackIds: [],
  existingTrackIds: ["seed-track"],
  exploration: "balanced",
  scope: "song",
  seedTracks: [
    {
      artistIds: ["artist-seed"],
      artistNames: ["Seed Artist"],
      genres: ["dream pop"],
      id: "seed-track",
      name: "Seed Track",
    },
  ],
  topGenres: ["dream pop"],
};

describe("getMapDiscoveryCandidatesAction feedback issuance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SPOTIFY_AUTH_SECRET", "test-feedback-signing-secret");
    mocks.auth.mockResolvedValue({ spotify_user_id: "owner-123" });
    mocks.generateStructuredSongSuggestions.mockResolvedValue({
      data: {
        suggestions: [
          {
            artist: "Candidate Artist",
            matchedSeedIds: ["seed-track"],
            reason: "A compatible dream-pop recommendation.",
            title: "Candidate Track",
          },
        ],
        summary: "One candidate",
      },
      model: "test-model",
      usageMetadata: {},
    });
    const track = {
      album: { id: "album-123", images: [], name: "Candidate Album" },
      artists: [{ id: "artist-123", name: "Candidate Artist" }],
      duration_ms: 180_000,
      id: "track-123",
      is_local: false,
      is_playable: true,
      name: "Candidate Track",
      type: "track",
      uri: "spotify:track:track-123",
    };
    mocks.searchSpotify.mockResolvedValue({ tracks: { items: [track] } });
    mocks.selectBestSpotifyMatch.mockReturnValue({
      confidence: 1,
      track,
    });
    mocks.fetchSpotify.mockResolvedValue({
      artists: [{ genres: ["dream pop"], id: "artist-123" }],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a signed ID bound to the user and generation context", async () => {
    const result = await getMapDiscoveryCandidatesAction(context);

    expect(result.success).toBe(true);
    if (!result.success || !("suggestions" in result)) {
      throw new Error("Expected discovery suggestions.");
    }
    expect(result.suggestions).toHaveLength(1);
    expect(
      verifyRecommendationFeedbackToken(
        result.suggestions[0].recommendationId,
      ),
    ).toEqual({
      exploration: "balanced",
      strategy: "song",
      trackId: "track-123",
      userId: "owner-123",
    });
  });
});
