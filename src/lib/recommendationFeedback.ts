import { neon } from "@neondatabase/serverless";
import type {
  ExplorationMode,
  RecommendationFeedback,
  RecommendationStrategy,
  RecommendationStrategyStats,
} from "@/types/network";

interface RecordRecommendationFeedbackInput {
  exploration: ExplorationMode;
  feedback: RecommendationFeedback;
  recommendationId: string;
  strategy: RecommendationStrategy;
  trackId: string;
  userId: string;
}

const getSql = () => {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!databaseUrl) {
    throw new Error("Recommendation feedback database is not configured.");
  }
  return neon(databaseUrl);
};

let feedbackTableReady: Promise<void> | null = null;

const ensureFeedbackTable = async () => {
  const sql = getSql();
  if (!feedbackTableReady) {
    feedbackTableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS recommendation_feedback (
          id BIGSERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          recommendation_id TEXT NOT NULL,
          track_id TEXT NOT NULL,
          strategy TEXT NOT NULL CHECK (strategy IN ('song', 'neighborhood')),
          exploration TEXT NOT NULL CHECK (exploration IN ('familiar', 'balanced', 'adventurous')),
          feedback SMALLINT NOT NULL CHECK (feedback IN (-1, 1)),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (user_id, recommendation_id)
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS recommendation_feedback_strategy_idx
        ON recommendation_feedback (strategy, feedback)
      `;
    })();
  }
  try {
    await feedbackTableReady;
  } catch (error) {
    feedbackTableReady = null;
    throw error;
  }
  return sql;
};

export const recordRecommendationFeedback = async ({
  exploration,
  feedback,
  recommendationId,
  strategy,
  trackId,
  userId,
}: RecordRecommendationFeedbackInput) => {
  const sql = await ensureFeedbackTable();
  const value = feedback === "up" ? 1 : -1;
  await sql`
    INSERT INTO recommendation_feedback (
      user_id,
      recommendation_id,
      track_id,
      strategy,
      exploration,
      feedback
    ) VALUES (
      ${userId},
      ${recommendationId},
      ${trackId},
      ${strategy},
      ${exploration},
      ${value}
    )
    ON CONFLICT (user_id, recommendation_id)
    DO UPDATE SET
      feedback = EXCLUDED.feedback,
      updated_at = NOW()
  `;
};

interface FeedbackAggregateRow {
  disliked: string | number;
  liked: string | number;
  strategy: RecommendationStrategy;
  total: string | number;
}

export interface RecommendationFeedbackOverview {
  disliked: number;
  liked: number;
  likeRate: number | null;
  total: number;
  uniqueUsers: number;
  updatedAt: string | null;
}

export interface ExplorationFeedbackStats {
  disliked: number;
  exploration: ExplorationMode;
  liked: number;
  likeRate: number | null;
  total: number;
}

export interface DailyFeedbackStats {
  date: string;
  disliked: number;
  liked: number;
  likeRate: number | null;
  strategy: RecommendationStrategy;
  total: number;
}

export interface RecommendationFeedbackDashboard {
  daily: DailyFeedbackStats[];
  exploration: ExplorationFeedbackStats[];
  overview: RecommendationFeedbackOverview;
  strategies: RecommendationStrategyStats[];
}

const emptyStats = (
  strategy: RecommendationStrategy,
): RecommendationStrategyStats => ({
  disliked: 0,
  liked: 0,
  likeRate: null,
  strategy,
  total: 0,
});

const strategyStatsFromRows = (
  rows: FeedbackAggregateRow[],
): RecommendationStrategyStats[] => {
  const byStrategy = new Map(rows.map((row) => [row.strategy, row]));

  return (["song", "neighborhood"] as const).map((strategy) => {
    const row = byStrategy.get(strategy);
    if (!row) return emptyStats(strategy);
    const total = Number(row.total);
    const liked = Number(row.liked);
    return {
      disliked: Number(row.disliked),
      liked,
      likeRate: total > 0 ? liked / total : null,
      strategy,
      total,
    };
  });
};

export const getRecommendationFeedbackStats = async (): Promise<
  RecommendationStrategyStats[]
> => {
  const sql = await ensureFeedbackTable();
  const rows = (await sql`
    SELECT
      strategy,
      COUNT(*)::INT AS total,
      COUNT(*) FILTER (WHERE feedback = 1)::INT AS liked,
      COUNT(*) FILTER (WHERE feedback = -1)::INT AS disliked
    FROM recommendation_feedback
    GROUP BY strategy
  `) as FeedbackAggregateRow[];
  return strategyStatsFromRows(rows);
};

interface OverviewRow {
  disliked: string | number;
  liked: string | number;
  total: string | number;
  unique_users: string | number;
  updated_at: Date | string | null;
}

interface ExplorationAggregateRow {
  disliked: string | number;
  exploration: ExplorationMode;
  liked: string | number;
  total: string | number;
}

interface DailyAggregateRow {
  date: string;
  disliked: string | number;
  liked: string | number;
  strategy: RecommendationStrategy;
  total: string | number;
}

const withLikeRate = <T extends { liked: number; total: number }>(value: T) => ({
  ...value,
  likeRate: value.total > 0 ? value.liked / value.total : null,
});

export const getRecommendationFeedbackDashboard = async (): Promise<
  RecommendationFeedbackDashboard
> => {
  const sql = await ensureFeedbackTable();
  const [strategyRows, overviewRows, explorationRows, dailyRows] =
    await sql.transaction(
      [
        sql`
          SELECT
            strategy,
            COUNT(*)::INT AS total,
            COUNT(*) FILTER (WHERE feedback = 1)::INT AS liked,
            COUNT(*) FILTER (WHERE feedback = -1)::INT AS disliked
          FROM recommendation_feedback
          GROUP BY strategy
        `,
        sql`
          SELECT
            COUNT(*)::INT AS total,
            COUNT(*) FILTER (WHERE feedback = 1)::INT AS liked,
            COUNT(*) FILTER (WHERE feedback = -1)::INT AS disliked,
            COUNT(DISTINCT user_id)::INT AS unique_users,
            MAX(updated_at) AS updated_at
          FROM recommendation_feedback
        `,
        sql`
          SELECT
            exploration,
            COUNT(*)::INT AS total,
            COUNT(*) FILTER (WHERE feedback = 1)::INT AS liked,
            COUNT(*) FILTER (WHERE feedback = -1)::INT AS disliked
          FROM recommendation_feedback
          GROUP BY exploration
          ORDER BY exploration
        `,
        sql`
          SELECT
            TO_CHAR(DATE_TRUNC('day', updated_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
            strategy,
            COUNT(*)::INT AS total,
            COUNT(*) FILTER (WHERE feedback = 1)::INT AS liked,
            COUNT(*) FILTER (WHERE feedback = -1)::INT AS disliked
          FROM recommendation_feedback
          WHERE updated_at >= NOW() - INTERVAL '30 days'
          GROUP BY DATE_TRUNC('day', updated_at AT TIME ZONE 'UTC'), strategy
          ORDER BY DATE_TRUNC('day', updated_at AT TIME ZONE 'UTC') DESC, strategy
        `,
      ],
      {
        isolationLevel: "RepeatableRead",
        readOnly: true,
      },
    );
  const overviewRow = (overviewRows as OverviewRow[])[0];
  const overviewTotal = Number(overviewRow?.total ?? 0);
  const overviewLiked = Number(overviewRow?.liked ?? 0);

  return {
    daily: (dailyRows as DailyAggregateRow[]).map((row) =>
      withLikeRate({
        date: row.date,
        disliked: Number(row.disliked),
        liked: Number(row.liked),
        strategy: row.strategy,
        total: Number(row.total),
      }),
    ),
    exploration: (explorationRows as ExplorationAggregateRow[]).map((row) =>
      withLikeRate({
        disliked: Number(row.disliked),
        exploration: row.exploration,
        liked: Number(row.liked),
        total: Number(row.total),
      }),
    ),
    overview: {
      disliked: Number(overviewRow?.disliked ?? 0),
      liked: overviewLiked,
      likeRate: overviewTotal > 0 ? overviewLiked / overviewTotal : null,
      total: overviewTotal,
      uniqueUsers: Number(overviewRow?.unique_users ?? 0),
      updatedAt: overviewRow?.updated_at
        ? new Date(overviewRow.updated_at).toISOString()
        : null,
    },
    strategies: strategyStatsFromRows(strategyRows as FeedbackAggregateRow[]),
  };
};
