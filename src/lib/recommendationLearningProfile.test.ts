import { describe, expect, it } from "vitest";
import { buildRecommendationLearningProfile } from "@/lib/recommendationFeedback";
import type { RecommendationImpressionFeatures } from "@/types/network";

const features = (
  artistId: string,
  artistName: string,
  genres: string[],
  overrides: Partial<RecommendationImpressionFeatures> = {},
): RecommendationImpressionFeatures => ({
  artistIds: [artistId],
  artistNames: [artistName],
  energy: 0.7,
  energyFit: 0.8,
  genres,
  knownArtist: false,
  mapScore: 0.8,
  model: "gemini-test",
  promptVersion: "feedback-loop-v1",
  resolutionConfidence: 0.9,
  seedTrackIds: ["seed"],
  tempo: 120,
  tempoFit: 0.9,
  trackName: "Recommendation",
  ...overrides,
});

describe("buildRecommendationLearningProfile", () => {
  it("learns recent artist, genre, fit, novelty, and strategy preferences", () => {
    const now = Date.parse("2026-07-15T00:00:00.000Z");
    const profile = buildRecommendationLearningProfile(
      [
        {
          feedback: 1,
          features: features("artist-dream", "Dream Artist", ["dream pop"]),
          updated_at: new Date(now).toISOString(),
        },
        {
          feedback: -1,
          features: features("artist-techno", "Techno Artist", ["techno"], {
            energyFit: 0.2,
            knownArtist: true,
            tempoFit: 0.2,
          }),
          updated_at: new Date(now).toISOString(),
        },
      ],
      [
        { disliked: 2, liked: 8, strategy: "song" },
        { disliked: 5, liked: 5, strategy: "neighborhood" },
      ],
      [
        { impressions: 20, strategy: "song" },
        { impressions: 20, strategy: "neighborhood" },
      ],
      now,
    );

    expect(profile).toMatchObject({
      avoidedArtists: ["Techno Artist"],
      avoidedGenres: ["techno"],
      preferredArtists: ["Dream Artist"],
      preferredGenres: ["dream pop"],
      sampleSize: 2,
      strategies: [
        { disliked: 2, impressions: 20, liked: 8, strategy: "song" },
        { disliked: 5, impressions: 20, liked: 5, strategy: "neighborhood" },
      ],
    });
    expect(profile.energyFitWeight).toBeGreaterThan(0);
    expect(profile.noveltyWeight).toBeGreaterThan(0);
    expect(profile.tempoFitWeight).toBeGreaterThan(0);
  });

  it("decays older feedback so recent taste changes win", () => {
    const now = Date.parse("2026-07-15T00:00:00.000Z");
    const profile = buildRecommendationLearningProfile(
      [
        {
          feedback: 1,
          features: features("artist-a", "Artist A", ["dream pop"]),
          updated_at: new Date(now).toISOString(),
        },
        {
          feedback: -1,
          features: features("artist-a", "Artist A", ["dream pop"]),
          updated_at: new Date(now - 180 * 86_400_000).toISOString(),
        },
      ],
      [],
      [],
      now,
    );

    expect(profile.artistAffinities["artist-a"]).toBeGreaterThan(0.7);
    expect(profile.genreAffinities["dream pop"]).toBeGreaterThan(0.7);
  });
});
