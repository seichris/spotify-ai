import { describe, expect, it } from "vitest";
import { mixDiscoveryCandidates } from "@/lib/network/mixDiscoveryCandidates";
import type {
  DiscoveryCandidate,
  RecommendationStrategy,
} from "@/types/network";

const candidate = (
  id: string,
  scope: RecommendationStrategy,
): DiscoveryCandidate => ({
  anchors: [],
  confidence: "medium",
  mapped: false,
  proposal: {
    artist: `Artist ${id}`,
    matchedSeedIds: [],
    reason: "A test recommendation.",
    title: `Track ${id}`,
  },
  recommendationId: `rec-${scope}-${id}`,
  resolutionConfidence: 1,
  scope,
  score: 0.5,
  status: "unseen",
  track: {
    album: { id: `album-${id}`, images: [], name: `Album ${id}` },
    artists: [{ id: `artist-${id}`, name: `Artist ${id}` }],
    duration_ms: 180_000,
    features: null,
    genres: [],
    id,
    is_local: false,
    name: `Track ${id}`,
    type: "track",
    uri: `spotify:track:${id}`,
  },
});

describe("mixDiscoveryCandidates", () => {
  it("takes at most five candidates per strategy", () => {
    const result = mixDiscoveryCandidates(
      Array.from({ length: 7 }, (_, index) => candidate(`song-${index}`, "song")),
      Array.from({ length: 7 }, (_, index) =>
        candidate(`neighbor-${index}`, "neighborhood"),
      ),
      () => 0.999,
    );

    expect(result).toHaveLength(10);
    expect(result.filter((item) => item.scope === "song")).toHaveLength(5);
    expect(result.filter((item) => item.scope === "neighborhood")).toHaveLength(5);
  });

  it("deduplicates a track recommended by both strategies", () => {
    const result = mixDiscoveryCandidates(
      [candidate("shared", "song")],
      [candidate("shared", "neighborhood"), candidate("unique", "neighborhood")],
      () => 0.999,
    );

    expect(result.map((item) => item.track.id)).toEqual(["shared", "unique"]);
  });
});
