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

const emptyStats = (
  strategy: RecommendationStrategy,
): RecommendationStrategyStats => ({
  disliked: 0,
  liked: 0,
  likeRate: null,
  strategy,
  total: 0,
});

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
