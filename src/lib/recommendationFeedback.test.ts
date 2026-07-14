import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = vi.fn();
  const sql = Object.assign(vi.fn(), { transaction });
  return { neon: vi.fn(() => sql), sql, transaction };
});

vi.mock("@neondatabase/serverless", () => ({ neon: mocks.neon }));

describe("getRecommendationFeedbackDashboard", () => {
  let getRecommendationFeedbackDashboard: typeof import("@/lib/recommendationFeedback")["getRecommendationFeedbackDashboard"];

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("DATABASE_URL", "postgresql://example.invalid/test");
    mocks.sql.mockImplementation((strings: TemplateStringsArray) => ({
      query: strings.join("?"),
    }));
    ({ getRecommendationFeedbackDashboard } = await import(
      "@/lib/recommendationFeedback"
    ));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("maps all transaction result sets and fills a missing strategy", async () => {
    mocks.transaction.mockResolvedValue([
      [{ strategy: "song", total: "4", liked: "3", disliked: "1" }],
      [
        {
          total: "4",
          liked: "3",
          disliked: "1",
          unique_users: "2",
          updated_at: "2026-07-14T10:00:00.000Z",
        },
      ],
      [
        {
          exploration: "balanced",
          total: "4",
          liked: "3",
          disliked: "1",
        },
      ],
      [
        {
          date: "2026-07-14",
          strategy: "song",
          total: "2",
          liked: "1",
          disliked: "1",
        },
      ],
    ]);

    await expect(getRecommendationFeedbackDashboard()).resolves.toEqual({
      daily: [
        {
          date: "2026-07-14",
          disliked: 1,
          liked: 1,
          likeRate: 0.5,
          strategy: "song",
          total: 2,
        },
      ],
      exploration: [
        {
          disliked: 1,
          exploration: "balanced",
          liked: 3,
          likeRate: 0.75,
          total: 4,
        },
      ],
      overview: {
        disliked: 1,
        liked: 3,
        likeRate: 0.75,
        total: 4,
        uniqueUsers: 2,
        updatedAt: "2026-07-14T10:00:00.000Z",
      },
      strategies: [
        {
          disliked: 1,
          liked: 3,
          likeRate: 0.75,
          strategy: "song",
          total: 4,
        },
        {
          disliked: 0,
          liked: 0,
          likeRate: null,
          strategy: "neighborhood",
          total: 0,
        },
      ],
    });
    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Array),
      { isolationLevel: "RepeatableRead", readOnly: true },
    );
    expect(mocks.transaction.mock.calls[0][0]).toHaveLength(4);
    const queries = mocks.transaction.mock.calls[0][0].map(
      ({ query }: { query: string }) => query.replace(/\s+/g, " ").trim(),
    );
    expect(queries[0]).toContain("GROUP BY strategy");
    expect(queries[1]).toContain("COUNT(DISTINCT user_id)");
    expect(queries[2]).toContain("GROUP BY exploration");
    expect(queries[3]).toContain("updated_at >= NOW() - INTERVAL '30 days'");
  });

  it("returns stable empty dashboard values", async () => {
    mocks.transaction.mockResolvedValue([
      [],
      [
        {
          total: 0,
          liked: 0,
          disliked: 0,
          unique_users: 0,
          updated_at: null,
        },
      ],
      [],
      [],
    ]);

    await expect(getRecommendationFeedbackDashboard()).resolves.toMatchObject({
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
      strategies: [
        { strategy: "song", total: 0, likeRate: null },
        { strategy: "neighborhood", total: 0, likeRate: null },
      ],
    });
  });
});
