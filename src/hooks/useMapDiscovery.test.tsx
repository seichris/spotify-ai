// @vitest-environment jsdom

import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMapDiscovery } from "@/hooks/useMapDiscovery";
import { buildPreviewGraph } from "@/lib/network/buildPreviewGraph";
import { makeTrack } from "@/lib/network/__tests__/fixtures";
import type { DiscoveryCandidate } from "@/types/network";

const mocks = vi.hoisted(() => ({
  addTracksToPlaylistAction: vi.fn(),
  createPlaylistAction: vi.fn(),
  discoverMixedCandidates: vi.fn(),
  getMapDiscoveryCandidatesAction: vi.fn(),
  getRecommendationFeedbackStatsAction: vi.fn(),
  getRecommendationLearningProfileAction: vi.fn(),
  recordRecommendationFeedbackAction: vi.fn(),
  recordRecommendationImpressionsAction: vi.fn(),
  saveTracksToLibraryAction: vi.fn(),
}));

vi.mock("@/app/actions", () => ({
  addTracksToPlaylistAction: mocks.addTracksToPlaylistAction,
  createPlaylistAction: mocks.createPlaylistAction,
  getMapDiscoveryCandidatesAction: mocks.getMapDiscoveryCandidatesAction,
  getRecommendationFeedbackStatsAction:
    mocks.getRecommendationFeedbackStatsAction,
  getRecommendationLearningProfileAction:
    mocks.getRecommendationLearningProfileAction,
  recordRecommendationFeedbackAction:
    mocks.recordRecommendationFeedbackAction,
  recordRecommendationImpressionsAction:
    mocks.recordRecommendationImpressionsAction,
  saveTracksToLibraryAction: mocks.saveTracksToLibraryAction,
}));

vi.mock("@/lib/network/discoverMixedCandidates", () => ({
  discoverMixedCandidates: mocks.discoverMixedCandidates,
}));

const likedTrack = makeTrack(
  "liked-a",
  "Liked A",
  "artist-a",
  "Artist A",
  ["dream pop"],
);
const candidateTrack = makeTrack(
  "candidate-a",
  "Candidate A",
  "artist-candidate",
  "Candidate Artist",
  ["dream pop"],
);
const candidate: DiscoveryCandidate = {
  anchors: [
    {
      evidence: {
        album: 0,
        artist: 0,
        genre: 1,
        reasonCodes: ["genre"],
        sharedGenres: ["dream pop"],
      },
      score: 0.8,
      trackId: likedTrack.id,
    },
  ],
  confidence: "high",
  mapped: true,
  proposal: {
    artist: "Candidate Artist",
    matchedSeedIds: [likedTrack.id],
    reason: "A related discovery.",
    title: "Candidate A",
  },
  recommendationExploration: "balanced",
  recommendationId: "candidate-a-recommendation",
  resolutionConfidence: 1,
  scope: "song",
  score: 0.8,
  status: "unseen",
  track: candidateTrack,
};

const graph = buildPreviewGraph([likedTrack]);

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
};

describe("useMapDiscovery request admission", () => {
  let container: HTMLDivElement;
  let root: Root;
  let state!: ReturnType<typeof useMapDiscovery>;

  const renderHook = async () => {
    const captureState = (current: ReturnType<typeof useMapDiscovery>) => {
      state = current;
    };
    function Harness({
      onState,
    }: {
      onState: (current: ReturnType<typeof useMapDiscovery>) => void;
    }) {
      const current = useMapDiscovery(graph, [likedTrack]);
      useEffect(() => {
        onState(current);
      }, [current, onState]);
      return null;
    }

    await act(async () => {
      root.render(<Harness onState={captureState} />);
    });
  };

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    vi.clearAllMocks();
    mocks.discoverMixedCandidates.mockResolvedValue([]);
    mocks.getRecommendationFeedbackStatsAction.mockResolvedValue({
      stats: [],
      success: true,
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("synchronously distinguishes an accepted request from a running one", async () => {
    const discovery = createDeferred<DiscoveryCandidate[]>();
    mocks.discoverMixedCandidates.mockReset();
    mocks.discoverMixedCandidates
      .mockReturnValueOnce(discovery.promise)
      .mockResolvedValueOnce([]);
    await renderHook();

    let accepted!: Promise<void> | null;
    let blocked!: Promise<void> | null;
    await act(async () => {
      accepted = state.discover({ selectedTrackId: likedTrack.id });
      blocked = state.discover({ selectedTrackId: "liked-b" });
    });

    expect(accepted).toBeInstanceOf(Promise);
    expect(blocked).toBeNull();
    expect(mocks.discoverMixedCandidates).toHaveBeenCalledTimes(1);

    await act(async () => {
      discovery.resolve([]);
      await accepted;
    });

    let retry!: Promise<void> | null;
    await act(async () => {
      retry = state.discover({ selectedTrackId: "liked-b" });
    });
    expect(retry).toBeInstanceOf(Promise);
    await act(async () => {
      await retry;
    });
    expect(mocks.discoverMixedCandidates).toHaveBeenCalledTimes(2);
  });

  it.each(["feedback", "playlist", "save"] as const)(
    "returns null while a %s request owns the mutation slot",
    async (operation) => {
      const pending = createDeferred<Record<string, unknown>>();
      await renderHook();

      let mutation!: Promise<void>;
      await act(async () => {
        if (operation === "feedback") {
          mocks.recordRecommendationFeedbackAction.mockReturnValueOnce(
            pending.promise,
          );
          mutation = state.recordFeedback(candidate, "up");
        } else if (operation === "playlist") {
          mocks.createPlaylistAction.mockReturnValueOnce(pending.promise);
          mutation = state.addCandidateToPlaylist(candidate);
        } else {
          mocks.saveTracksToLibraryAction.mockReturnValueOnce(pending.promise);
          mutation = state.saveCandidate(candidate);
        }
      });

      expect(state.discover({ selectedTrackId: likedTrack.id })).toBeNull();
      expect(mocks.discoverMixedCandidates).not.toHaveBeenCalled();

      await act(async () => {
        pending.resolve({ error: "Expected test failure.", success: false });
        await mutation;
      });

      let accepted!: Promise<void> | null;
      await act(async () => {
        accepted = state.discover({ selectedTrackId: likedTrack.id });
      });
      expect(accepted).toBeInstanceOf(Promise);
      await act(async () => {
        await accepted;
      });
      expect(mocks.discoverMixedCandidates).toHaveBeenCalledTimes(1);
    },
  );
});
