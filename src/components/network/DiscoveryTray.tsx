import {
  HeartPlus,
  ListPlus,
  MapPin,
  Pause,
  Play,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import type {
  CandidateSaveState,
  DiscoveryCandidate,
  RecommendationFeedback,
  RecommendationFeedbackState,
  RecommendationStrategyStats,
} from "@/types/network";

interface DiscoveryTrayProps {
  candidates: DiscoveryCandidate[];
  currentTrackUri?: string;
  error: string | null;
  feedbackError: string | null;
  feedbackStates: Record<string, RecommendationFeedbackState>;
  feedbackStats: RecommendationStrategyStats[];
  isPlaybackPaused: boolean;
  isLoading: boolean;
  onAddToPlaylist: (candidate: DiscoveryCandidate) => void;
  onClear: () => void;
  onDismiss: (trackId: string) => void;
  onFeedback: (
    candidate: DiscoveryCandidate,
    feedback: RecommendationFeedback,
  ) => void;
  onPlay: (candidate: DiscoveryCandidate) => void | Promise<void>;
  onSelect: (candidate: DiscoveryCandidate) => void;
  onSave: (candidate: DiscoveryCandidate) => void;
  onTogglePlayback: () => void;
  playlistStates: Record<string, "adding" | "added" | "error">;
  saveStates: Record<string, CandidateSaveState>;
  summary: string;
}

const statsLabel = (stats: RecommendationStrategyStats | undefined) => {
  if (!stats || stats.likeRate === null) return "No ratings yet";
  return stats.impressions > 0
    ? `${Math.round(stats.likeRate * 100)}% liked · ${stats.total}/${stats.impressions} rated`
    : `${Math.round(stats.likeRate * 100)}% liked (${stats.total} ratings)`;
};

export default function DiscoveryTray({
  candidates,
  currentTrackUri,
  error,
  feedbackError,
  feedbackStates,
  feedbackStats,
  isPlaybackPaused,
  isLoading,
  onAddToPlaylist,
  onClear,
  onDismiss,
  onFeedback,
  onPlay,
  onSelect,
  onSave,
  onTogglePlayback,
  playlistStates,
  saveStates,
  summary,
}: DiscoveryTrayProps) {
  if (!isLoading && !error && candidates.length === 0) return null;

  return (
    <aside
      aria-label="Nearby discoveries"
      className="absolute bottom-3 right-14 top-24 z-20 flex w-[min(22rem,calc(100%-4.5rem))] flex-col overflow-hidden rounded-xl border border-white/10 bg-black/90 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/10 p-3">
        <div>
          <p className="text-sm font-semibold text-white">Nearby discoveries</p>
          {summary && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
              {summary}
            </p>
          )}
          {feedbackStats.length > 0 && (
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
              Song seed: {statsLabel(feedbackStats.find((item) => item.strategy === "song"))}
              <span aria-hidden="true"> · </span>
              Neighborhood: {statsLabel(feedbackStats.find((item) => item.strategy === "neighborhood"))}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={isLoading}
          className="rounded-full p-1 text-zinc-500 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={isLoading ? "Discovery in progress" : "Clear discoveries"}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {isLoading && (
          <div role="status" className="flex items-center gap-2 p-3 text-xs text-zinc-400">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Finding and validating Spotify tracks…
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-red-950/40 p-3 text-xs text-red-300">
            {error}
          </p>
        )}
        {feedbackError && (
          <p role="alert" className="rounded-lg bg-red-950/40 p-3 text-xs text-red-300">
            {feedbackError}
          </p>
        )}
        {candidates.map((candidate) => {
          const feedbackState = feedbackStates[candidate.recommendationId];
          const isCurrentTrack = currentTrackUri === candidate.track.uri;
          const isPlaying = isCurrentTrack && !isPlaybackPaused;
          const playlistState = playlistStates[candidate.track.id];
          const saveState = saveStates[candidate.track.id];
          const isSaved = candidate.status === "saved" || saveState === "saved";
          const imageUrl =
            candidate.track.album.images[1]?.url ??
            candidate.track.album.images[0]?.url;
          return (
            <article
              key={candidate.recommendationId}
              className="rounded-lg border border-white/10 bg-zinc-950/80 p-2.5"
            >
              <div className="flex gap-2.5">
                <div
                  role="img"
                  aria-label={`${candidate.track.album.name} cover`}
                  className="h-11 w-11 shrink-0 rounded-md bg-zinc-800 bg-cover bg-center"
                  style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white">
                    {candidate.track.name}
                  </p>
                  <p className="truncate text-[11px] text-zinc-500">
                    {candidate.track.artists.map((artist) => artist.name).join(", ")}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
                {candidate.proposal.reason}
              </p>
              {(candidate.scope === "song" || candidate.scope === "neighborhood") && (
                <div className="mt-2 rounded-lg bg-white/[0.03] p-2">
                  <p className="text-[11px] text-zinc-300">
                    Do you like this song recommendation?
                  </p>
                  <div className="mt-1.5 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => onFeedback(candidate, "up")}
                      disabled={isLoading || feedbackState === "saving"}
                      aria-label={`Like ${candidate.track.name} recommendation`}
                      aria-pressed={candidate.feedback === "up"}
                      className={`rounded-full border p-1.5 transition-colors disabled:opacity-50 ${candidate.feedback === "up" ? "border-green-400 bg-green-400/20 text-green-300" : "border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white"}`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onFeedback(candidate, "down")}
                      disabled={isLoading || feedbackState === "saving"}
                      aria-label={`Dislike ${candidate.track.name} recommendation`}
                      aria-pressed={candidate.feedback === "down"}
                      className={`rounded-full border p-1.5 transition-colors disabled:opacity-50 ${candidate.feedback === "down" ? "border-red-400 bg-red-400/20 text-red-300" : "border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white"}`}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                    {feedbackState === "saving" && (
                      <span className="self-center text-[10px] text-zinc-500">
                        Saving…
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    isCurrentTrack ? onTogglePlayback() : onPlay(candidate)
                  }
                  disabled={isLoading}
                  className="inline-flex items-center gap-1 rounded-full bg-green-500 px-2 py-1 text-[10px] font-semibold text-black hover:bg-green-400 disabled:opacity-50"
                >
                  {isPlaying ? (
                    <Pause className="h-3 w-3 fill-current" />
                  ) : (
                    <Play className="h-3 w-3 fill-current" />
                  )}
                  {isPlaying ? "Pause" : "Play"}
                </button>
                <button
                  type="button"
                  onClick={() => onSave(candidate)}
                  disabled={
                    isLoading ||
                    isSaved ||
                    saveState === "saving" ||
                    saveState === "reauthorize"
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/10 disabled:opacity-50"
                >
                  <HeartPlus className="h-3 w-3" />
                  {isSaved
                    ? "In Liked Songs"
                    : saveState === "saving"
                      ? "Adding…"
                      : saveState === "reauthorize"
                        ? "Sign in again"
                        : saveState === "error"
                          ? "Retry Liked songs"
                          : "Liked songs"}
                </button>
                {candidate.mapped && (
                  <button
                    type="button"
                    onClick={() => onSelect(candidate)}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/10 disabled:opacity-50"
                  >
                    <MapPin className="h-3 w-3" /> Map
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onAddToPlaylist(candidate)}
                  disabled={
                    isLoading ||
                    playlistState === "adding" ||
                    playlistState === "added"
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/10 disabled:opacity-50"
                >
                  <ListPlus className="h-3 w-3" />
                  {playlistState === "added"
                    ? "In Endless Songs Playlist"
                    : playlistState === "adding"
                      ? "Adding…"
                      : playlistState === "error"
                        ? "Retry Endless Songs Playlist"
                        : "Endless Songs Playlist"}
                </button>
                {!isSaved && (
                  <button
                    type="button"
                    onClick={() => onDismiss(candidate.track.id)}
                    disabled={isLoading}
                    className="rounded-full px-2 py-1 text-[10px] text-zinc-500 hover:bg-white/10 hover:text-white disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                )}
              </div>
              {saveState === "reauthorize" && (
                <p className="mt-2 text-[10px] text-amber-300">
                  Sign out and back in once to grant Spotify save access.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </aside>
  );
}
