import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRecommendationFeedbackToken } from "@/lib/recommendationFeedbackToken";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getRecommendationFeedbackStats: vi.fn(),
  recordRecommendationFeedback: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/recommendationFeedback", () => ({
  getRecommendationFeedbackStats: mocks.getRecommendationFeedbackStats,
  recordRecommendationFeedback: mocks.recordRecommendationFeedback,
}));

import { recordRecommendationFeedbackAction } from "@/app/actions";

describe("recordRecommendationFeedbackAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SPOTIFY_AUTH_SECRET", "test-feedback-signing-secret");
    mocks.auth.mockResolvedValue({ spotify_user_id: "owner-123" });
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
});
