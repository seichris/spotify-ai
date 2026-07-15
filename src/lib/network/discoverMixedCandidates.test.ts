import { describe, expect, it } from "vitest";
import { buildClusterProfiles } from "@/lib/network/buildClusterProfiles";
import { buildSongGraph } from "@/lib/network/buildGraph";
import { discoverMixedCandidates } from "@/lib/network/discoverMixedCandidates";
import { detectCommunities } from "@/lib/network/detectCommunities";
import {
  makeTrack,
  networkFixtureTracks,
} from "@/lib/network/__tests__/fixtures";
import type {
  DiscoveryContext,
  RecommendationLearningProfile,
  ResolvedDiscoverySuggestion,
} from "@/types/network";
import { createEmptyRecommendationLearningProfile } from "@/lib/network/recommendationLearning";

const buildFixtureGraph = () => {
  const construction = buildSongGraph(networkFixtureTracks);
  detectCommunities(construction.graph);
  buildClusterProfiles(construction.graph, construction.genreIdf);
  return construction.graph;
};

const suggestionsFor = (
  prefix: string,
  context: DiscoveryContext,
): ResolvedDiscoverySuggestion[] =>
  Array.from({ length: 8 }, (_, index) => {
    const id = `${prefix}-${index}`;
    return {
      proposal: {
        artist: `Artist ${id}`,
        matchedSeedIds: context.seedTracks.map((track) => track.id),
        reason: "Shared dream-pop character.",
        title: `Song ${id}`,
      },
      recommendationId: `rec-${id}`,
      resolutionConfidence: 1,
      track: makeTrack(
        id,
        `Song ${id}`,
        `artist-${id}`,
        `Artist ${id}`,
        ["dream pop", "shoegaze"],
      ),
    };
  });

describe("shared mixed discovery", () => {
  it("runs song and neighborhood strategies and keeps five from each", async () => {
    const scopes: string[] = [];
    const candidates = await discoverMixedCandidates({
      fetchCandidates: async (context) => {
        scopes.push(context.scope);
        return {
          success: true,
          suggestions: suggestionsFor(context.scope, context),
        };
      },
      graph: buildFixtureGraph(),
      likedTracks: networkFixtureTracks,
      random: () => 0.5,
      selectedTrackId: "dream-1",
    });

    expect(scopes).toEqual(["song", "neighborhood"]);
    expect(candidates).toHaveLength(10);
    expect(candidates.filter((candidate) => candidate.scope === "song")).toHaveLength(5);
    expect(
      candidates.filter((candidate) => candidate.scope === "neighborhood"),
    ).toHaveLength(5);
  });

  it("propagates a failed strategy instead of returning a partial batch", async () => {
    await expect(
      discoverMixedCandidates({
        fetchCandidates: async (context) =>
          context.scope === "song"
            ? { error: "Song strategy failed.", success: false }
            : {
                success: true,
                suggestions: suggestionsFor(context.scope, context),
              },
        graph: buildFixtureGraph(),
        likedTracks: networkFixtureTracks,
        selectedTrackId: "dream-1",
      }),
    ).rejects.toThrow("Song strategy failed.");
  });

  it("uses mature feedback to request and mix a 7/3 strategy allocation", async () => {
    const limits = new Map<string, number | undefined>();
    const profile: RecommendationLearningProfile = {
      ...createEmptyRecommendationLearningProfile(),
      sampleSize: 30,
      strategies: [
        { disliked: 3, impressions: 20, liked: 12, strategy: "song" },
        {
          disliked: 13,
          impressions: 20,
          liked: 2,
          strategy: "neighborhood",
        },
      ],
    };
    const candidates = await discoverMixedCandidates({
      fetchCandidates: async (context) => {
        limits.set(context.scope, context.resultLimit);
        return {
          success: true,
          suggestions: suggestionsFor(context.scope, context),
        };
      },
      fetchLearningProfile: async () => ({ profile, success: true }),
      graph: buildFixtureGraph(),
      likedTracks: networkFixtureTracks,
      random: () => 0.9,
      selectedTrackId: "dream-1",
    });

    expect(Object.fromEntries(limits)).toEqual({ neighborhood: 3, song: 7 });
    expect(candidates.filter((item) => item.scope === "song")).toHaveLength(7);
    expect(
      candidates.filter((item) => item.scope === "neighborhood"),
    ).toHaveLength(3);
  });
});
