"use client";

import {
  ControlsContainer,
  FullScreenControl,
  SigmaContainer,
  useRegisterEvents,
  useSigma,
  ZoomControl,
} from "@react-sigma/core";
import { createNodeImageProgram } from "@sigma/node-image";
import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  drawDiscNodeHover,
  type NodeHoverDrawingFunction,
} from "sigma/rendering";
import { usePlayer } from "@/components/PlayerProvider";
import ClusterFocus from "@/components/network/ClusterFocus";
import DiscoveryControls from "@/components/network/DiscoveryControls";
import DiscoveryTray from "@/components/network/DiscoveryTray";
import GraphLoader from "@/components/network/GraphLoader";
import NeighborhoodHighlight from "@/components/network/NeighborhoodHighlight";
import SongInspector from "@/components/network/SongInspector";
import { useMapDiscovery } from "@/hooks/useMapDiscovery";
import { useSongGraph } from "@/hooks/useSongGraph";
import { buildPlaybackQueue } from "@/lib/network/buildPlaybackQueue";
import { buildPreviewGraph } from "@/lib/network/buildPreviewGraph";
import { placeCandidates } from "@/lib/network/placeCandidates";
import type { SongMapProps } from "@/components/network/SongMap";
import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";
import type {
  ClusterProfile,
  DiscoveryCandidate,
  SongGraphEdgeAttributes,
  SongGraphNodeAttributes,
} from "@/types/network";

const drawNodeHover: NodeHoverDrawingFunction<
  SongGraphNodeAttributes,
  SongGraphEdgeAttributes
> = (context, data, settings) => {
  drawDiscNodeHover(context, data, {
    ...settings,
    labelColor: { color: "#09090b" },
  });
};

const SIGMA_SETTINGS = {
  allowInvalidContainer: false,
  defaultEdgeColor: "#27272a",
  defaultNodeColor: "#71717a",
  defaultNodeType: "image",
  defaultDrawNodeHover: drawNodeHover,
  edgeColor: "default" as const,
  enableEdgeEvents: false,
  labelColor: { color: "#e4e4e7" },
  labelDensity: 0.08,
  labelFont: "var(--font-sans), ui-sans-serif, system-ui",
  labelRenderedSizeThreshold: 14,
  labelSize: 12,
  maxCameraRatio: 6,
  minCameraRatio: 0.03,
  nodeProgramClasses: {
    image: createNodeImageProgram({ padding: 0.1 }),
  },
  renderEdgeLabels: false,
  stagePadding: 32,
  zIndex: true,
};

interface MapEventsProps {
  onHover: (track: EnrichedTrack | null) => void;
  onSelect: (track: EnrichedTrack | null) => void;
  tracksById: Map<string, EnrichedTrack>;
}

function MapEvents({ onHover, onSelect, tracksById }: MapEventsProps) {
  const registerEvents = useRegisterEvents();
  const sigma = useSigma();

  useEffect(() => {
    registerEvents({
      clickNode: ({ node }) => onSelect(tracksById.get(node) ?? null),
      clickStage: () => onSelect(null),
      enterNode: ({ node }) => {
        sigma.getContainer().style.cursor = "pointer";
        onHover(tracksById.get(node) ?? null);
      },
      leaveNode: () => {
        sigma.getContainer().style.cursor = "default";
        onHover(null);
      },
    });

    return () => {
      sigma.getContainer().style.cursor = "default";
    };
  }, [onHover, onSelect, registerEvents, sigma, tracksById]);

  return null;
}

