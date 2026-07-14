"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addTracksToPlaylistAction,
  createPlaylistAction,
  getMapDiscoveryCandidatesAction,
  getRecommendationFeedbackStatsAction,
  recordRecommendationFeedbackAction,
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
import { mixDiscoveryCandidates } from "@/lib/network/mixDiscoveryCandidates";
import { scoreDiscoveryCandidates } from "@/lib/network/scoreDiscoveryCandidates";
import type {
  CandidateSaveState,
  DiscoveryCandidate,
  DiscoveryEvent,
  DiscoveryEventType,
  ExplorationMode,
  RecommendationFeedback,
  RecommendationFeedbackState,
  RecommendationStrategy,
  RecommendationStrategyStats,
  ResolvedDiscoverySuggestion,
} from "@/types/network";

const DISCOVERY_PLAYLIST_KEY = "vibe_map_playlist_v2";

interface DiscoveryRequest {
  selectedTrackId?: string | null;
}

interface PlaylistReference {
  id: string;
  url?: string;
}

interface UseMapDiscoveryOptions {
  onCandidateSaved?: (track: EnrichedTrack) => void;
}

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
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackStates, setFeedbackStates] = useState<
    Record<string, RecommendationFeedbackState>
  >({});
  const [feedbackStats, setFeedbackStats] = useState<
    RecommendationStrategyStats[]
  >([]);
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
  const feedbackRequests = useRef(new Set<string>());
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
    let cancelled = false;
    void getRecommendationFeedbackStatsAction().then((result) => {
      if (!cancelled && result.success && result.stats) {
        setFeedbackStats(result.stats);
      }
    });
    return () => {
      cancelled = true;
    };
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
    async ({ selectedTrackId }: DiscoveryRequest) => {
      if (!graph || isLoading || runningDiscovery.current !== null) return;
      const version = requestVersion.current + 1;
      requestVersion.current = version;
      runningDiscovery.current = version;
      setIsLoading(true);
      setError(null);
      setFeedbackError(null);

      try {
        const contexts = (["song", "neighborhood"] as const).map((scope) =>
          createDiscoveryContext({
            dismissedTrackIds,
            exploration,
            graph,
            scope,
            selectedTrackId,
            tracks: likedTracks,
          }),
        );
        const runId = globalThis.crypto.randomUUID();
        const rankedByStrategy = await Promise.all(
          contexts.map(async (context) => {
            const result = await getMapDiscoveryCandidatesAction(context);
            if (!result.success || !("suggestions" in result)) {
              throw new Error(result.error ?? "Discovery failed.");
            }
            const scored = scoreDiscoveryCandidates(
              result.suggestions as ResolvedDiscoverySuggestion[],
              likedTracks,
              context,
            );
            return rerankDiscoveryCandidates(
              scored,
              likedTracks,
              exploration,
              events,
            )
              .slice(0, 5)
              .map((candidate) => ({
                ...candidate,
                recommendationId: `${runId}-${context.scope}-${candidate.track.id}`,
              }));
          }),
        );
        const ranked = mixDiscoveryCandidates(
          rankedByStrategy[0],
          rankedByStrategy[1],
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
          setFeedbackStates({});
          setSummary(
            `${ranked.length} recommendations mixed from song and neighborhood matches.`,
          );
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
    ],
  );

  const recordFeedback = useCallback(
    async (
      candidate: DiscoveryCandidate,
      feedback: RecommendationFeedback,
    ) => {
      if (
        (candidate.scope !== "song" && candidate.scope !== "neighborhood") ||
        feedbackRequests.current.has(candidate.recommendationId)
      ) {
        return;
      }
      const previousFeedback = candidate.feedback;
      feedbackRequests.current.add(candidate.recommendationId);
      setFeedbackError(null);
      setFeedbackStates((current) => ({
        ...current,
        [candidate.recommendationId]: "saving",
      }));
      setCandidates((current) =>
        current.map((item) =>
          item.recommendationId === candidate.recommendationId
            ? { ...item, feedback }
            : item,
        ),
      );

      try {
        const result = await recordRecommendationFeedbackAction({
          exploration,
          feedback,
          recommendationId: candidate.recommendationId,
          strategy: candidate.scope as RecommendationStrategy,
          trackId: candidate.track.id,
        });
        if (!result.success) {
          throw new Error(result.error ?? "Could not record feedback.");
        }
        setFeedbackStates((current) => ({
          ...current,
          [candidate.recommendationId]: "saved",
        }));
        if (result.stats) setFeedbackStats(result.stats);
        const event = eventFor(
          candidate,
          feedback === "up"
            ? "recommendation_liked"
            : "recommendation_disliked",
        );
        setEvents((current) => [
          ...current.filter(
            (item) =>
              item.recommendationId !== candidate.recommendationId ||
              (item.type !== "recommendation_liked" &&
                item.type !== "recommendation_disliked"),
          ),
          event,
        ].slice(-500));
      } catch (feedbackRequestError) {
        setCandidates((current) =>
          current.map((item) =>
            item.recommendationId === candidate.recommendationId
              ? { ...item, feedback: previousFeedback }
              : item,
          ),
        );
        setFeedbackStates((current) => ({
          ...current,
          [candidate.recommendationId]: "error",
        }));
        setFeedbackError(
          feedbackRequestError instanceof Error
            ? feedbackRequestError.message
            : "Could not record feedback.",
        );
      } finally {
        feedbackRequests.current.delete(candidate.recommendationId);
      }
    },
    [eventFor, exploration],
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
            "Vibe Map Playlist",
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
    setFeedbackError(null);
    setFeedbackStates({});
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
    setFeedbackError(null);
    setFeedbackStates({});
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
    feedbackError,
    feedbackStates,
    feedbackStats,
    hasRestored,
    isLoading,
    playlistStates,
    previewCandidate,
    recordFeedback,
    resetFeedback,
    saveCandidate,
    saveStates,
    selectCandidate,
    summary,
  };
};
