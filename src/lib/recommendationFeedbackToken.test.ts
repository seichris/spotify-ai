import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRecommendationFeedbackToken,
  verifyRecommendationFeedbackToken,
} from "@/lib/recommendationFeedbackToken";

describe("recommendation feedback tokens", () => {
  beforeEach(() => {
    vi.stubEnv("SPOTIFY_AUTH_SECRET", "test-feedback-signing-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips server-issued recommendation metadata", () => {
    const claims = {
      exploration: "balanced" as const,
      strategy: "song" as const,
      trackId: "track-123",
      userId: "owner-123",
    };

    const token = createRecommendationFeedbackToken(claims);

    expect(token.length).toBeLessThanOrEqual(240);
    expect(verifyRecommendationFeedbackToken(token)).toEqual(claims);
  });

  it("rejects fabricated and tampered recommendation IDs", () => {
    const token = createRecommendationFeedbackToken({
      exploration: "adventurous",
      strategy: "neighborhood",
      trackId: "track-456",
      userId: "owner-123",
    });
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    expect(verifyRecommendationFeedbackToken("fabricated-id")).toBeNull();
    expect(verifyRecommendationFeedbackToken(tampered)).toBeNull();
  });
});
