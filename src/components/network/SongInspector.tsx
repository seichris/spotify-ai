import { HeartPlus, ListPlus, Play, Sparkles, X } from "lucide-react";
import type Graph from "graphology";
import SimilarityExplanation from "@/components/network/SimilarityExplanation";
import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";
import type {
  ClusterProfile,
  CandidateSaveState,
  DiscoveryCandidate,
  SongGraphEdgeAttributes,
  SongGraphNodeAttributes,
} from "@/types/network";

interface SongInspectorProps {
  activeTrack: EnrichedTrack;
  candidate?: DiscoveryCandidate;
  candidateSaveState?: CandidateSaveState;
  cluster?: ClusterProfile;
  graph: Graph<SongGraphNodeAttributes, SongGraphEdgeAttributes>;
  isSelected: boolean;
  isDiscovering?: boolean;
  onAddCandidateToPlaylist?: (candidate: DiscoveryCandidate) => void;
  onClear: () => void;
  onDismissCandidate?: (trackId: string) => void;
  onDiscover?: () => void;
  onPlaySong?: (track: EnrichedTrack) => boolean | Promise<boolean>;
  onSaveCandidate?: (candidate: DiscoveryCandidate) => void;
  tracksById: Map<string, EnrichedTrack>;
}

export default function SongInspector({
  activeTrack,
  candidate,
  candidateSaveState,
  cluster,
  graph,
  isSelected,
  isDiscovering,
  onAddCandidateToPlaylist,
  onClear,
  onDismissCandidate,
  onDiscover,
  onPlaySong,
  onSaveCandidate,
  tracksById,
}: SongInspectorProps) {
  return (
    <div className="absolute bottom-3 left-3 right-16 z-10 max-h-[55%] max-w-md overflow-y-auto rounded-xl border border-white/10 bg-black/85 p-3 shadow-xl backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {activeTrack.name}
          </p>
          <p className="truncate text-xs text-zinc-400">
            {activeTrack.artists.map((artist) => artist.name).join(", ")}
          </p>
          {cluster && (
            <p
              className="mt-1 text-[11px] font-medium"
              style={{ color: cluster.color }}
            >
              {cluster.label}
            </p>
          )}
          {candidate && (
            <p className="mt-1 text-[11px] font-medium text-yellow-400">
              New candidate · {candidate.confidence} confidence
            </p>
          )}
          {activeTrack.genres.length > 0 && (
            <p className="mt-1 truncate text-[11px] text-zinc-500">
              {activeTrack.genres.slice(0, 3).join(" · ")}
            </p>
          )}
        </div>
        {isSelected && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Clear selected song"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isSelected && (
        <SimilarityExplanation
          graph={graph}
          track={activeTrack}
          tracksById={tracksById}
        />
      )}

      {candidate && (
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
          {candidate.proposal.reason}
        </p>
      )}

      {isSelected && (
        <div className="mt-3 flex flex-wrap gap-2">
          {onPlaySong && (
            <button
              type="button"
              onClick={() => onPlaySong(activeTrack)}
              disabled={Boolean(candidate && isDiscovering)}
              className="inline-flex items-center gap-2 rounded-full bg-green-500 px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-green-400 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Play song
            </button>
          )}
          {!candidate && onDiscover && (
            <button
              type="button"
              onClick={onDiscover}
              disabled={isDiscovering}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/10 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" /> Discover 10 new songs
            </button>
          )}
          {candidate && (
            <>
              {onSaveCandidate && (
                <button
                  type="button"
                  onClick={() => onSaveCandidate(candidate)}
                  disabled={
                    isDiscovering ||
                    candidateSaveState === "saving" ||
                    candidateSaveState === "saved" ||
                    candidateSaveState === "reauthorize"
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/10 disabled:opacity-50"
                >
                  <HeartPlus className="h-3.5 w-3.5" />
                  {candidateSaveState === "saving"
                    ? "Adding…"
                    : candidateSaveState === "saved"
                      ? "In Liked Songs"
                      : candidateSaveState === "reauthorize"
                        ? "Sign in again"
                        : candidateSaveState === "error"
                          ? "Retry Liked songs"
                          : "Liked songs"}
                </button>
              )}
              {onAddCandidateToPlaylist && (
                <button
                  type="button"
                  onClick={() => onAddCandidateToPlaylist(candidate)}
                  disabled={isDiscovering}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/10 disabled:opacity-50"
                >
                  <ListPlus className="h-3.5 w-3.5" /> Endless Songs Playlist
                </button>
              )}
              {onDismissCandidate && (
                <button
                  type="button"
                  onClick={() => onDismissCandidate(candidate.track.id)}
                  disabled={isDiscovering}
                  className="rounded-full px-3 py-1.5 text-xs text-zinc-500 hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  Dismiss
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