export default function SongMapClient({
  libraryProgress,
  onCandidateSaved,
  onDiscoveryBusyChange,
  onPlaySong,
  songs,
}: SongMapProps) {
  const [hoveredTrack, setHoveredTrack] = useState<EnrichedTrack | null>(null);
  const pendingDiscoveryTrackId = useRef<string | null>(null);
  const runningDiscoveryTrackId = useRef<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<EnrichedTrack | null>(null);
  const candidatePlaybackRequests = useRef(0);
  const [isCandidatePlaybackPending, setIsCandidatePlaybackPending] =
    useState(false);
  const [selectedCluster, setSelectedCluster] = useState<ClusterProfile | null>(
    null,
  );
  const { currentTrack, isPaused, playTrack, queueTrack, togglePlay } =
    usePlayer();
  const previewGraph = useMemo(() => buildPreviewGraph(songs), [songs]);
  const {
    clusters,
    error: graphError,
    graph: similarityGraph,
    progress,
    stage,
    stats,
  } = useSongGraph(songs);
  const discoveryGraph = similarityGraph ?? (graphError ? previewGraph : null);
  const discovery = useMapDiscovery(discoveryGraph, songs, {
    onCandidateSaved,
  });
  const { discover, hasRestored } = discovery;
  const isDiscoveryBusy =
    discovery.isLoading ||
    discovery.isFeedbackPending ||
    discovery.isMutationPending ||
    isCandidatePlaybackPending;

  useEffect(() => {
    onDiscoveryBusyChange?.(isDiscoveryBusy);
  }, [isDiscoveryBusy, onDiscoveryBusyChange]);

  useEffect(
    () => () => {
      onDiscoveryBusyChange?.(false);
    },
    [onDiscoveryBusyChange],
  );

  useEffect(() => {
    if (!isDiscoveryBusy) return;
    const preventNavigation = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventNavigation);
    return () => {
      window.removeEventListener("beforeunload", preventNavigation);
    };
  }, [isDiscoveryBusy]);
  const startDiscovery = useCallback(
    (selectedTrackId: string) => {
      if (runningDiscoveryTrackId.current) {
        if (runningDiscoveryTrackId.current !== selectedTrackId) {
          pendingDiscoveryTrackId.current = selectedTrackId;
        }
        return;
      }

      pendingDiscoveryTrackId.current = null;
      const request = discover({ selectedTrackId });
      if (!request) {
        pendingDiscoveryTrackId.current = selectedTrackId;
        return;
      }

      runningDiscoveryTrackId.current = selectedTrackId;
      void request.finally(() => {
        if (runningDiscoveryTrackId.current === selectedTrackId) {
          runningDiscoveryTrackId.current = null;
        }
      });
    },
    [discover],
  );
  useEffect(() => {
    const selectedTrackId = pendingDiscoveryTrackId.current;
    if (!selectedTrackId || !discoveryGraph || !hasRestored || isDiscoveryBusy) {
      return;
    }

    startDiscovery(selectedTrackId);
  }, [discoveryGraph, hasRestored, isDiscoveryBusy, startDiscovery]);
  const graph = useMemo(
    () =>
      discoveryGraph
        ? placeCandidates(discoveryGraph, discovery.candidates)
        : previewGraph,
    [discovery.candidates, discoveryGraph, previewGraph],
  );
  const candidateById = useMemo(
    () =>
      new Map(
        discovery.candidates
          .filter((candidate) => candidate.status !== "saved")
          .map((candidate) => [candidate.track.id, candidate]),
      ),
    [discovery.candidates],
  );
  const mappedCandidateTracks = useMemo(
    () =>
      discovery.candidates
        .filter((candidate) => candidate.mapped)
        .map((candidate) => candidate.track),
    [discovery.candidates],
  );
  const mappedDiscoveryCount = discovery.candidates.filter(
    (candidate) => candidate.mapped && candidate.status !== "saved",
  ).length;
  const tracksById = useMemo(
    () =>
      new Map(
        [...songs, ...mappedCandidateTracks].map((track) => [track.id, track]),
      ),
    [mappedCandidateTracks, songs],
  );
  const selectMapTrack = useCallback(
    (track: EnrichedTrack | null) => {
      setSelectedTrack(track);
      pendingDiscoveryTrackId.current = null;
      if (!track) return;

      setSelectedCluster(null);
      if (candidateById.has(track.id)) return;
      if (runningDiscoveryTrackId.current) {
        if (runningDiscoveryTrackId.current !== track.id) {
          pendingDiscoveryTrackId.current = track.id;
        }
        return;
      }

      if (discoveryGraph && hasRestored && !isDiscoveryBusy) {
        startDiscovery(track.id);
      } else {
        pendingDiscoveryTrackId.current = track.id;
      }
    },
    [
      candidateById,
      discoveryGraph,
      hasRestored,
      isDiscoveryBusy,
      startDiscovery,
    ],
  );
  const selectableTracks = useMemo(
    () =>
      Array.from(tracksById.values()).sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    [tracksById],
  );
  const validHoveredTrack =
    hoveredTrack && tracksById.has(hoveredTrack.id) ? hoveredTrack : null;
  const validSelectedTrack =
    selectedTrack && tracksById.has(selectedTrack.id) ? selectedTrack : null;
  const normalizedLibraryProgress = Math.max(
    0,
    Math.min(100, Math.round(libraryProgress)),
  );

  if (songs.length === 0) {
    return (
      <div
        className="flex h-dvh w-full items-center justify-center bg-gradient-to-br from-zinc-950 via-black to-zinc-900 px-6"
        role="status"
      >
        <div className="w-full max-w-xs">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-zinc-400">Loading your liked songs…</span>
            <span className="tabular-nums text-zinc-500">
              {normalizedLibraryProgress}%
            </span>
          </div>
          <div
            aria-label="Liked songs loading progress"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={normalizedLibraryProgress}
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-green-500 transition-[width] duration-300"
              style={{ width: `${normalizedLibraryProgress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  const activeTrack = validHoveredTrack ?? validSelectedTrack;
  const focusNodeId = validHoveredTrack?.id ?? validSelectedTrack?.id ?? null;
  const activeCluster = activeTrack
    ? clusters.find(
        (cluster) =>
          graph.hasNode(activeTrack.id) &&
          graph.getNodeAttribute(activeTrack.id, "clusterId") === cluster.id,
      )
    : undefined;
  const selectedCandidate = validSelectedTrack
    ? candidateById.get(validSelectedTrack.id)
    : undefined;
  const playDiscoveryCandidate = async (candidate: DiscoveryCandidate) => {
    const playbackUris = buildPlaybackQueue(
      discovery.candidates.map((item) => item.track),
      candidate.track.id,
    );

    candidatePlaybackRequests.current += 1;
    setIsCandidatePlaybackPending(true);
    try {
      await playTrack(candidate.track.uri, playbackUris.slice(1));
      discovery.previewCandidate(candidate);
      return true;
    } catch (playbackError) {
      console.error(
        "Could not start the Nearby discoveries queue",
        playbackError,
      );
      return false;
    } finally {
      candidatePlaybackRequests.current -= 1;
      if (candidatePlaybackRequests.current === 0) {
        setIsCandidatePlaybackPending(false);
      }
    }
  };

  return (
    <div
      className="song-map relative h-dvh w-full overflow-hidden bg-gradient-to-br from-zinc-950 via-black to-zinc-900"
      aria-label={`Interactive map of ${songs.length} liked songs${mappedDiscoveryCount > 0 ? ` and ${mappedDiscoveryCount} discoveries` : ""}`}
      aria-describedby="song-map-instructions"
      role="region"
    >
      <SigmaContainer graph={graph} settings={SIGMA_SETTINGS}>
        <MapEvents
          onHover={setHoveredTrack}
          onSelect={selectMapTrack}
          tracksById={tracksById}
        />
        <NeighborhoodHighlight focusNodeId={focusNodeId} />
        <ClusterFocus cluster={selectedCluster} />
        <ControlsContainer position="bottom-right">
          <ZoomControl />
          <FullScreenControl />
        </ControlsContainer>
      </SigmaContainer>

      <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-xs text-zinc-300 backdrop-blur-md">
        {stats
          ? `${stats.nodeCount.toLocaleString()} songs · ${stats.edgeCount.toLocaleString()} relationships · ${stats.neighborhoodCount} neighborhoods${stats.isolatedNodeCount > 0 ? ` · ${stats.isolatedNodeCount} islands` : ""}`
          : `${graph.order.toLocaleString()} liked songs · scroll to zoom`}
      </div>

      {!similarityGraph && (
        <GraphLoader error={graphError} progress={progress} stage={stage} />
      )}

      <DiscoveryControls
        eventCount={discovery.events.length}
        exploration={discovery.exploration}
        hasRestored={discovery.hasRestored}
        isLoading={isDiscoveryBusy}
        onChange={discovery.changeExploration}
        onReset={() => {
          discovery.resetFeedback();
          if (selectedCandidate) selectMapTrack(null);
        }}
      />

      <p id="song-map-instructions" className="sr-only">
        Pan and zoom the map with a pointer, or use the song picker to select a
        track with the keyboard. Selecting a liked song starts discovery and
        exposes playback controls.
      </p>

      {stats && (
        <p className="sr-only">
          {stats.sameArtistEdgeCount} of {stats.edgeCount} relationships connect
          songs sharing an artist. Map distance is approximate.
        </p>
      )}

      <label className="absolute right-3 top-3 z-10">
        <span className="sr-only">Choose a song on the map</span>
        <select
          aria-label="Choose a song on the map"
          className="max-w-52 rounded-full border border-white/10 bg-black/75 px-3 py-1.5 text-xs text-zinc-200 shadow-lg backdrop-blur-md focus:border-green-500 focus:outline-none"
          value={validSelectedTrack?.id ?? ""}
          onChange={(event) => {
            const track = tracksById.get(event.target.value) ?? null;
            selectMapTrack(track);
          }}
        >
          <option value="">Choose a song…</option>
          {selectableTracks.map((song) => (
            <option key={song.id} value={song.id}>
              {candidateById.has(song.id) ? "New: " : ""}
              {song.name} — {song.artists.map((artist) => artist.name).join(", ")}
            </option>
          ))}
        </select>
      </label>

      {similarityGraph && (
        <label className="absolute right-3 top-12 z-10">
          <span className="sr-only">Choose a musical neighborhood</span>
          <select
            aria-label="Choose a musical neighborhood"
            className="max-w-52 rounded-full border border-white/10 bg-black/75 px-3 py-1.5 text-xs text-zinc-200 shadow-lg backdrop-blur-md focus:border-green-500 focus:outline-none"
            value={selectedCluster?.id ?? ""}
            onChange={(event) => {
              setHoveredTrack(null);
              pendingDiscoveryTrackId.current = null;
              setSelectedTrack(null);
              setSelectedCluster(
                clusters.find((cluster) => cluster.id === event.target.value) ??
                  null,
              );
            }}
          >
            <option value="">Jump to a neighborhood…</option>
            {clusters
              .filter((cluster) => cluster.nodeIds.length > 1)
              .map((cluster) => (
                <option key={cluster.id} value={cluster.id}>
                  {cluster.label} ({cluster.nodeIds.length})
                </option>
              ))}
          </select>
        </label>
      )}

      {activeTrack && (
        <SongInspector
          activeTrack={activeTrack}
          candidate={selectedCandidate}
          candidateSaveState={
            selectedCandidate
              ? discovery.saveStates[selectedCandidate.track.id]
              : undefined
          }
          cluster={activeCluster}
          isSelected={Boolean(
            validSelectedTrack && activeTrack.id === validSelectedTrack.id,
          )}
          isDiscovering={isDiscoveryBusy}
          onAddCandidateToPlaylist={discovery.addCandidateToPlaylist}
          onClear={() => selectMapTrack(null)}
          onDismissCandidate={(trackId) => {
            discovery.dismissCandidate(trackId);
            if (selectedTrack?.id === trackId) selectMapTrack(null);
          }}
          onPlaySong={
            onPlaySong || selectedCandidate
              ? async (track) => {
                  const candidate = candidateById.get(track.id);
                  if (candidate) return playDiscoveryCandidate(candidate);
                  return onPlaySong ? onPlaySong(track) : false;
                }
              : undefined
          }
          onQueueSong={async (track) => {
            await queueTrack(track.uri);
          }}
          onSaveCandidate={discovery.saveCandidate}
        />
      )}

      {selectedCluster && !activeTrack && (
        <div className="absolute bottom-3 left-3 z-10 max-w-sm rounded-xl border border-white/10 bg-black/85 p-3 shadow-xl backdrop-blur-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">
                {selectedCluster.label}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {selectedCluster.nodeIds.length} liked songs in this neighborhood
              </p>
              {selectedCluster.topGenres.length > 0 && (
                <p className="mt-2 text-[11px] text-zinc-400">
                  {selectedCluster.topGenres
                    .slice(0, 4)
                    .map((genre) => genre.name)
                    .join(" · ")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedCluster(null)}
              className="rounded-full p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close neighborhood profile"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <DiscoveryTray
        candidates={discovery.candidates}
        currentTrackUri={currentTrack?.uri}
        error={discovery.error}
        feedbackError={discovery.feedbackError}
        feedbackStates={discovery.feedbackStates}
        feedbackStats={discovery.feedbackStats}
        isPlaybackPaused={isPaused}
        isLoading={discovery.isLoading || isCandidatePlaybackPending}
        onAddToPlaylist={discovery.addCandidateToPlaylist}
        onClear={() => {
          discovery.clearCandidates();
          if (selectedCandidate) selectMapTrack(null);
        }}
        onDismiss={(trackId) => {
          discovery.dismissCandidate(trackId);
          if (selectedTrack?.id === trackId) selectMapTrack(null);
        }}
        onFeedback={discovery.recordFeedback}
        onPlay={async (candidate) => {
          await playDiscoveryCandidate(candidate);
        }}
        onSave={discovery.saveCandidate}
        onSelect={(candidate) => {
          discovery.selectCandidate(candidate);
          pendingDiscoveryTrackId.current = null;
          setSelectedCluster(null);
          setSelectedTrack(candidate.track);
        }}
        playlistStates={discovery.playlistStates}
        saveStates={discovery.saveStates}
        summary={discovery.summary}
        onTogglePlayback={togglePlay}
      />
    </div>
  );
}
