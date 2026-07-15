import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRecommendationFeedbackToken } from "@/lib/recommendationFeedbackToken";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getRecommendationLearningProfile: vi.fn(),
  getRecommendationFeedbackStats: vi.fn(),
  recordRecommendationImpressions: vi.fn(),
  recordRecommendationFeedback: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/recommendationFeedback", () => ({
  getRecommendationLearningProfile: mocks.getRecommendationLearningProfile,
  getRecommendationFeedbackStats: mocks.getRecommendationFeedbackStats,
  recordRecommendationImpressions: mocks.recordRecommendationImpressions,
  recordRecommendationFeedback: mocks.recordRecommendationFeedback,
}));

import {
  recordRecommendationFeedbackAction,
  recordRecommendationImpressionsAction,
} from "@/app/actions";

describe("recordRecommendationFeedbackAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SPOTIFY_AUTH_SECRET", "test-feedback-signing-secret");
    mocks.auth.mockResolvedValue({ spotify_user_id: "owner-123" });
    mocks.getRecommendationFeedbackStats.mockResolvedValue([]);
    mocks.getRecommendationFeedbackStats.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const validInput = () => ({
    exploration: "balanced" as const,
    feedback: "up" as const,
    recommendationId: createRecommendationFeedbackToken({
      exploration: "balanced",
      strategy: "song",
      trackId: "track-123",
      userId: "owner-123",
    }),
    strategy: "song" as const,
    trackId: "track-123",
  });

  it("rejects fabricated and mismatched recommendation metadata", async () => {
    await expect(
      recordRecommendationFeedbackAction({
        ...validInput(),
        recommendationId: "fabricated-id",
      }),
    ).resolves.toEqual({
      error: "Invalid recommendation feedback.",
      success: false,
    });
    await expect(
      recordRecommendationFeedbackAction({
        ...validInput(),
        exploration: "adventurous",
      }),
    ).resolves.toEqual({
      error: "Invalid recommendation feedback.",
      success: false,
    });

    expect(mocks.recordRecommendationFeedback).not.toHaveBeenCalled();
  });

  it("persists metadata from a matching server-issued token", async () => {
    const input = validInput();

    await expect(recordRecommendationFeedbackAction(input)).resolves.toEqual({
      stats: [],
      success: true,
    });
    expect(mocks.recordRecommendationFeedback).toHaveBeenCalledWith({
      exploration: "balanced",
      feedback: "up",
      recommendationId: input.recommendationId,
      strategy: "song",
      trackId: "track-123",
      userId: "owner-123",
    });
  });

  it("reports success when feedback is saved but stats refresh fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.getRecommendationFeedbackStats.mockRejectedValueOnce(
      new Error("Stats unavailable"),
    );

    await expect(
      recordRecommendationFeedbackAction(validInput()),
    ).resolves.toEqual({ success: true });
    expect(mocks.recordRecommendationFeedback).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith(
      "Feedback saved, but stats refresh failed:",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });
});

describe("recordRecommendationImpressionsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SPOTIFY_AUTH_SECRET", "test-feedback-signing-secret");
    mocks.auth.mockResolvedValue({ spotify_user_id: "owner-123" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const validImpression = () => {
    const recommendationId = createRecommendationFeedbackToken({
      exploration: "balanced",
      strategy: "song",
      trackId: "track-123",
      userId: "owner-123",
    });
    return {
      exploration: "balanced" as const,
      features: {
        artistIds: ["artist-123"],
        artistNames: ["Candidate Artist"],
        energy: 0.75,
        energyFit: 0.8,
        genres: ["Dream Pop"],
        knownArtist: false,
        mapScore: 0.85,
        model: "gemini-test",
        promptVersion: "feedback-loop-v1",
        resolutionConfidence: 0.95,
        seedTrackIds: ["seed-track"],
        tempo: 120,
        tempoFit: 0.9,
        trackName: "Candidate Track",
      },
      rank: 0,
      recommendationId,
      strategy: "song" as const,
      trackId: "track-123",
    };
  };

  it("persists a sanitized impression bound to its signed recommendation", async () => {
    const impression = validImpression();

    await expect(
      recordRecommendationImpressionsAction([impression]),
    ).resolves.toEqual({ stats: [], success: true });
    expect(mocks.recordRecommendationImpressions).toHaveBeenCalledWith({
      impressions: [
        {
          ...impression,
          features: {
            ...impression.features,
            genres: ["dream pop"],
          },
        },
      ],
      userId: "owner-123",
    });
  });

  it("reports success when impressions are saved but stats refresh fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.getRecommendationFeedbackStats.mockRejectedValueOnce(
      new Error("Stats unavailable"),
    );

    await expect(
      recordRecommendationImpressionsAction([validImpression()]),
    ).resolves.toEqual({ success: true });
    expect(mocks.recordRecommendationImpressions).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith(
      "Recommendations saved, but stats refresh failed:",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it("rejects impression metadata that does not match the signed token", async () => {
    const impression = validImpression();

    await expect(
      recordRecommendationImpressionsAction([
        { ...impression, trackId: "different-track" },
      ]),
    ).resolves.toEqual({
      error: "Invalid recommendation impressions.",
      success: false,
    });
    expect(mocks.recordRecommendationImpressions).not.toHaveBeenCalled();
  });
});
