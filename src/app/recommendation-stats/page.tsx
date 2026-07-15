import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getRecommendationFeedbackDashboard,
  type DailyFeedbackStats,
} from "@/lib/recommendationFeedback";
import { canViewRecommendationStats } from "@/lib/recommendationStatsAccess";
import type { RecommendationStrategyStats } from "@/types/network";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description: "Private recommendation experiment results.",
  robots: {
    follow: false,
    index: false,
    nocache: true,
  },
  title: "Recommendation Stats",
};

const percentage = (rate: number | null) =>
  rate === null ? "—" : `${Math.round(rate * 100)}%`;

const strategyName = (strategy: RecommendationStrategyStats["strategy"]) =>
  strategy === "song" ? "Song seed" : "Neighborhood seed";

const explorationName = (exploration: string) =>
  `${exploration.slice(0, 1).toUpperCase()}${exploration.slice(1)}`;

const strategyForDay = (
  rows: DailyFeedbackStats[],
  strategy: RecommendationStrategyStats["strategy"],
) => rows.find((row) => row.strategy === strategy);

export default async function RecommendationStatsPage() {
  const session = await auth();
  if (!session?.spotify_user_id) {
    redirect("/login?redirectTo=/recommendation-stats");
  }
  if (
    !canViewRecommendationStats(
      session.spotify_user_id,
      process.env.RECOMMENDATION_STATS_SPOTIFY_USER_ID,
    )
  ) {
    notFound();
  }

  const dashboard = await getRecommendationFeedbackDashboard();
  const dates = Array.from(new Set(dashboard.daily.map((row) => row.date)));
  const ratedStrategies = dashboard.strategies.filter(
    (strategy) => strategy.impressions > 0 && strategy.positiveRate !== null,
  );
  const winner = [...ratedStrategies].sort(
    (left, right) =>
      (right.positiveRate ?? -1) - (left.positiveRate ?? -1) ||
      right.impressions - left.impressions,
  )[0];

  return (
    <main className="min-h-dvh bg-gradient-to-br from-zinc-950 via-black to-zinc-900 px-4 py-8 text-zinc-100 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-green-400">
              Owner-only · Live from Neon
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Recommendation experiment
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Compare song-seeded and neighborhood-seeded results. New users
              get an even split; enough feedback can shift future runs to 7/3,
              with regular 5/5 exploration runs preserved.
            </p>
          </div>
          <Link
            href="/"
            className="w-fit rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            Back to the vibe map
          </Link>
        </header>

        <section className="grid gap-3 py-6 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Impressions", dashboard.overview.impressions.toLocaleString()],
            ["Ratings", dashboard.overview.total.toLocaleString()],
            ["Rating rate", percentage(dashboard.overview.ratingRate)],
            ["Liked / shown", percentage(dashboard.overview.positiveRate)],
            ["Listeners", dashboard.overview.uniqueUsers.toLocaleString()],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
            >
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
                {value}
              </p>
            </div>
          ))}
        </section>

        <section aria-labelledby="strategy-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="strategy-heading" className="text-lg font-semibold">
                Which method is winning?
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                {winner
                  ? `${strategyName(winner.strategy)} currently produces the most likes per impression.`
                  : "Waiting for recommendation impressions and ratings."}
              </p>
            </div>
            {dashboard.overview.updatedAt && (
              <p className="text-xs text-zinc-600">
                Updated {new Date(dashboard.overview.updatedAt).toLocaleString("en", { timeZone: "UTC" })} UTC
              </p>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {dashboard.strategies.map((strategy) => (
              <article
                key={strategy.strategy}
                className="rounded-2xl border border-white/10 bg-black/40 p-5"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-medium text-zinc-200">
                    {strategyName(strategy.strategy)}
                  </h3>
                  <p className="text-3xl font-semibold tabular-nums text-green-400">
                    {percentage(strategy.positiveRate)}
                  </p>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-900">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{ width: `${(strategy.positiveRate ?? 0) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-zinc-600">
                  Likes per impression
                </p>
                <dl className="mt-4 grid grid-cols-5 gap-3 text-xs">
                  <div>
                    <dt className="text-zinc-600">Shown</dt>
                    <dd className="mt-1 tabular-nums text-zinc-300">
                      {strategy.impressions}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Ratings</dt>
                    <dd className="mt-1 tabular-nums text-zinc-300">
                      {strategy.total}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Rated</dt>
                    <dd className="mt-1 tabular-nums text-zinc-300">
                      {percentage(strategy.ratingRate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Liked</dt>
                    <dd className="mt-1 tabular-nums text-zinc-300">
                      {strategy.liked}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Disliked</dt>
                    <dd className="mt-1 tabular-nums text-zinc-300">
                      {strategy.disliked}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-lg font-semibold">By discovery range</h2>
            <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.04] text-xs text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Range</th>
                    <th className="px-4 py-3 text-right font-medium">Ratings</th>
                    <th className="px-4 py-3 text-right font-medium">Liked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {dashboard.exploration.map((row) => (
                    <tr key={row.exploration}>
                      <th className="px-4 py-3 font-medium text-zinc-300">
                        {explorationName(row.exploration)}
                      </th>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
                        {row.total}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
                        {percentage(row.likeRate)}
                      </td>
                    </tr>
                  ))}
                  {dashboard.exploration.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-zinc-600">
                        No feedback yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold">Latest rating updates</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Current ratings grouped by their most recent update in the last
              30 days.
            </p>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="bg-white/[0.04] text-xs text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">Song seed</th>
                    <th className="px-4 py-3 text-right font-medium">Neighborhood</th>
                    <th className="px-4 py-3 text-right font-medium">Ratings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {dates.map((date) => {
                    const rows = dashboard.daily.filter((row) => row.date === date);
                    const song = strategyForDay(rows, "song");
                    const neighborhood = strategyForDay(rows, "neighborhood");
                    return (
                      <tr key={date}>
                        <th className="px-4 py-3 font-medium text-zinc-300">
                          {date}
                        </th>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
                          {percentage(song?.likeRate ?? null)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
                          {percentage(neighborhood?.likeRate ?? null)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
                          {(song?.total ?? 0) + (neighborhood?.total ?? 0)}
                        </td>
                      </tr>
                    );
                  })}
                  {dates.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-zinc-600">
                        No rating updates in the last 30 days.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
