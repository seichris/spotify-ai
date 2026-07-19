import { describe, expect, it } from "vitest";
import { selectBestSpotifyMatch } from "@/lib/discoveryResolution";
import { buildClusterProfiles } from "@/lib/network/buildClusterProfiles";
import { buildSongGraph } from "@/lib/network/buildGraph";
import { createDiscoveryContext } from "@/lib/network/discoveryContext";
import { detectCommunities } from "@/lib/network/detectCommunities";
import { layoutSongGraph } from "@/lib/network/layoutGraph";
import { placeCandidates } from "@/lib/network/placeCandidates";
import { scoreDiscoveryCandidates } from "@/lib/network/scoreDiscoveryCandidates";
import {
  makeTrack,
  networkFixtureTracks,
} from "@/lib/network/__tests__/fixtures";
import type {
  DiscoveryProposal,
  ResolvedDiscoverySuggestion,
} from "@/types/network";

const buildFixtureGraph = () => {
  const construction = buildSongGraph(networkFixtureTracks);
  detectCommunities(construction.graph);
  const clusters = buildClusterProfiles(
    construction.graph,
    construction.genreIdf,
  );
  layoutSongGraph(construction.graph);
  return { clusters, graph: construction.graph };
};

describe("discovery contexts", () => {
  it("builds bounded song, neighborhood, and cluster scopes", () => {
    const { clusters, graph } = buildFixtureGraph();
    const song = createDiscoveryContext({
      graph,
      scope: "song",
      selectedTrackId: "dream-1",
      tracks: networkFixtureTracks,
    });
    const neighborhood = createDiscoveryContext({
      graph,
      scope: "neighborhood",
      selectedTrackId: "dream-1",
      tracks: networkFixtureTracks,
    });
    const cluster = createDiscoveryContext({
      cluster: clusters.find((profile) => profile.nodeIds.includes("dream-1")),
      graph,
      scope: "cluster",
      tracks: networkFixtureTracks,
    });

    expect(song.anchorTracks.map((track) => track.id)).toEqual(["dream-1"]);
    expect(neighborhood.anchorTracks[0].id).toBe("dream-1");
    expect(neighborhood.anchorTracks.length).toBeGreaterThan(1);
    expect(neighborhood.anchorTracks.length).toBeLessThanOrEqual(7);
    expect(cluster.clusterLabel).toBeTruthy();
    expect(cluster.seedTracks.length).toBeLessThanOrEqual(4);
  });
});

