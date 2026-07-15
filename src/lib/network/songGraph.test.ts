import { describe, expect, it } from "vitest";
import { buildClusterProfiles } from "@/lib/network/buildClusterProfiles";
import { buildFeatures, normalizeLibrary } from "@/lib/network/buildFeatures";
import { buildSongGraph as constructSongGraph } from "@/lib/network/buildGraph";
import { buildSongGraph } from "@/lib/network/buildSongGraph";
import {
  calculateSimilarity,
  calculateTempoSimilarity,
} from "@/lib/network/calculateSimilarity";
import { detectCommunities } from "@/lib/network/detectCommunities";
import {
  createLibraryFingerprint,
  isGraphCacheValid,
} from "@/lib/network/graphCache";
import { layoutSongGraph } from "@/lib/network/layoutGraph";
import {
  expectedFixtureCommunities,
  networkBenchmarkCases,
  networkFixtureTracks,
} from "@/lib/network/__tests__/fixtures";

describe("song graph features and similarity", () => {
  it("normalizes, filters, and deduplicates tracks deterministically", () => {
    const normalized = normalizeLibrary([...networkFixtureTracks].reverse());
    const forward = normalizeLibrary(networkFixtureTracks);

    expect(normalized).toHaveLength(20);
    expect(normalized.map((track) => track.id)).toEqual(
      [...normalized.map((track) => track.id)].sort(),
    );
    expect(normalized.find((track) => track.id === "duplicate")?.name).toBe(
      "Duplicate One",
    );
    expect(normalized).toEqual(forward);
  });

  it("gives specific genres more weight than broad genres", () => {
    const { genreIdf } = buildFeatures(networkFixtureTracks);

    expect(genreIdf.get("shoegaze")).toBeGreaterThan(genreIdf.get("pop") ?? 0);
  });

  it("produces symmetric bounded similarity with inspectable evidence", () => {
    const { features, genreIdf } = buildFeatures(networkFixtureTracks);
    const byId = new Map(features.map((feature) => [feature.track.id, feature]));
    const dreamOne = byId.get("dream-1")!;
    const dreamTwo = byId.get("dream-2")!;
    const forward = calculateSimilarity(dreamOne, dreamTwo, genreIdf);
    const reverse = calculateSimilarity(dreamTwo, dreamOne, genreIdf);

    expect(forward.score).toBeGreaterThan(0);
    expect(forward.score).toBeLessThanOrEqual(1);
    expect(reverse.score).toBeCloseTo(forward.score, 12);
    expect(forward.evidence.reasonCodes).toEqual([
      "shared_genre",
      "shared_artist",
      "shared_album",
    ]);
  });

  it("rewards compatible tempo and energy, including half-time relationships", () => {
    const audioTracks = [
      { energy: 0.7, id: "audio-seed", tempo: 72 },
      { energy: 0.74, id: "audio-close", tempo: 144 },
      { energy: 0.2, id: "audio-mismatch", tempo: 110 },
    ].map(({ energy, id, tempo }) => ({
      ...networkFixtureTracks[2],
      album: { ...networkFixtureTracks[2].album, id: `album-${id}` },
      artists: [{ id: `artist-${id}`, name: id }],
      features: { energy, tempo },
      id,
      uri: `spotify:track:${id}`,
    }));
    const { features, genreIdf } = buildFeatures(audioTracks);
    const byId = new Map(features.map((feature) => [feature.track.id, feature]));
    const close = calculateSimilarity(
      byId.get("audio-seed")!,
      byId.get("audio-close")!,
      genreIdf,
    );
    const mismatch = calculateSimilarity(
      byId.get("audio-seed")!,
      byId.get("audio-mismatch")!,
      genreIdf,
    );

    expect(calculateTempoSimilarity(72, 144)).toBe(1);
    expect(calculateTempoSimilarity(144, 72)).toBe(1);
    expect(close.evidence.reasonCodes).toContain("similar_tempo");
    expect(close.evidence.reasonCodes).toContain("similar_energy");
    expect(close.score).toBeGreaterThan(mismatch.score);
  });
});

