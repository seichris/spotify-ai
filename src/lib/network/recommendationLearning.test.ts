import { describe, expect, it, vi } from "vitest";
import { makeTrack } from "@/lib/network/__tests__/fixtures";
import {
  chooseRecommendationStrategyAllocation,
  createEmptyRecommendationLearningProfile,
  learnedRecommendationBoost,
  persistRecommendationImpressionBatch,
  recommendationImpressionFor,
  recommendationStatsAfterImpressions,
} from "@/lib/network/recommendationLearning";
import type {
  DiscoveryCandidate,
  RecommendationLearningProfile,
} from "@/types/network";

const candidate = (artistId = "artist-new"): DiscoveryCandidate => ({
  anchors: [
    {
      evidence: {
        album: 0,
        artist: 0,
        energy: 0.8,
        genre: 1,
        reasonCodes: ["shared_genre"],
        sharedGenres: ["dream pop"],
        tempo: 0.9,
      },
      score: 0.8,
      trackId: "seed-track",
    },
  ],
  confidence: "high",
  mapped: true,
  proposal: {
    artist: "New Artist",
    matchedSeedIds: ["seed-track"],
    reason: "Shared dream-pop character.",
    title: "New Track",
  },
  recommendationExploration: "balanced",
  recommendationId: "signed-recommendation",
  recommendationModel: "gemini-test",
  recommendationPromptVersion: "feedback-loop-v1",
  resolutionConfidence: 0.95,
  scope: "song",
  score: 0.8,
  status: "unseen",
  track: {
    ...makeTrack(
      "new-track",
      "New Track",
      artistId,
      "New Artist",
      ["dream pop"],
    ),
    features: { energy: 0.75, tempo: 120 },
  },
});

const matureProfile = (): RecommendationLearningProfile => ({
  ...createEmptyRecommendationLearningProfile(),
  sampleSize: 30,
  strategies: [
    { disliked: 3, impressions: 20, liked: 12, strategy: "song" },
    { disliked: 13, impressions: 20, liked: 2, strategy: "neighborhood" },
  ],
});

describe("recommendation learning", () => {
  it("keeps an equal split until both strategies have enough evidence", () => {
    expect(
      chooseRecommendationStrategyAllocation(
        createEmptyRecommendationLearningProfile(),
        () => 0.9,
      ),
    ).toEqual({ neighborhood: 5, song: 5 });
  });

  it("shifts mature runs toward the stronger strategy but preserves exploration", () => {
    expect(
      chooseRecommendationStrategyAllocation(matureProfile(), () => 0.9),
    ).toEqual({ neighborhood: 3, song: 7 });
    expect(
      chooseRecommendationStrategyAllocation(matureProfile(), () => 0.1),
    ).toEqual({ neighborhood: 5, song: 5 });
  });

  it("turns a shown card into a bounded learning snapshot", () => {
    const impression = recommendationImpressionFor(
      candidate(),
      2,
      [makeTrack("liked", "Liked", "artist-liked", "Liked Artist", [])],
    );

    expect(impression).toMatchObject({
      exploration: "balanced",
      rank: 2,
      recommendationId: "signed-recommendation",
      strategy: "song",
      trackId: "new-track",
      features: {
        energy: 0.75,
        energyFit: 0.8,
        knownArtist: false,
        model: "gemini-test",
        tempo: 120,
        tempoFit: 0.9,
      },
    });
  });

  it("boosts learned artists without overriding the base score", () => {
    const profile = {
      ...createEmptyRecommendationLearningProfile(),
      artistAffinities: { "artist-new": 1 },
      sampleSize: 4,
    };

    expect(learnedRecommendationBoost(candidate(), false, profile)).toBeGreaterThan(0);
    expect(candidate().score).toBe(0.8);
  });

  it("waits for impression persistence and handles transport rejection", async () => {
    const recordImpressions = vi
      .fn()
      .mockRejectedValue(new Error("Network interrupted"));

    const result = await persistRecommendationImpressionBatch(
      [candidate()],
      [],
      recordImpressions,
    );

    expect(recordImpressions).toHaveBeenCalledWith([
      expect.objectContaining({ trackId: "new-track" }),
    ]);
    expect(recordImpressions).toHaveBeenCalledTimes(2);
    expect(result.error).toBe("Could not record recommendation impressions.");
    expect(result.impressions).toHaveLength(1);
  });

  it("retries an idempotent impression write once", async () => {
    const recordImpressions = vi
      .fn()
      .mockRejectedValueOnce(new Error("Response interrupted"))
      .mockResolvedValueOnce({ success: true });

    const result = await persistRecommendationImpressionBatch(
      [candidate()],
      [],
      recordImpressions,
    );

    expect(recordImpressions).toHaveBeenCalledTimes(2);
    expect(result.error).toBeNull();
  });

  it("does not release a recommendation batch before persistence resolves", async () => {
    let releaseWrite: ((value: { success: boolean }) => void) | undefined;
    const recordImpressions = vi.fn(
      () =>
        new Promise<{ success: boolean }>((resolve) => {
          releaseWrite = resolve;
        }),
    );
    let settled = false;
    const pending = persistRecommendationImpressionBatch(
      [candidate()],
      [],
      recordImpressions,
    ).then((result) => {
      settled = true;
      return result;
    });

    await Promise.resolve();
    expect(settled).toBe(false);
    releaseWrite?.({ success: true });
    await expect(pending).resolves.toMatchObject({
      error: null,
      impressions: [expect.objectContaining({ trackId: "new-track" })],
    });
  });

  it("returns refreshed experiment stats with the persisted batch", async () => {
    const stats = [
      {
        disliked: 1,
        impressions: 20,
        liked: 4,
        likeRate: 0.8,
        positiveRate: 0.2,
        ratingRate: 0.25,
        strategy: "song" as const,
        total: 5,
      },
    ];

    await expect(
      persistRecommendationImpressionBatch(
        [candidate()],
        [],
        async () => ({ stats, success: true }),
      ),
    ).resolves.toMatchObject({ error: null, stats });
  });

  it("advances cached denominators when the stats refresh is unavailable", () => {
    const current = [
      {
        disliked: 1,
        impressions: 10,
        liked: 4,
        likeRate: 0.8,
        positiveRate: 0.4,
        ratingRate: 0.5,
        strategy: "song" as const,
        total: 5,
      },
    ];
    const impression = recommendationImpressionFor(candidate(), 0, []);
    if (!impression) throw new Error("Expected a recommendation impression.");

    expect(
      recommendationStatsAfterImpressions(current, [impression]),
    ).toContainEqual({
      disliked: 1,
      impressions: 11,
      liked: 4,
      likeRate: 0.8,
      positiveRate: 4 / 11,
      ratingRate: 5 / 11,
      strategy: "song",
      total: 5,
    });
  });
});