describe("candidate resolution, scoring, and placement", () => {
  const proposal: DiscoveryProposal = {
    artist: "New Dreamer",
    matchedSeedIds: ["dream-1"],
    reason: "Shared dream-pop and shoegaze character.",
    title: "New Horizon",
  };

  it("rejects a plausible-looking search result with the wrong artist", () => {
    const correct = makeTrack(
      "candidate-correct",
      "New Horizon - Remastered",
      "artist-new",
      "New Dreamer",
      ["dream pop"],
    );
    const wrong = makeTrack(
      "candidate-wrong",
      "New Horizon",
      "artist-wrong",
      "Different Artist",
      ["dream pop"],
    );

    expect(selectBestSpotifyMatch(proposal, [wrong, correct])?.track.id).toBe(
      "candidate-correct",
    );
    expect(selectBestSpotifyMatch(proposal, [wrong])).toBeNull();
  });

  it("maps credible candidates to evidence-bearing anchors and shelves weak ones", () => {
    const { clusters, graph } = buildFixtureGraph();
    const context = createDiscoveryContext({
      graph,
      scope: "neighborhood",
      selectedTrackId: "dream-1",
      tracks: networkFixtureTracks,
    });
    const suggestions: ResolvedDiscoverySuggestion[] = [
      {
        proposal,
        recommendationId: "rec-mapped",
        resolutionConfidence: 1,
        track: makeTrack(
          "candidate-mapped",
          "New Horizon",
          "artist-new",
          "New Dreamer",
          ["dream pop", "shoegaze"],
        ),
      },
      {
        proposal: { ...proposal, title: "Unknown Signal" },
        recommendationId: "rec-weak",
        resolutionConfidence: 1,
        track: makeTrack(
          "candidate-weak",
          "Unknown Signal",
          "artist-unknown",
          "Unknown",
          [],
        ),
      },
    ];
    const candidates = scoreDiscoveryCandidates(
      suggestions,
      networkFixtureTracks,
      context,
    );
    const mapped = candidates.find((candidate) => candidate.track.id === "candidate-mapped")!;
    const weak = candidates.find((candidate) => candidate.track.id === "candidate-weak")!;
    const candidateGraph = placeCandidates(graph, candidates);

    expect(mapped.mapped).toBe(true);
    expect(mapped.anchors.length).toBeGreaterThan(0);
    expect(weak.mapped).toBe(false);
    expect(candidateGraph.getNodeAttribute(mapped.track.id, "kind")).toBe(
      "candidate",
    );
    expect(candidateGraph.degree(mapped.track.id)).toBe(mapped.anchors.length);
    candidateGraph.forEachEdge(mapped.track.id, (_edge, attributes) => {
      expect(attributes.hidden).toBe(false);
      expect(attributes.evidence.reasonCodes.length).toBeGreaterThan(0);
    });
    expect(clusters.length).toBeGreaterThan(0);
  });

  it("places discovered songs away from their anchors and each other", () => {
    const { graph } = buildFixtureGraph();
    const context = createDiscoveryContext({
      graph,
      scope: "song",
      selectedTrackId: "dream-1",
      tracks: networkFixtureTracks,
    });
    const mapped = scoreDiscoveryCandidates(
      [
        {
          proposal,
          recommendationId: "rec-collision-one",
          resolutionConfidence: 1,
          track: makeTrack(
            "candidate-collision-one",
            "Near Horizon",
            "artist-new-one",
            "New Dreamer",
            ["dream pop", "shoegaze"],
          ),
        },
      ],
      networkFixtureTracks,
      context,
    )[0];
    expect(mapped.mapped).toBe(true);
    expect(mapped.anchors.length).toBeGreaterThan(0);
    const anchor = mapped.anchors[0];
    const candidates = [
      { ...mapped, anchors: [anchor] },
      {
        ...mapped,
        anchors: [anchor],
        recommendationId: "rec-collision-two",
        track: makeTrack(
          "candidate-collision-two",
          "Another Horizon",
          "artist-new-two",
          "Another Dreamer",
          ["dream pop", "shoegaze"],
        ),
      },
    ];
    const candidateGraph = placeCandidates(graph, candidates);

    candidates.forEach((candidate) => {
      const candidateAttributes = candidateGraph.getNodeAttributes(
        candidate.track.id,
      );
      candidateGraph.forEachNode((node, attributes) => {
        if (node === candidate.track.id) return;
        expect(
          Math.hypot(
            candidateAttributes.x - attributes.x,
            candidateAttributes.y - attributes.y,
          ),
        ).toBeGreaterThanOrEqual(
          candidateAttributes.size + attributes.size - 0.01,
        );
      });
    });
  });

  it("keeps a candidate score stable when unrelated suggestions join the batch", () => {
    const { graph } = buildFixtureGraph();
    const context = createDiscoveryContext({
      graph,
      scope: "neighborhood",
      selectedTrackId: "dream-1",
      tracks: networkFixtureTracks,
    });
    const mappedSuggestion: ResolvedDiscoverySuggestion = {
      proposal,
      recommendationId: "rec-stable",
      resolutionConfidence: 1,
      track: makeTrack(
        "candidate-stable",
        "New Horizon",
        "artist-new",
        "New Dreamer",
        ["dream pop", "candidate-only"],
      ),
    };
    const unrelatedSuggestion: ResolvedDiscoverySuggestion = {
      proposal: { ...proposal, title: "Different Place" },
      recommendationId: "rec-unrelated",
      resolutionConfidence: 1,
      track: makeTrack(
        "candidate-unrelated",
        "Different Place",
        "artist-unrelated",
        "Someone Else",
        ["unrelated genre"],
      ),
    };

    const alone = scoreDiscoveryCandidates(
      [mappedSuggestion],
      networkFixtureTracks,
      context,
    ).find((candidate) => candidate.track.id === "candidate-stable")!;
    const inBatch = scoreDiscoveryCandidates(
      [mappedSuggestion, unrelatedSuggestion],
      networkFixtureTracks,
      context,
    ).find((candidate) => candidate.track.id === "candidate-stable")!;

    expect(inBatch.score).toBe(alone.score);
    expect(inBatch.anchors).toEqual(alone.anchors);
  });

  it("deduplicates candidates and excludes liked or dismissed track IDs", () => {
    const { graph } = buildFixtureGraph();
    const context = createDiscoveryContext({
      dismissedTrackIds: ["candidate-dismissed"],
      graph,
      scope: "song",
      selectedTrackId: "dream-1",
      tracks: networkFixtureTracks,
    });
    const suggestionFor = (id: string): ResolvedDiscoverySuggestion => ({
      proposal,
      recommendationId: `rec-${id}`,
      resolutionConfidence: 1,
      track:
        networkFixtureTracks.find((track) => track.id === id) ??
        makeTrack(id, "New Horizon", `artist-${id}`, "New Dreamer", [
          "dream pop",
        ]),
    });
    const candidates = scoreDiscoveryCandidates(
      [
        suggestionFor("dream-1"),
        suggestionFor("candidate-dismissed"),
        suggestionFor("candidate-kept"),
        suggestionFor("candidate-kept"),
      ],
      networkFixtureTracks,
      context,
    );

    expect(candidates.map((candidate) => candidate.track.id)).toEqual([
      "candidate-kept",
    ]);
  });

  it("widens only the candidate connection threshold in adventurous mode", () => {
    const { graph } = buildFixtureGraph();
    const context = createDiscoveryContext({
      graph,
      scope: "song",
      selectedTrackId: "dream-1",
      tracks: networkFixtureTracks,
    });
    const suggestion: ResolvedDiscoverySuggestion = {
      proposal,
      recommendationId: "rec-borderline",
      resolutionConfidence: 1,
      track: makeTrack(
        "candidate-borderline",
        "Borderline",
        "artist-borderline",
        "Borderline Artist",
        [
          "dream pop",
          "texture one",
          "texture two",
          "texture three",
          "texture four",
          "texture five",
          "texture six",
          "texture seven",
          "texture eight",
        ],
      ),
    };
    const familiar = scoreDiscoveryCandidates(
      [suggestion],
      networkFixtureTracks,
      { ...context, exploration: "familiar" },
    )[0];
    const adventurous = scoreDiscoveryCandidates(
      [suggestion],
      networkFixtureTracks,
      { ...context, exploration: "adventurous" },
    )[0];

    expect(familiar.score).toBe(adventurous.score);
    expect(familiar.mapped).toBe(false);
    expect(adventurous.mapped).toBe(true);
  });
});
