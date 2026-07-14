import { describe, expect, it } from "vitest";
import {
  networkBenchmarkCases,
  networkFixtureTracks,
} from "@/lib/network/__tests__/fixtures";
import {
  GRAPH_CACHE_SCHEMA_VERSION,
  GRAPH_LAYOUT_VERSION,
  GRAPH_MODEL_VERSION,
  GRAPH_NEIGHBOR_CONFIG,
  GRAPH_SIMILARITY_WEIGHTS,
} from "@/lib/network/graphConfig";

describe("graph configuration", () => {
  it("uses explicit cache, model, and layout versions", () => {
    expect(GRAPH_CACHE_SCHEMA_VERSION).toBeGreaterThan(0);
    expect(GRAPH_MODEL_VERSION).toMatch(/-v\d+$/);
    expect(GRAPH_LAYOUT_VERSION).toMatch(/-v\d+$/);
  });

  it("keeps similarity weights normalized", () => {
    const total = Object.values(GRAPH_SIMILARITY_WEIGHTS).reduce(
      (sum, weight) => sum + weight,
      0,
    );

    expect(total).toBeCloseTo(1, 8);
  });

  it("keeps the same-artist cap below the total neighbor limit", () => {
    expect(GRAPH_NEIGHBOR_CONFIG.maxSameArtistNeighbors).toBeLessThan(
      GRAPH_NEIGHBOR_CONFIG.maxNeighbors,
    );
  });
});

describe("network fixtures", () => {
  it("covers repeated artists, specific genres, missing metadata, and duplicates", () => {
    const ids = networkFixtureTracks.map((track) => track.id);

    expect(new Set(ids).size).toBeLessThan(ids.length);
    expect(networkFixtureTracks.some((track) => track.genres.length === 0)).toBe(true);
    expect(
      networkFixtureTracks.some((track) => track.genres.includes("dream pop")),
    ).toBe(true);
    expect(
      networkFixtureTracks.filter(
        (track) => track.artists[0]?.id === "artist-dream",
      ),
    ).toHaveLength(2);
  });

  it("defines a repeatable qualitative benchmark for 15-20 seed songs", () => {
    const fixtureIds = new Set(networkFixtureTracks.map((track) => track.id));
    const seedIds = new Set(networkBenchmarkCases.map((item) => item.seedId));

    expect(networkBenchmarkCases.length).toBeGreaterThanOrEqual(15);
    expect(networkBenchmarkCases.length).toBeLessThanOrEqual(20);
    expect(seedIds.size).toBe(networkBenchmarkCases.length);

    networkBenchmarkCases.forEach(({ seedId, expectedNeighborIds }) => {
      expect(fixtureIds.has(seedId)).toBe(true);
      expect(expectedNeighborIds.length).toBeGreaterThan(0);
      expectedNeighborIds.forEach((neighborId) => {
        expect(fixtureIds.has(neighborId)).toBe(true);
        expect(neighborId).not.toBe(seedId);
      });
    });
  });
});
