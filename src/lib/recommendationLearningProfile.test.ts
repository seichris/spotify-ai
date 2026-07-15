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
      [
        { track_id: "rejected-track" },
        { track_id: "rejected-track" },
      ],
    );

    expect(profile).toMatchObject({
      avoidedArtists: ["Techno Artist"],
      avoidedGenres: ["techno"],
      preferredArtists: ["Dream Artist"],
      preferredGenres: ["dream pop"],
      rejectedTrackIds: ["rejected-track"],
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

  it("reduces the strength of a sparse old preference", () => {
    const now = Date.parse("2026-07-15T00:00:00.000Z");
    const profile = buildRecommendationLearningProfile(
      [
        {
          feedback: 1,
          features: features("artist-recent", "Recent Artist", ["recent pop"]),
          updated_at: new Date(now).toISOString(),
        },
        {
          feedback: 1,
          features: features("artist-old", "Old Artist", ["old pop"]),
          updated_at: new Date(now - 179 * 86_400_000).toISOString(),
        },
      ],
      [],
      [],
      now,
    );

    expect(profile.artistAffinities["artist-recent"]).toBe(1);
    expect(profile.artistAffinities["artist-old"]).toBeLessThan(0.15);
    expect(profile.preferredArtists).toEqual(["Recent Artist"]);
    expect(profile.preferredGenres).toEqual(["recent pop"]);
    const oldOnly = buildRecommendationLearningProfile(
      [
        {
          feedback: 1,
          features: features("artist-old", "Old Artist", ["old pop"]),
          updated_at: new Date(now - 179 * 86_400_000).toISOString(),
        },
      ],
      [],
      [],
      now,
    );
    expect(oldOnly.energyFitWeight).toBeLessThan(0.1);
    expect(oldOnly.noveltyWeight).toBeLessThan(0.15);
    expect(oldOnly.tempoFitWeight).toBeLessThan(0.12);
  });
});
