import { neon } from "@neondatabase/serverless";
import type {
  ExplorationMode,
  RecommendationImpression,
  RecommendationImpressionFeatures,
  RecommendationFeedback,
  RecommendationLearningProfile,
  RecommendationStrategy,
  RecommendationStrategyLearningStats,
  RecommendationStrategyStats,
} from "@/types/network";
import { createEmptyRecommendationLearningProfile } from "@/lib/network/recommendationLearning";

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

let recommendationTablesReady: Promise<void> | null = null;

const ensureRecommendationTables = async () => {
  const sql = getSql();
  if (!recommendationTablesReady) {
    recommendationTablesReady = (async () => {
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
      await sql`
        CREATE INDEX IF NOT EXISTS recommendation_feedback_user_updated_idx
        ON recommendation_feedback (user_id, updated_at DESC)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS recommendation_impressions (
          id BIGSERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          recommendation_id TEXT NOT NULL,
          track_id TEXT NOT NULL,
          strategy TEXT NOT NULL CHECK (strategy IN ('song', 'neighborhood')),
          exploration TEXT NOT NULL CHECK (exploration IN ('familiar', 'balanced', 'adventurous')),
          rank SMALLINT NOT NULL CHECK (rank >= 0 AND rank < 10),
          features JSONB NOT NULL,
          shown_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (user_id, recommendation_id)
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS recommendation_impressions_user_strategy_idx
        ON recommendation_impressions (user_id, strategy, shown_at DESC)
      `;
    })();
  }
  try {
    await recommendationTablesReady;
  } catch (error) {
    recommendationTablesReady = null;
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
  const sql = await ensureRecommendationTables();
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

interface RecordRecommendationImpressionsInput {
  impressions: RecommendationImpression[];
  userId: string;
}

export const recordRecommendationImpressions = async ({
  impressions,
  userId,
}: RecordRecommendationImpressionsInput) => {
  if (impressions.length === 0) return;
  const sql = await ensureRecommendationTables();
  await sql.transaction(
    impressions.map((impression) => sql`
      INSERT INTO recommendation_impressions (
        user_id,
        recommendation_id,
        track_id,
        strategy,
        exploration,
        rank,
        features
      ) VALUES (
        ${userId},
        ${impression.recommendationId},
        ${impression.trackId},
        ${impression.strategy},
        ${impression.exploration},
        ${impression.rank},
        ${JSON.stringify(impression.features)}::jsonb
      )
      ON CONFLICT (user_id, recommendation_id)
      DO UPDATE SET
        rank = EXCLUDED.rank,
        features = EXCLUDED.features
    `),
  );
};

export interface RecommendationLearningFeedbackRow {
  feedback: number | string;
  features: unknown;
  updated_at: Date | string;
}

export interface RecommendationLearningStrategyRow {
  disliked: number | string;
  liked: number | string;
  strategy: RecommendationStrategy;
}

export interface RecommendationLearningImpressionRow {
  impressions: number | string;
  strategy: RecommendationStrategy;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const asStringArray = (value: unknown, limit: number) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, limit)
    : [];

const asNullableNumber = (
  value: unknown,
  minimum: number,
  maximum: number,
) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= minimum &&
  value <= maximum
    ? value
    : null;

const parseImpressionFeatures = (
  value: unknown,
): RecommendationImpressionFeatures | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const artistIds = asStringArray(record.artistIds, 5);
  const artistNames = asStringArray(record.artistNames, 5);
  if (
    artistIds.length === 0 ||
    artistNames.length === 0 ||
    typeof record.knownArtist !== "boolean" ||
    typeof record.trackName !== "string"
  ) {
    return null;
  }
  return {
    artistIds,
    artistNames,
    energy: asNullableNumber(record.energy, 0, 1),
    energyFit: asNullableNumber(record.energyFit, 0, 1),
    genres: asStringArray(record.genres, 10).map((genre) =>
      genre.toLowerCase(),
    ),
    knownArtist: record.knownArtist,
    mapScore: asNullableNumber(record.mapScore, 0, 1) ?? 0,
    model: typeof record.model === "string" ? record.model.slice(0, 120) : "unknown",
    promptVersion:
      typeof record.promptVersion === "string"
        ? record.promptVersion.slice(0, 120)
        : "unknown",
    resolutionConfidence:
      asNullableNumber(record.resolutionConfidence, 0, 1) ?? 0,
    seedTrackIds: asStringArray(record.seedTrackIds, 6),
    tempo: asNullableNumber(record.tempo, 0, 400),
    tempoFit: asNullableNumber(record.tempoFit, 0, 1),
    trackName: record.trackName.trim().slice(0, 180),
  };
};

interface AffinityAggregate {
  score: number;
  weight: number;
}

const addAffinity = (
  affinities: Map<string, AffinityAggregate>,
  key: string,
  reward: number,
  decay: number,
) => {
  const current = affinities.get(key) ?? { score: 0, weight: 0 };
  current.score += reward * decay;
  current.weight += decay;
  affinities.set(key, current);
};

const normalizedAffinities = (values: Map<string, AffinityAggregate>) =>
  Object.fromEntries(
    Array.from(values.entries())
      .map(([key, value]) => [
        key,
        clamp(value.weight > 0 ? value.score / value.weight : 0, -1, 1),
      ] as const)
      .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
      .slice(0, 40),
  );

const topAffinityKeys = (
  affinities: Record<string, number>,
  direction: "positive" | "negative",
) =>
  Object.entries(affinities)
    .filter(([, score]) =>
      direction === "positive" ? score >= 0.1 : score <= -0.1,
    )
    .sort((left, right) =>
      direction === "positive" ? right[1] - left[1] : left[1] - right[1],
    )
    .slice(0, 8)
    .map(([key]) => key);

const strategyLearningStats = (
  ratingRows: RecommendationLearningStrategyRow[],
  impressionRows: RecommendationLearningImpressionRow[],
): RecommendationStrategyLearningStats[] =>
  (["song", "neighborhood"] as const).map((strategy) => {
    const ratings = ratingRows.find((row) => row.strategy === strategy);
    const impressions = impressionRows.find((row) => row.strategy === strategy);
    return {
      disliked: Number(ratings?.disliked ?? 0),
      impressions: Number(impressions?.impressions ?? 0),
      liked: Number(ratings?.liked ?? 0),
      strategy,
    };
  });

export const buildRecommendationLearningProfile = (
  feedbackRows: RecommendationLearningFeedbackRow[],
  ratingRows: RecommendationLearningStrategyRow[],
  impressionRows: RecommendationLearningImpressionRow[],
  now = Date.now(),
): RecommendationLearningProfile => {
  if (feedbackRows.length === 0) {
    return {
      ...createEmptyRecommendationLearningProfile(),
      strategies: strategyLearningStats(ratingRows, impressionRows),
    };
  }

  const artistAffinities = new Map<string, AffinityAggregate>();
  const artistNames = new Map<string, string>();
  const genreAffinities = new Map<string, AffinityAggregate>();
  let energyFitScore = 0;
  let energyFitWeight = 0;
  let noveltyScore = 0;
  let noveltyWeight = 0;
  let tempoFitScore = 0;
  let tempoFitWeight = 0;
  let sampleSize = 0;

  feedbackRows.forEach((row) => {
    const features = parseImpressionFeatures(row.features);
    const numericFeedback = Number(row.feedback);
    if (!features || (numericFeedback !== 1 && numericFeedback !== -1)) return;
    const timestamp = new Date(row.updated_at).getTime();
    const ageDays = Number.isFinite(timestamp)
      ? Math.max(0, now - timestamp) / 86_400_000
      : 0;
    const decay = Math.exp(-ageDays / 90);
    sampleSize += 1;

    features.genres.forEach((genre) =>
      addAffinity(genreAffinities, genre, numericFeedback, decay),
    );
    features.artistIds.forEach((artistId, index) => {
      addAffinity(artistAffinities, artistId, numericFeedback, decay);
      const name = features.artistNames[index];
      if (name) artistNames.set(artistId, name);
    });

    if (features.tempoFit !== null) {
      tempoFitScore +=
        numericFeedback * (features.tempoFit - 0.5) * 2 * decay;
      tempoFitWeight += decay;
    }
    if (features.energyFit !== null) {
      energyFitScore +=
        numericFeedback * (features.energyFit - 0.5) * 2 * decay;
      energyFitWeight += decay;
    }
    noveltyScore +=
      numericFeedback * (features.knownArtist ? -1 : 1) * decay;
    noveltyWeight += decay;
  });

  const normalizedArtists = normalizedAffinities(artistAffinities);
  const normalizedGenres = normalizedAffinities(genreAffinities);
  const artistNameRecord = Object.fromEntries(
    Object.keys(normalizedArtists).flatMap((artistId) => {
      const name = artistNames.get(artistId);
      return name ? [[artistId, name]] : [];
    }),
  );
  const preferredArtistIds = topAffinityKeys(normalizedArtists, "positive");
  const avoidedArtistIds = topAffinityKeys(normalizedArtists, "negative");

  return {
    artistAffinities: normalizedArtists,
    artistNames: artistNameRecord,
    avoidedArtists: avoidedArtistIds
      .map((id) => artistNameRecord[id])
      .filter(Boolean),
    avoidedGenres: topAffinityKeys(normalizedGenres, "negative"),
    energyFitWeight: clamp(
      energyFitWeight > 0 ? energyFitScore / energyFitWeight : 0,
      -1,
      1,
    ),
    genreAffinities: normalizedGenres,
    noveltyWeight: clamp(
      noveltyWeight > 0 ? noveltyScore / noveltyWeight : 0,
      -1,
      1,
    ),
    preferredArtists: preferredArtistIds
      .map((id) => artistNameRecord[id])
      .filter(Boolean),
    preferredGenres: topAffinityKeys(normalizedGenres, "positive"),
    sampleSize,
    strategies: strategyLearningStats(ratingRows, impressionRows),
    tempoFitWeight: clamp(
      tempoFitWeight > 0 ? tempoFitScore / tempoFitWeight : 0,
      -1,
      1,
    ),
  };
};

export const getRecommendationLearningProfile = async (
  userId: string,
): Promise<RecommendationLearningProfile> => {
  const sql = await ensureRecommendationTables();
  const [feedbackRows, ratingRows, impressionRows] = await sql.transaction(
    [
      sql`
        SELECT
          f.feedback,
          f.updated_at,
          i.features
        FROM recommendation_feedback f
        INNER JOIN recommendation_impressions i
          ON i.user_id = f.user_id
          AND i.recommendation_id = f.recommendation_id
        WHERE f.user_id = ${userId}
          AND f.updated_at >= NOW() - INTERVAL '180 days'
        ORDER BY f.updated_at DESC
        LIMIT 200
      `,
      sql`
        SELECT
          strategy,
          COUNT(*) FILTER (WHERE feedback = 1)::INT AS liked,
          COUNT(*) FILTER (WHERE feedback = -1)::INT AS disliked
        FROM recommendation_feedback
        WHERE user_id = ${userId}
          AND updated_at >= NOW() - INTERVAL '180 days'
        GROUP BY strategy
      `,
      sql`
        SELECT
          strategy,
          COUNT(*)::INT AS impressions
        FROM (
          SELECT user_id, recommendation_id, strategy
          FROM recommendation_impressions
          WHERE user_id = ${userId}
            AND shown_at >= NOW() - INTERVAL '180 days'
          UNION
          SELECT user_id, recommendation_id, strategy
          FROM recommendation_feedback
          WHERE user_id = ${userId}
            AND updated_at >= NOW() - INTERVAL '180 days'
        ) recommendation_exposures
        GROUP BY strategy
      `,
    ],
    { isolationLevel: "RepeatableRead", readOnly: true },
  );
  return buildRecommendationLearningProfile(
    feedbackRows as RecommendationLearningFeedbackRow[],
    ratingRows as RecommendationLearningStrategyRow[],
    impressionRows as RecommendationLearningImpressionRow[],
  );
};

interface FeedbackAggregateRow {
  disliked: string | number;
  liked: string | number;
  strategy: RecommendationStrategy;
  total: string | number;
}

export interface RecommendationFeedbackOverview {
  disliked: number;
  impressions: number;
  liked: number;
  likeRate: number | null;
  positiveRate: number | null;
  ratingRate: number | null;
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

interface ImpressionAggregateRow {
  impressions: string | number;
  strategy: RecommendationStrategy;
}

const strategyStatsFromRows = (
  rows: FeedbackAggregateRow[],
  impressionRows: ImpressionAggregateRow[] = [],
): RecommendationStrategyStats[] => {
  const byStrategy = new Map(rows.map((row) => [row.strategy, row]));
  const impressionsByStrategy = new Map(
    impressionRows.map((row) => [row.strategy, Number(row.impressions)]),
  );

  return (["song", "neighborhood"] as const).map((strategy) => {
    const row = byStrategy.get(strategy);
    const total = Number(row?.total ?? 0);
    const liked = Number(row?.liked ?? 0);
    const impressions = impressionsByStrategy.get(strategy) ?? 0;
    return {
      disliked: Number(row?.disliked ?? 0),
      impressions,
      liked,
      likeRate: total > 0 ? liked / total : null,
      positiveRate: impressions > 0 ? liked / impressions : null,
      ratingRate: impressions > 0 ? total / impressions : null,
      strategy,
      total,
    };
  });
};

export const getRecommendationFeedbackStats = async (): Promise<
  RecommendationStrategyStats[]
> => {
  const sql = await ensureRecommendationTables();
  const [rows, impressionRows] = await sql.transaction(
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
        SELECT strategy, COUNT(*)::INT AS impressions
        FROM (
          SELECT user_id, recommendation_id, strategy
          FROM recommendation_impressions
          UNION
          SELECT user_id, recommendation_id, strategy
          FROM recommendation_feedback
        ) recommendation_exposures
        GROUP BY strategy
      `,
    ],
    { isolationLevel: "RepeatableRead", readOnly: true },
  );
  return strategyStatsFromRows(
    rows as FeedbackAggregateRow[],
    impressionRows as ImpressionAggregateRow[],
  );
};

interface OverviewRow {
  disliked: string | number;
  liked: string | number;
  total: string | number;
  unique_users: string | number;
  updated_at: Date | string | null;
}

interface ImpressionOverviewRow {
  impressions: string | number;
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
  const sql = await ensureRecommendationTables();
  const [
    strategyRows,
    overviewRows,
    explorationRows,
    dailyRows,
    impressionStrategyRows,
    impressionOverviewRows,
  ] =
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
        sql`
          SELECT strategy, COUNT(*)::INT AS impressions
          FROM (
            SELECT user_id, recommendation_id, strategy
            FROM recommendation_impressions
            UNION
            SELECT user_id, recommendation_id, strategy
            FROM recommendation_feedback
          ) recommendation_exposures
          GROUP BY strategy
        `,
        sql`
          SELECT COUNT(*)::INT AS impressions
          FROM (
            SELECT user_id, recommendation_id
            FROM recommendation_impressions
            UNION
            SELECT user_id, recommendation_id
            FROM recommendation_feedback
          ) recommendation_exposures
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
  const overviewImpressions = Number(
    (impressionOverviewRows as ImpressionOverviewRow[])[0]?.impressions ?? 0,
  );

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
      impressions: overviewImpressions,
      liked: overviewLiked,
      likeRate: overviewTotal > 0 ? overviewLiked / overviewTotal : null,
      positiveRate:
        overviewImpressions > 0 ? overviewLiked / overviewImpressions : null,
      ratingRate:
        overviewImpressions > 0 ? overviewTotal / overviewImpressions : null,
      total: overviewTotal,
      uniqueUsers: Number(overviewRow?.unique_users ?? 0),
      updatedAt: overviewRow?.updated_at
        ? new Date(overviewRow.updated_at).toISOString()
        : null,
    },
    strategies: strategyStatsFromRows(
      strategyRows as FeedbackAggregateRow[],
      impressionStrategyRows as ImpressionAggregateRow[],
    ),
  };
};
