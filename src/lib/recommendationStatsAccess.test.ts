import { describe, expect, it } from "vitest";
import { canViewRecommendationStats } from "@/lib/recommendationStatsAccess";

describe("canViewRecommendationStats", () => {
  it("allows the configured Spotify owner", () => {
    expect(canViewRecommendationStats("owner-123", " owner-123 ")).toBe(true);
  });

  it("denies a different signed-in Spotify account", () => {
    expect(canViewRecommendationStats("visitor-456", "owner-123")).toBe(false);
  });

  it("fails closed when the owner allowlist is not configured", () => {
    expect(canViewRecommendationStats("owner-123", undefined)).toBe(false);
  });
});
