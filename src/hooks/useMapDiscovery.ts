"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addTracksToPlaylistAction,
  createPlaylistAction,
  getMapDiscoveryCandidatesAction,
  saveTracksToLibraryAction,
} from "@/app/actions";
import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";
import type { SongGraph } from "@/lib/network/buildGraph";
import { createDiscoveryContext } from "@/lib/network/discoveryContext";
import {
  clearDiscoverySession,
  readDiscoverySession,
  rerankDiscoveryCandidates,
  writeDiscoverySession,
} from "@/lib/network/discoveryFeedback";
import { scoreDiscoveryCandidates } from "@/lib/network/scoreDiscoveryCandidates";
import type {
  ClusterProfile,
  CandidateSaveState,
  DiscoveryCandidate,
  DiscoveryEvent,
  DiscoveryEventType,
  DiscoveryScope,
  DiscoveryTrackSummary,
  ExplorationMode,
  ResolvedDiscoverySuggestion,
} from "@/types/network";

const DISCOVERY_PLAYLIST_KEY = "map_discovery_playlist_v1";

interface DiscoveryRequest {
  candidateSeed?: DiscoveryCandidate;
  cluster?: ClusterProfile | null;
  scope: DiscoveryScope;
  selectedTrackId?: string | null;
}

interface PlaylistReference {
  id: string;
  url?: string;
}

interface UseMapDiscoveryOptions {
  onCandidateSaved?: (track: EnrichedTrack) => void;
}

const toSummary = (track: EnrichedTrack): DiscoveryTrackSummary => ({
  artistIds: track.artists.map((artist) => artist.id),
  artistNames: track.artists.map((artist) => artist.name),
  genres: track.genres,
  id: track.id,
  name: track.name,
});

const loadPlaylistReference = (): PlaylistReference | null => {
  try {
    const serialized = window.localStorage.getItem(DISCOVERY_PLAYLIST_KEY);
    if (!serialized) return null;
    const value = JSON.parse(serialized) as Partial<PlaylistReference>;
    return typeof value.id === "string" && value.id
      ? { id: value.id, url: value.url }
      : null;
  } catch {
    return null;
  }
};

