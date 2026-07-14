import { HeartPlus, ListPlus, MapPin, Play, RefreshCw, X } from "lucide-react";
import type {
  CandidateSaveState,
  DiscoveryCandidate,
} from "@/types/network";

interface DiscoveryTrayProps {
  candidates: DiscoveryCandidate[];
  error: string | null;
  isLoading: boolean;
  onAddToPlaylist: (candidate: DiscoveryCandidate) => void;
  onClear: () => void;
  onDismiss: (trackId: string) => void;
  onMoreLikeThis: (candidate: DiscoveryCandidate) => void;
  onPlay: (candidate: DiscoveryCandidate) => void | Promise<void>;
  onSelect: (candidate: DiscoveryCandidate) => void;
  onSave: (candidate: DiscoveryCandidate) => void;
  playlistStates: Record<string, "adding" | "added" | "error">;
  saveStates: Record<string, CandidateSaveState>;
  summary: string;
}

const confidenceLabel = (candidate: DiscoveryCandidate) =>
  candidate.mapped
    ? `${candidate.confidence} map match`
    : "weak map match";

export default function DiscoveryTray({
  candidates,
  error,
  isLoading,
  onAddToPlaylist,
  onClear,
  onDismiss,
  onMoreLikeThis,
  onPlay,
  onSelect,
  onSave,
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
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-full p-1 text-zinc-500 hover:bg-white/10 hover:text-white"
          aria-label={isLoading ? "Cancel discovery" : "Clear discoveries"}
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
        {candidates.map((candidate) => {
          const playlistState = playlistStates[candidate.track.id];
          const saveState = saveStates[candidate.track.id];
          const isSaved = candidate.status === "saved" || saveState === "saved";
          const imageUrl =
            candidate.track.album.images[1]?.url ??
            candidate.track.album.images[0]?.url;
          return (
            <article
              key={candidate.track.id}
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
                  <p
                    className={`mt-1 text-[10px] font-medium ${candidate.mapped ? "text-yellow-400" : "text-zinc-600"}`}
                  >
                    {isSaved ? "saved to Liked Songs" : confidenceLabel(candidate)}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
                {candidate.proposal.reason}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onPlay(candidate)}
                  className="inline-flex items-center gap-1 rounded-full bg-green-500 px-2 py-1 text-[10px] font-semibold text-black hover:bg-green-400"
                >
                  <Play className="h-3 w-3 fill-current" /> Play
                </button>
                <button
                  type="button"
                  onClick={() => onSave(candidate)}
                  disabled={
                    isSaved ||
                    saveState === "saving" ||
                    saveState === "reauthorize"
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/10 disabled:opacity-50"
                >
                  <HeartPlus className="h-3 w-3" />
                  {isSaved
                    ? "Saved"
                    : saveState === "saving"
                      ? "Saving…"
                      : saveState === "reauthorize"
                        ? "Sign in again"
                        : saveState === "error"
                          ? "Retry save"
                          : "Save"}
                </button>
                {candidate.mapped && (
                  <button
                    type="button"
                    onClick={() => onSelect(candidate)}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/10"
                  >
                    <MapPin className="h-3 w-3" /> Map
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onAddToPlaylist(candidate)}
                  disabled={playlistState === "adding" || playlistState === "added"}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/10 disabled:opacity-50"
                >
                  <ListPlus className="h-3 w-3" />
                  {playlistState === "added"
                    ? "Added"
                    : playlistState === "adding"
                      ? "Adding…"
                      : playlistState === "error"
                        ? "Retry playlist"
                        : "Playlist"}
                </button>
                <button
                  type="button"
                  onClick={() => onMoreLikeThis(candidate)}
                  disabled={!candidate.mapped}
                  className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/10 disabled:opacity-40"
                >
                  More like this
                </button>
                {!isSaved && (
                  <button
                    type="button"
                    onClick={() => onDismiss(candidate.track.id)}
                    className="rounded-full px-2 py-1 text-[10px] text-zinc-500 hover:bg-white/10 hover:text-white"
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
