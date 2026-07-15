import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

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
        impressions: 0,
        liked: 0,
        likeRate: null,
        positiveRate: null,
        ratingRate: null,
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

  it("does not declare a strategy winner before anyone rates a song", async () => {
    mocks.auth.mockResolvedValue({ spotify_user_id: "owner-123" });
    mocks.canViewRecommendationStats.mockReturnValue(true);
    mocks.getRecommendationFeedbackDashboard.mockResolvedValue({
      daily: [],
      exploration: [],
      overview: {
        disliked: 0,
        impressions: 10,
        liked: 0,
        likeRate: null,
        positiveRate: 0,
        ratingRate: 0,
        total: 0,
        uniqueUsers: 0,
        updatedAt: null,
      },
      strategies: [
        {
          disliked: 0,
          impressions: 5,
          liked: 0,
          likeRate: null,
          positiveRate: 0,
          ratingRate: 0,
          strategy: "song",
          total: 0,
        },
        {
          disliked: 0,
          impressions: 5,
          liked: 0,
          likeRate: null,
          positiveRate: 0,
          ratingRate: 0,
          strategy: "neighborhood",
          total: 0,
        },
      ],
    });

    const html = renderToStaticMarkup(await RecommendationStatsPage());

    expect(html).toContain("Waiting for recommendation impressions and ratings.");
    expect(html).not.toContain("currently produces the most likes per impression");
  });

  it("does not declare a winner when the strategies are tied", async () => {
    mocks.auth.mockResolvedValue({ spotify_user_id: "owner-123" });
    mocks.canViewRecommendationStats.mockReturnValue(true);
    mocks.getRecommendationFeedbackDashboard.mockResolvedValue({
      daily: [],
      exploration: [],
      overview: {
        disliked: 8,
        impressions: 20,
        liked: 2,
        likeRate: 0.2,
        positiveRate: 0.1,
        ratingRate: 0.5,
        total: 10,
        uniqueUsers: 1,
        updatedAt: null,
      },
      strategies: [
        {
          disliked: 4,
          impressions: 10,
          liked: 1,
          likeRate: 0.2,
          positiveRate: 0.1,
          ratingRate: 0.5,
          strategy: "song",
          total: 5,
        },
        {
          disliked: 4,
          impressions: 10,
          liked: 1,
          likeRate: 0.2,
          positiveRate: 0.1,
          ratingRate: 0.5,
          strategy: "neighborhood",
          total: 5,
        },
      ],
    });

    const html = renderToStaticMarkup(await RecommendationStatsPage());

    expect(html).toContain("No clear leader yet; the strategies are tied.");
    expect(html).not.toContain("currently produces the most likes per impression");
  });
});
