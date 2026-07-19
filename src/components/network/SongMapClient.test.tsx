// @vitest-environment jsdom

import { act, type ComponentProps, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SongMapClient from "@/components/network/SongMapClient";
import type { useMapDiscovery as UseMapDiscovery } from "@/hooks/useMapDiscovery";
import { buildPreviewGraph } from "@/lib/network/buildPreviewGraph";
import { makeTrack } from "@/lib/network/__tests__/fixtures";
import type { DiscoveryCandidate } from "@/types/network";

type DiscoveryState = ReturnType<typeof UseMapDiscovery>;
type DiscoveryGraph = Parameters<typeof UseMapDiscovery>[0];
type DiscoveryTrayProps = ComponentProps<
  typeof import("@/components/network/DiscoveryTray").default
>;
type SongInspectorProps = ComponentProps<
  typeof import("@/components/network/SongInspector").default
>;

interface RegisteredMapEvents {
  clickNode: (event: { node: string }) => void;
  clickStage: () => void;
  enterNode: (event: { node: string }) => void;
  leaveNode: () => void;
}

const mocks = vi.hoisted(() => ({
  discovery: null as unknown as DiscoveryState,
  discoveryGraphs: [] as DiscoveryGraph[],
  discoveryTrayProps: null as DiscoveryTrayProps | null,
  events: null as RegisteredMapEvents | null,
  player: null as unknown as ReturnType<
    typeof import("@/components/PlayerProvider").usePlayer
  >,
  sigmaContainer: null as HTMLDivElement | null,
  songInspectorProps: null as SongInspectorProps | null,
  songGraph: {
    clusters: [],
    error: null as string | null,
    graph: null as ReturnType<typeof buildPreviewGraph> | null,
    progress: 0,
    stage: "normalizing" as const,
    stats: null,
  },
}));

vi.mock("@react-sigma/core", () => {
  const Passthrough = ({ children }: { children?: ReactNode }) =>
    children ?? null;
  return {
    ControlsContainer: Passthrough,
    FullScreenControl: () => null,
    SigmaContainer: Passthrough,
    ZoomControl: () => null,
    useRegisterEvents: () => (events: RegisteredMapEvents) => {
      mocks.events = events;
    },
    useSigma: () => ({
      getContainer: () => mocks.sigmaContainer,
    }),
  };
});

vi.mock("@sigma/node-image", () => ({
  createNodeImageProgram: vi.fn(() => class MockNodeImageProgram {}),
}));

vi.mock("sigma/rendering", () => ({
  drawDiscNodeHover: vi.fn(),
}));

vi.mock("@/components/PlayerProvider", () => ({
  usePlayer: () => mocks.player,
}));

vi.mock("@/hooks/useMapDiscovery", () => ({
  useMapDiscovery: (graph: DiscoveryGraph) => {
    mocks.discoveryGraphs.push(graph);
    return mocks.discovery;
  },
}));

vi.mock("@/hooks/useSongGraph", () => ({
  useSongGraph: () => mocks.songGraph,
}));

vi.mock("@/components/network/ClusterFocus", () => ({
  default: () => null,
}));

vi.mock("@/components/network/DiscoveryControls", () => ({
  default: () => null,
}));

vi.mock("@/components/network/DiscoveryTray", () => ({
  default: (props: DiscoveryTrayProps) => {
    mocks.discoveryTrayProps = props;
    return null;
  },
}));

vi.mock("@/components/network/GraphLoader", () => ({
  default: () => null,
}));

vi.mock("@/components/network/NeighborhoodHighlight", () => ({
  default: () => null,
}));

vi.mock("@/components/network/SongInspector", () => ({
  default: (props: SongInspectorProps) => {
    mocks.songInspectorProps = props;
    return null;
  },
}));

const likedTrackA = makeTrack(
  "liked-a",
  "Liked A",
  "artist-a",
  "Artist A",
  ["dream pop"],
);
const likedTrackB = makeTrack(
  "liked-b",
  "Liked B",
  "artist-b",
  "Artist B",
  ["indie pop"],
);
const likedTrackC = makeTrack(
  "liked-c",
  "Liked C",
  "artist-c",
  "Artist C",
  ["shoegaze"],
);
const candidateTrack = makeTrack(
  "candidate",
  "Candidate",
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
      trackId: likedTrackA.id,
    },
  ],
  confidence: "high",
  mapped: true,
  proposal: {
    artist: "Candidate Artist",
    matchedSeedIds: [likedTrackA.id],
    reason: "A related discovery.",
    title: "Candidate",
  },
  recommendationExploration: "balanced",
  recommendationId: "candidate-recommendation",
  resolutionConfidence: 1,
  scope: "song",
  score: 0.8,
  status: "unseen",
  track: candidateTrack,
};
const candidateTrackB = makeTrack(
  "candidate-b",
  "Candidate B",
  "artist-candidate-b",
  "Candidate Artist B",
  ["dream pop"],
);
const candidateTrackC = makeTrack(
  "candidate-c",
  "Candidate C",
  "artist-candidate-c",
  "Candidate Artist C",
  ["dream pop"],
);
const candidateB: DiscoveryCandidate = {
  ...candidate,
  proposal: { ...candidate.proposal, title: "Candidate B" },
  recommendationId: "candidate-b-recommendation",
  track: candidateTrackB,
};
const candidateC: DiscoveryCandidate = {
  ...candidate,
  proposal: { ...candidate.proposal, title: "Candidate C" },
  recommendationId: "candidate-c-recommendation",
  track: candidateTrackC,
};

