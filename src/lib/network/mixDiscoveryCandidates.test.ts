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
  recommendationExploration: "balanced",
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

  it("honors an adaptive strategy allocation", () => {
    const result = mixDiscoveryCandidates(
      Array.from({ length: 8 }, (_, index) => candidate(`song-${index}`, "song")),
      Array.from({ length: 8 }, (_, index) =>
        candidate(`neighbor-${index}`, "neighborhood"),
      ),
      () => 0.999,
      { neighborhood: 3, song: 7 },
    );

    expect(result.filter((item) => item.scope === "song")).toHaveLength(7);
    expect(result.filter((item) => item.scope === "neighborhood")).toHaveLength(3);
  });

  it("backfills overlapping adaptive results from spare candidates", () => {
    const result = mixDiscoveryCandidates(
      [
        candidate("shared", "song"),
        ...Array.from({ length: 7 }, (_, index) =>
          candidate(`song-${index}`, "song"),
        ),
      ],
      [
        candidate("shared", "neighborhood"),
        ...Array.from({ length: 5 }, (_, index) =>
          candidate(`neighbor-${index}`, "neighborhood"),
        ),
      ],
      () => 0.999,
      { neighborhood: 3, song: 7 },
    );

    expect(new Set(result.map((item) => item.track.id)).size).toBe(10);
    expect(result.filter((item) => item.scope === "song")).toHaveLength(7);
    expect(result.filter((item) => item.scope === "neighborhood")).toHaveLength(3);
  });

  it("keeps ten adaptive results when four tracks overlap", () => {
    const sharedSong = Array.from({ length: 4 }, (_, index) =>
      candidate(`shared-${index}`, "song"),
    );
    const sharedNeighborhood = Array.from({ length: 4 }, (_, index) =>
      candidate(`shared-${index}`, "neighborhood"),
    );
    const result = mixDiscoveryCandidates(
      [
        ...sharedSong,
        ...Array.from({ length: 6 }, (_, index) =>
          candidate(`song-${index}`, "song"),
        ),
      ],
      [
        ...sharedNeighborhood,
        ...Array.from({ length: 2 }, (_, index) =>
          candidate(`neighbor-${index}`, "neighborhood"),
        ),
      ],
      () => 0.999,
      { neighborhood: 3, song: 7 },
    );

    expect(new Set(result.map((item) => item.track.id)).size).toBe(10);
    expect(result.filter((item) => item.scope === "song")).toHaveLength(7);
    expect(result.filter((item) => item.scope === "neighborhood")).toHaveLength(3);
  });

  it("randomizes attribution when both strategies return the same track", () => {
    const mixWith = (overlapSelection: number) => {
      const values = [overlapSelection, 0.999];
      return mixDiscoveryCandidates(
        [candidate("shared", "song")],
        [
          candidate("shared", "neighborhood"),
          candidate("unique", "neighborhood"),
        ],
        () => values.shift() ?? 0.999,
      ).find((item) => item.track.id === "shared");
    };

    expect(mixWith(0)?.scope).toBe("song");
    expect(mixWith(0.999)?.scope).toBe("neighborhood");
  });

  it("randomizes shared-track attribution during adaptive runs", () => {
    const mixWith = (overlapSelection: number) => {
      const values = [overlapSelection, ...Array(20).fill(0.999)];
      return mixDiscoveryCandidates(
        [
          candidate("shared", "song"),
          ...Array.from({ length: 7 }, (_, index) =>
            candidate(`song-${index}`, "song"),
          ),
        ],
        [
          candidate("shared", "neighborhood"),
          ...Array.from({ length: 5 }, (_, index) =>
            candidate(`neighbor-${index}`, "neighborhood"),
          ),
        ],
        () => values.shift() ?? 0.999,
        { neighborhood: 3, song: 7 },
      ).find((item) => item.track.id === "shared");
    };

    expect(mixWith(0)?.scope).toBe("song");
    expect(mixWith(0.999)?.scope).toBe("neighborhood");
  });
});
