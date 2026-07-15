import { describe, expect, it } from "vitest";
import { buildSongGraph } from "@/lib/network/buildGraph";
import { createDiscoveryContext } from "@/lib/network/discoveryContext";
import { networkFixtureTracks } from "@/lib/network/__tests__/fixtures";
import { createEmptyRecommendationLearningProfile } from "@/lib/network/recommendationLearning";

describe("createDiscoveryContext", () => {
  it("combines durable rejected tracks with local dismissals", () => {
    const { graph } = buildSongGraph(networkFixtureTracks);
    const profile = {
      ...createEmptyRecommendationLearningProfile(),
      rejectedTrackIds: ["durably-rejected", "shared-rejection"],
    };

    const context = createDiscoveryContext({
      dismissedTrackIds: ["locally-dismissed", "shared-rejection"],
      graph,
      learningProfile: profile,
      scope: "song",
      selectedTrackId: "dream-1",
      tracks: networkFixtureTracks,
    });

    expect(context.dismissedTrackIds).toEqual([
      "durably-rejected",
      "shared-rejection",
      "locally-dismissed",
    ]);
  });
});