const createDiscoveryState = (): DiscoveryState => ({
  addCandidateToPlaylist: vi.fn(),
  candidates: [],
  changeExploration: vi.fn(),
  clearCandidates: vi.fn(),
  discover: vi.fn(async () => undefined),
  dismissCandidate: vi.fn(),
  error: null,
  events: [],
  exploration: "balanced",
  feedbackError: null,
  feedbackStates: {},
  feedbackStats: [],
  hasRestored: true,
  isFeedbackPending: false,
  isLoading: false,
  isMutationPending: false,
  playlistStates: {},
  previewCandidate: vi.fn(),
  recordFeedback: vi.fn(),
  resetFeedback: vi.fn(),
  saveCandidate: vi.fn(),
  saveStates: {},
  selectCandidate: vi.fn(),
  summary: "",
});

const createDeferred = () => {
  let resolve = () => undefined;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
};

describe("Music Map discovery selection", () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderMap = async (
    props: Partial<ComponentProps<typeof SongMapClient>> = {},
  ) => {
    await act(async () => {
      root.render(
        <SongMapClient
          libraryProgress={100}
          songs={[likedTrackA, likedTrackB, likedTrackC]}
          {...props}
        />,
      );
    });
  };

  const clickMapNode = async (node: string) => {
    await act(async () => {
      mocks.events?.clickNode({ node });
    });
  };

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    mocks.discovery = createDiscoveryState();
    mocks.discoveryGraphs = [];
    mocks.discoveryTrayProps = null;
    mocks.events = null;
    mocks.player = {
      currentTrack: null,
      isPaused: true,
      playTrack: vi.fn(async () => undefined),
      queueTrack: vi.fn(async () => undefined),
      togglePlay: vi.fn(),
    } as unknown as typeof mocks.player;
    mocks.sigmaContainer = document.createElement("div");
    mocks.songInspectorProps = null;
    mocks.songGraph = {
      clusters: [],
      error: null,
      graph: buildPreviewGraph([likedTrackA, likedTrackB, likedTrackC]),
      progress: 100,
      stage: "ready",
      stats: null,
    };
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("starts discovery from both a liked map node and the keyboard picker", async () => {
    await renderMap();
    await clickMapNode(likedTrackA.id);

    expect(mocks.discovery.discover).toHaveBeenCalledWith({
      selectedTrackId: likedTrackA.id,
    });
    expect(mocks.discovery.discover).toHaveBeenCalledTimes(1);
    expect(mocks.discovery.discover).toHaveBeenNthCalledWith(1, {
      selectedTrackId: likedTrackA.id,
    });

    const picker = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Choose a song on the map"]',
    );
    expect(picker).not.toBeNull();
    await act(async () => {
      if (!picker) return;
      picker.value = likedTrackB.id;
      picker.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(mocks.discovery.discover).toHaveBeenLastCalledWith({
      selectedTrackId: likedTrackB.id,
    });
    expect(mocks.discovery.discover).toHaveBeenCalledTimes(2);
    expect(mocks.discovery.discover).toHaveBeenNthCalledWith(2, {
      selectedTrackId: likedTrackB.id,
    });
  });

  it("waits for the similarity graph before discovering the selected song", async () => {
    mocks.songGraph.graph = null;
    mocks.songGraph.progress = 40;
    mocks.songGraph.stage = "relationships";
    await renderMap();
    await clickMapNode(likedTrackA.id);

    expect(mocks.discovery.discover).not.toHaveBeenCalled();

    mocks.songGraph.graph = buildPreviewGraph([
      likedTrackA,
      likedTrackB,
      likedTrackC,
    ]);
    mocks.songGraph.progress = 100;
    mocks.songGraph.stage = "ready";
    await renderMap();

    expect(mocks.discovery.discover).toHaveBeenCalledTimes(1);
    expect(mocks.discovery.discover).toHaveBeenCalledWith({
      selectedTrackId: likedTrackA.id,
    });
    expect(mocks.discoveryGraphs.at(-1)).toBe(mocks.songGraph.graph);
  });

  it("waits for local discovery history to restore", async () => {
    mocks.discovery.hasRestored = false;
    await renderMap();
    await clickMapNode(likedTrackA.id);

    expect(mocks.discovery.discover).not.toHaveBeenCalled();

    mocks.discovery.hasRestored = true;
    await renderMap();

    expect(mocks.discovery.discover).toHaveBeenCalledTimes(1);
    expect(mocks.discovery.discover).toHaveBeenCalledWith({
      selectedTrackId: likedTrackA.id,
    });
    expect(mocks.discoveryGraphs.at(-1)?.hasNode(likedTrackA.id)).toBe(true);
    expect(mocks.discoveryGraphs.at(-1)?.hasNode(likedTrackB.id)).toBe(true);
  });

  it("uses the preview graph when similarity processing fails", async () => {
    mocks.songGraph.error = "Graph worker failed.";
    mocks.songGraph.graph = null;
    await renderMap();
    await clickMapNode(likedTrackA.id);

    expect(mocks.discovery.discover).toHaveBeenCalledTimes(1);
    expect(mocks.discovery.discover).toHaveBeenCalledWith({
      selectedTrackId: likedTrackA.id,
    });
    expect(mocks.discoveryGraphs.at(-1)?.hasNode(likedTrackA.id)).toBe(true);
    expect(mocks.discoveryGraphs.at(-1)?.hasNode(likedTrackB.id)).toBe(true);
  });

  it.each([
    "isLoading",
    "isFeedbackPending",
    "isMutationPending",
  ] as const)(
    "queues the latest liked-song selection while %s is true",
    async (busyState) => {
      await renderMap();
      await clickMapNode(likedTrackA.id);
      expect(mocks.discovery.discover).toHaveBeenCalledTimes(1);

      mocks.discovery[busyState] = true;
      await renderMap();
      await clickMapNode(likedTrackB.id);
      await clickMapNode(likedTrackC.id);
      expect(mocks.discovery.discover).toHaveBeenCalledTimes(1);

      mocks.discovery[busyState] = false;
      await renderMap();
      expect(mocks.discovery.discover).toHaveBeenCalledTimes(2);
      expect(mocks.discovery.discover).toHaveBeenLastCalledWith({
        selectedTrackId: likedTrackC.id,
      });
    },
  );

  it("retains current candidates while replacement discovery runs", async () => {
    mocks.discovery.candidates = [candidate];
    await renderMap();
    await clickMapNode(likedTrackA.id);

    expect(mocks.discovery.discover).toHaveBeenCalledWith({
      selectedTrackId: likedTrackA.id,
    });
    mocks.discovery.isLoading = true;
    await renderMap();
    expect(mocks.discoveryTrayProps?.candidates).toEqual([candidate]);
    expect(mocks.discovery.clearCandidates).not.toHaveBeenCalled();
  });

  it("queues a rapid second selection before the busy render commits", async () => {
    const deferred = createDeferred();
    mocks.discovery.discover = vi.fn(() => deferred.promise);
    await renderMap();

    await clickMapNode(likedTrackA.id);
    await clickMapNode(likedTrackB.id);
    expect(mocks.discovery.discover).toHaveBeenCalledTimes(1);

    mocks.discovery.isLoading = true;
    await renderMap();
    deferred.resolve();
    await act(async () => deferred.promise);
    mocks.discovery.isLoading = false;
    await renderMap();

    expect(mocks.discovery.discover).toHaveBeenCalledTimes(2);
    expect(mocks.discovery.discover).toHaveBeenLastCalledWith({
      selectedTrackId: likedTrackB.id,
    });
  });

  it("deduplicates a rapid re-click of the running song", async () => {
    const deferred = createDeferred();
    mocks.discovery.discover = vi.fn(() => deferred.promise);
    await renderMap();

    await clickMapNode(likedTrackA.id);
    await clickMapNode(likedTrackA.id);
    expect(mocks.discovery.discover).toHaveBeenCalledTimes(1);

    deferred.resolve();
    await act(async () => deferred.promise);
    await renderMap();
    expect(mocks.discovery.discover).toHaveBeenCalledTimes(1);
  });

  it.each(["stage", "candidate"] as const)(
    "cancels a queued selection when switching to the %s",
    async (destination) => {
      mocks.discovery.isLoading = true;
      if (destination === "candidate") {
        mocks.discovery.candidates = [candidate];
      }
      await renderMap();

      await clickMapNode(likedTrackB.id);
      if (destination === "stage") {
        await act(async () => mocks.events?.clickStage());
      } else {
        await clickMapNode(candidateTrack.id);
      }

      mocks.discovery.isLoading = false;
      await renderMap();
      expect(mocks.discovery.discover).not.toHaveBeenCalled();
    },
  );

  it("keeps mapped discovery candidates inspect-only", async () => {
    mocks.discovery.candidates = [candidate];
    await renderMap();
    await clickMapNode(candidateTrack.id);

    expect(mocks.discovery.discover).not.toHaveBeenCalled();
    expect(mocks.discovery.clearCandidates).not.toHaveBeenCalled();
    expect(
      container.querySelector<HTMLSelectElement>(
        'select[aria-label="Choose a song on the map"]',
      )?.value,
    ).toBe(candidateTrack.id);
  });

  it("wires the inspector actions to playback and the Spotify queue", async () => {
    const onPlaySong = vi.fn(async () => true);
    await renderMap({ onPlaySong });
    await clickMapNode(likedTrackA.id);

    expect(mocks.songInspectorProps?.activeTrack).toBe(likedTrackA);
    await act(async () => {
      await mocks.songInspectorProps?.onPlaySong?.(likedTrackA);
      await mocks.songInspectorProps?.onQueueSong?.(likedTrackA);
    });

    expect(onPlaySong).toHaveBeenCalledWith(likedTrackA);
    expect(mocks.player.queueTrack).toHaveBeenCalledWith(likedTrackA.uri);
  });

  it("marks candidate inspector playback busy during discovery", async () => {
    mocks.discovery.candidates = [candidate];
    mocks.discovery.isLoading = true;
    await renderMap();
    await clickMapNode(candidateTrack.id);

    expect(mocks.songInspectorProps?.activeTrack).toBe(candidateTrack);
    expect(mocks.songInspectorProps?.isDiscovering).toBe(true);
    expect(mocks.player.playTrack).not.toHaveBeenCalled();
    expect(mocks.discovery.previewCandidate).not.toHaveBeenCalled();
  });

  it("uses the rotated discovery queue for an idle selected candidate", async () => {
    mocks.discovery.candidates = [candidateB, candidate, candidateC];
    await renderMap();
    await clickMapNode(candidateTrack.id);

    expect(mocks.songInspectorProps?.activeTrack).toBe(candidateTrack);
    expect(mocks.songInspectorProps?.isDiscovering).toBe(false);
    await act(async () => {
      await mocks.songInspectorProps?.onPlaySong?.(candidateTrack);
    });

    expect(mocks.player.playTrack).toHaveBeenCalledWith(candidateTrack.uri, [
      candidateTrackC.uri,
      candidateTrackB.uri,
    ]);
    expect(mocks.discovery.previewCandidate).toHaveBeenCalledWith(candidate);
  });

  it("records a candidate preview before starting a queued discovery", async () => {
    const playback = createDeferred();
    mocks.discovery.candidates = [candidate];
    mocks.player.playTrack = vi.fn(() => playback.promise);
    await renderMap();
    await clickMapNode(candidateTrack.id);

    let playbackRequest: Promise<void> | undefined;
    await act(async () => {
      const request = mocks.songInspectorProps?.onPlaySong?.(candidateTrack);
      playbackRequest = request ? Promise.resolve(request).then(() => undefined) : undefined;
    });
    await clickMapNode(likedTrackA.id);
    expect(mocks.discovery.discover).not.toHaveBeenCalled();

    playback.resolve();
    await act(async () => playbackRequest);
    expect(mocks.discovery.previewCandidate).toHaveBeenCalledWith(candidate);
    expect(mocks.discovery.discover).toHaveBeenCalledWith({
      selectedTrackId: likedTrackA.id,
    });
    expect(
      mocks.discovery.previewCandidate.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.discovery.discover.mock.invocationCallOrder[0]);
  });

  it("does not advertise removed neighbor evidence to screen readers", async () => {
    mocks.songGraph.stats = {
      cacheHit: false,
      candidatePairs: 3,
      clusterCount: 1,
      edgeCount: 2,
      isolatedNodeCount: 0,
      neighborhoodCount: 1,
      nodeCount: 3,
      sameArtistEdgeCount: 1,
    };
    await renderMap();

    expect(container.textContent).not.toContain(
      "inspect a song to read the evidence for its strongest neighbors",
    );
  });
});