describe("sparse graph construction and communities", () => {
  it("builds evidence-bearing edges without overconnecting one artist", () => {
    const { graph } = constructSongGraph(networkFixtureTracks);

    expect(graph.order).toBe(20);
    expect(graph.degree("island-1")).toBe(0);
    graph.forEachEdge((_edge, attributes) => {
      expect(attributes.weight).toBeGreaterThan(0);
      expect(attributes.weight).toBeLessThanOrEqual(1);
      expect(attributes.evidence.reasonCodes.length).toBeGreaterThan(0);
    });
    graph.forEachNode((node, attributes) => {
      const sameArtistNeighbors = graph
        .neighbors(node)
        .filter((neighbor) => {
          const neighborArtists = new Set(
            graph.getNodeAttribute(neighbor, "artistIds"),
          );
          return attributes.artistIds.some((artistId) =>
            neighborArtists.has(artistId),
          );
        });
      expect(sameArtistNeighbors.length).toBeLessThanOrEqual(2);
    });
  });

  it("finds stable topology-derived fixture communities without a mixed bucket", () => {
    const { graph, genreIdf } = constructSongGraph(networkFixtureTracks);
    detectCommunities(graph);
    const profiles = buildClusterProfiles(graph, genreIdf);

    const expectedClusterIds = Object.values(expectedFixtureCommunities).map(
      (expectedIds) => {
        const clusterIds = new Set(
          expectedIds.map((id) => graph.getNodeAttribute(id, "clusterId")),
        );
        expect(clusterIds.size).toBe(1);
        return Array.from(clusterIds)[0];
      },
    );
    expect(new Set(expectedClusterIds).size).toBe(expectedClusterIds.length);
    expect(profiles.every((profile) => profile.label !== "Mixed")).toBe(true);
  });

  it("keeps every qualitative benchmark seed next to a plausible fixture peer", () => {
    const { graph } = constructSongGraph(networkFixtureTracks);

    networkBenchmarkCases.forEach(({ expectedNeighborIds, seedId }) => {
      const expected = new Set<string>(expectedNeighborIds);
      expect(
        graph.neighbors(seedId).some((neighbor) => expected.has(neighbor)),
      ).toBe(true);
    });
  });
});

describe("layout and graph cache", () => {
  it("creates finite layout coordinates and restores an exact cached layout", () => {
    const firstGraph = constructSongGraph(networkFixtureTracks).graph;
    const first = layoutSongGraph(firstGraph);
    const secondGraph = constructSongGraph(networkFixtureTracks).graph;
    const second = layoutSongGraph(secondGraph, first.positions);

    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(second.positions).toEqual(first.positions);
    Object.values(first.positions).forEach(({ x, y }) => {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    });
  });

  it("invalidates cache fingerprints when the library changes", () => {
    const fingerprint = createLibraryFingerprint(networkFixtureTracks);
    const first = buildSongGraph(networkFixtureTracks, null);
    const cached = buildSongGraph(networkFixtureTracks, first.cache);
    const changedFingerprint = createLibraryFingerprint(
      networkFixtureTracks.filter((track) => track.id !== "island-1"),
    );

    expect(cached.stats.cacheHit).toBe(true);
    expect(isGraphCacheValid(first.cache, fingerprint)).toBe(true);
    expect(changedFingerprint).not.toBe(fingerprint);
    expect(isGraphCacheValid(first.cache, changedFingerprint)).toBe(false);
  });

  it("keeps cold communities and positions stable across input ordering", () => {
    const forward = buildSongGraph(networkFixtureTracks, null);
    const reverse = buildSongGraph([...networkFixtureTracks].reverse(), null);

    expect(reverse.clusters).toEqual(forward.clusters);
    expect(reverse.cache.positions).toEqual(forward.cache.positions);
  });

  it("invalidates the cache when graph-driving metadata changes", () => {
    const changedTracks = networkFixtureTracks.map((track) =>
      track.id === "dream-1"
        ? { ...track, genres: [...track.genres, "new microgenre"] }
        : track,
    );

    expect(createLibraryFingerprint(changedTracks)).not.toBe(
      createLibraryFingerprint(networkFixtureTracks),
    );
  });

  it("invalidates the cache when tempo or energy changes", () => {
    const withAudio = networkFixtureTracks.map((track, index) => ({
      ...track,
      features: { energy: 0.6, tempo: 100 + index },
    }));
    const changedAudio = withAudio.map((track) =>
      track.id === "dream-1"
        ? { ...track, features: { ...track.features, tempo: 128 } }
        : track,
    );

    expect(createLibraryFingerprint(changedAudio)).not.toBe(
      createLibraryFingerprint(withAudio),
    );
  });
});