export const useMapDiscovery = (
  graph: SongGraph | null,
  likedTracks: EnrichedTrack[],
  { onCandidateSaved }: UseMapDiscoveryOptions = {},
) => {
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([]);
  const [dismissedTrackIds, setDismissedTrackIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<DiscoveryEvent[]>([]);
  const [exploration, setExploration] =
    useState<ExplorationMode>("balanced");
  const [hasRestored, setHasRestored] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playlistStates, setPlaylistStates] = useState<
    Record<string, "adding" | "added" | "error">
  >({});
  const [saveStates, setSaveStates] = useState<
    Record<string, CandidateSaveState>
  >({});
  const [summary, setSummary] = useState("");
  const eventSequence = useRef(0);
  const playlistRequests = useRef(new Set<string>());
  const requestVersion = useRef(0);
  const runningDiscovery = useRef<number | null>(null);
  const saveRequests = useRef(new Set<string>());

  useEffect(() => {
    const restored = readDiscoverySession();
    setCandidates(restored.candidates);
    setDismissedTrackIds(restored.dismissedTrackIds);
    setEvents(restored.events);
    setExploration(restored.exploration);
    setSummary(restored.summary);
    setHasRestored(true);
  }, []);

  useEffect(() => {
    if (!hasRestored) return;
    writeDiscoverySession({
      candidates,
      dismissedTrackIds,
      events,
      exploration,
      schemaVersion: 1,
      summary,
      updatedAt: Date.now(),
    });
  }, [
    candidates,
    dismissedTrackIds,
    events,
    exploration,
    hasRestored,
    summary,
  ]);

  useEffect(() => {
    if (!graph || !hasRestored) return;
    const likedIds = new Set(likedTracks.map((track) => track.id));
    const dismissedIds = new Set(dismissedTrackIds);

    setCandidates((current) => {
      let changed = false;
      const reconciled = current.flatMap((candidate) => {
        if (dismissedIds.has(candidate.track.id)) {
          changed = true;
          return [];
        }
        const anchors = candidate.anchors.filter((anchor) =>
          graph.hasNode(anchor.trackId),
        );
        const saved = likedIds.has(candidate.track.id);
        const mapped = saved || anchors.length > 0;
        const status = saved ? "saved" : candidate.status;
        const confidence = mapped ? candidate.confidence : "weak";
        if (
          anchors.length !== candidate.anchors.length ||
          mapped !== candidate.mapped ||
          status !== candidate.status ||
          confidence !== candidate.confidence
        ) {
          changed = true;
          return [{ ...candidate, anchors, confidence, mapped, status }];
        }
        return [candidate];
      });
      return changed ? reconciled : current;
    });
  }, [dismissedTrackIds, graph, hasRestored, likedTracks]);

  const eventFor = useCallback(
    (
      candidate: DiscoveryCandidate,
      type: DiscoveryEventType,
    ): DiscoveryEvent => ({
      artistIds: candidate.track.artists.map((artist) => artist.id),
      exploration,
      id: `${Date.now()}-${eventSequence.current++}-${candidate.track.id}`,
      recommendationId: candidate.recommendationId,
      scope: candidate.scope,
      timestamp: Date.now(),
      trackId: candidate.track.id,
      type,
    }),
    [exploration],
  );

  const recordEvent = useCallback(
    (candidate: DiscoveryCandidate, type: DiscoveryEventType) => {
      const event = eventFor(candidate, type);
      setEvents((current) => [...current, event].slice(-500));
    },
    [eventFor],
  );

  const discover = useCallback(
    async ({ candidateSeed, cluster, scope, selectedTrackId }: DiscoveryRequest) => {
      if (!graph || isLoading || runningDiscovery.current !== null) return;
      const version = requestVersion.current + 1;
      requestVersion.current = version;
      runningDiscovery.current = version;
      setIsLoading(true);
      setError(null);

      if (candidateSeed) recordEvent(candidateSeed, "more_like_candidate");

      try {
        let context = createDiscoveryContext({
          cluster,
          dismissedTrackIds,
          exploration,
          graph,
          scope,
          selectedTrackId,
          tracks: likedTracks,
        });

        if (candidateSeed) {
          const strongestLikedAnchor = candidateSeed.anchors[0]?.trackId;
          context = createDiscoveryContext({
            dismissedTrackIds,
            exploration,
            graph,
            scope: "neighborhood",
            selectedTrackId: strongestLikedAnchor,
            tracks: likedTracks,
          });
          context = {
            ...context,
            scope: "song",
            seedTracks: [toSummary(candidateSeed.track)],
            topGenres: candidateSeed.track.genres.slice(0, 8),
          };
        }

        const result = await getMapDiscoveryCandidatesAction(context);
        if (!result.success || !("suggestions" in result)) {
          throw new Error(result.error ?? "Discovery failed.");
        }
        const scored = scoreDiscoveryCandidates(
          result.suggestions as ResolvedDiscoverySuggestion[],
          likedTracks,
          context,
        );
        const ranked = rerankDiscoveryCandidates(
          scored,
          likedTracks,
          exploration,
          events,
        );
        if (ranked.length === 0) {
          throw new Error("No new Spotify matches survived validation.");
        }
        if (requestVersion.current === version) {
          setCandidates(ranked);
          setEvents((current) => [
            ...current,
            ...ranked.map((candidate) => eventFor(candidate, "candidate_shown")),
          ].slice(-500));
          setSummary(result.summary ?? "");
        }
      } catch (requestError) {
        if (requestVersion.current === version) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not find nearby discoveries.",
          );
        }
      } finally {
        if (runningDiscovery.current === version) {
          runningDiscovery.current = null;
        }
        if (requestVersion.current === version) setIsLoading(false);
      }
    },
    [
      dismissedTrackIds,
      eventFor,
      events,
      exploration,
      graph,
      isLoading,
      likedTracks,
      recordEvent,
    ],
  );

  const dismissCandidate = useCallback(
    (trackId: string) => {
      const candidate = candidates.find((item) => item.track.id === trackId);
      if (candidate) recordEvent(candidate, "candidate_dismissed");
      setCandidates((current) =>
        current.filter((item) => item.track.id !== trackId),
      );
      setDismissedTrackIds((current) =>
        current.includes(trackId) ? current : [...current, trackId].slice(-500),
      );
    },
    [candidates, recordEvent],
  );

  const addCandidateToPlaylist = useCallback(
    async (candidate: DiscoveryCandidate) => {
      if (playlistRequests.current.has(candidate.track.id)) return;
      playlistRequests.current.add(candidate.track.id);
      setPlaylistStates((current) => ({
        ...current,
        [candidate.track.id]: "adding",
      }));

      try {
        let playlist = loadPlaylistReference();
        if (!playlist) {
          const created = await createPlaylistAction(
            "Map Discoveries",
            "Songs discovered from the Spotify similarity map.",
            false,
          );
          if (!created.success || !created.data?.id) {
            throw new Error("Could not create the discovery playlist.");
          }
          playlist = {
            id: created.data.id,
            url: created.data.external_urls?.spotify,
          };
          window.localStorage.setItem(
            DISCOVERY_PLAYLIST_KEY,
            JSON.stringify(playlist),
          );
        }

        const added = await addTracksToPlaylistAction(playlist.id, [
          candidate.track.uri,
        ]);
        if (!added.success) throw new Error("Could not add the song to Spotify.");
        setPlaylistStates((current) => ({
          ...current,
          [candidate.track.id]: "added",
        }));
        recordEvent(candidate, "candidate_playlisted");
      } catch {
        setPlaylistStates((current) => ({
          ...current,
          [candidate.track.id]: "error",
        }));
      } finally {
        playlistRequests.current.delete(candidate.track.id);
      }
    },
    [recordEvent],
  );

  const saveCandidate = useCallback(
    async (candidate: DiscoveryCandidate) => {
      if (saveRequests.current.has(candidate.track.id)) return;
      saveRequests.current.add(candidate.track.id);
      setSaveStates((current) => ({
        ...current,
        [candidate.track.id]: "saving",
      }));
      try {
        const result = await saveTracksToLibraryAction([candidate.track.uri]);
        if (!result.success) {
          setSaveStates((current) => ({
            ...current,
            [candidate.track.id]: result.requiresReauthorization
              ? "reauthorize"
              : "error",
          }));
          return;
        }

        setSaveStates((current) => ({
          ...current,
          [candidate.track.id]: "saved",
        }));
        setCandidates((current) =>
          current.map((item) =>
            item.track.id === candidate.track.id
              ? { ...item, status: "saved" }
              : item,
          ),
        );
        recordEvent(candidate, "candidate_saved");
        onCandidateSaved?.({
          ...candidate.track,
          added_at: new Date().toISOString(),
        });
      } catch {
        setSaveStates((current) => ({
          ...current,
          [candidate.track.id]: "error",
        }));
      } finally {
        saveRequests.current.delete(candidate.track.id);
      }
    },
    [onCandidateSaved, recordEvent],
  );

  const previewCandidate = useCallback(
    (candidate: DiscoveryCandidate) => {
      setCandidates((current) =>
        current.map((item) =>
          item.track.id === candidate.track.id && item.status === "unseen"
            ? { ...item, status: "previewed" }
            : item,
        ),
      );
      recordEvent(candidate, "preview_started");
    },
    [recordEvent],
  );

  const selectCandidate = useCallback(
    (candidate: DiscoveryCandidate) => {
      recordEvent(candidate, "candidate_selected");
    },
    [recordEvent],
  );

  const changeExploration = useCallback(
    (mode: ExplorationMode) => {
      setExploration(mode);
      setCandidates((current) =>
        rerankDiscoveryCandidates(current, likedTracks, mode, events),
      );
    },
    [events, likedTracks],
  );

  const clearCandidates = useCallback(() => {
    requestVersion.current += 1;
    runningDiscovery.current = null;
    setCandidates([]);
    setError(null);
    setIsLoading(false);
    setSummary("");
  }, []);

  const resetFeedback = useCallback(() => {
    requestVersion.current += 1;
    runningDiscovery.current = null;
    clearDiscoverySession();
    setCandidates([]);
    setDismissedTrackIds([]);
    setError(null);
    setEvents([]);
    setExploration("balanced");
    setIsLoading(false);
    setPlaylistStates({});
    setSaveStates({});
    setSummary("");
  }, []);

  return {
    addCandidateToPlaylist,
    candidates,
    changeExploration,
    clearCandidates,
    discover,
    dismissCandidate,
    error,
    events,
    exploration,
    hasRestored,
    isLoading,
    playlistStates,
    previewCandidate,
    resetFeedback,
    saveCandidate,
    saveStates,
    selectCandidate,
    summary,
  };
};
