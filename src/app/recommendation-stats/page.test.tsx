import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  canViewRecommendationStats: vi.fn(),
  getRecommendationFeedbackDashboard: vi.fn(),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/recommendationFeedback", () => ({
  getRecommendationFeedbackDashboard:
    mocks.getRecommendationFeedbackDashboard,
}));
vi.mock("@/lib/recommendationStatsAccess", () => ({
  canViewRecommendationStats: mocks.canViewRecommendationStats,
}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));

import RecommendationStatsPage from "@/app/recommendation-stats/page";

describe("RecommendationStatsPage access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redirect.mockImplementation(() => {
      throw new Error("REDIRECT");
    });
    mocks.notFound.mockImplementation(() => {
      throw new Error("NOT_FOUND");
    });
    mocks.getRecommendationFeedbackDashboard.mockResolvedValue({
      daily: [],
      exploration: [],
      overview: {
        disliked: 0,
        liked: 0,
        likeRate: null,
        total: 0,
        uniqueUsers: 0,
        updatedAt: null,
      },
      strategies: [],
    });
  });

  it("redirects unauthenticated visitors before loading private data", async () => {
    mocks.auth.mockResolvedValue(null);

    await expect(RecommendationStatsPage()).rejects.toThrow("REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/login?redirectTo=/recommendation-stats",
    );
    expect(mocks.canViewRecommendationStats).not.toHaveBeenCalled();
    expect(mocks.getRecommendationFeedbackDashboard).not.toHaveBeenCalled();
  });

  it("returns not found for a signed-in non-owner before loading data", async () => {
    mocks.auth.mockResolvedValue({ spotify_user_id: "visitor-456" });
    mocks.canViewRecommendationStats.mockReturnValue(false);

    await expect(RecommendationStatsPage()).rejects.toThrow("NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.getRecommendationFeedbackDashboard).not.toHaveBeenCalled();
  });

  it("loads the dashboard only for the configured owner", async () => {
    mocks.auth.mockResolvedValue({ spotify_user_id: "owner-123" });
    mocks.canViewRecommendationStats.mockReturnValue(true);

    await expect(RecommendationStatsPage()).resolves.toBeTruthy();
    expect(mocks.getRecommendationFeedbackDashboard).toHaveBeenCalledOnce();
  });
});
