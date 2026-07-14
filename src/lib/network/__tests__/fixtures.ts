import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";

export const makeTrack = (
  id: string,
  name: string,
  artistId: string,
  artistName: string,
  genres: string[],
  albumId = `album-${id}`,
): EnrichedTrack => ({
  album: {
    id: albumId,
    images: [{ url: `https://images.example.test/${id}.jpg` }],
    name: `Album ${albumId}`,
  },
  artists: [{ id: artistId, name: artistName }],
  duration_ms: 180_000,
  features: null,
  genres,
  id,
  is_local: false,
  name,
  type: "track",
  uri: `spotify:track:${id}`,
});

export const networkFixtureTracks: EnrichedTrack[] = [
  makeTrack("dream-1", "Glass Harbor", "artist-dream", "Glass Harbor", [
    "pop",
    "dream pop",
    "shoegaze",
  ], "album-dream"),
  makeTrack("dream-2", "Silver Static", "artist-dream", "Glass Harbor", [
    "pop",
    "dream pop",
    "shoegaze",
  ], "album-dream"),
  makeTrack("dream-3", "Soft Geometry", "artist-soft", "Soft Geometry", [
    "dream pop",
    "indie pop",
  ]),
  makeTrack("dream-4", "Afterimage", "artist-after", "Afterimage", [
    "dream pop",
    "shoegaze",
    "ethereal wave",
  ]),
  makeTrack("dream-5", "Cloud Index", "artist-cloud", "Cloud Index", [
    "indie pop",
    "dream pop",
  ]),
  makeTrack("soul-1", "Amber Current", "artist-soul", "Amber Current", [
    "pop",
    "neo soul",
    "alternative r&b",
  ], "album-soul"),
  makeTrack("soul-2", "Slow Signal", "artist-soul", "Amber Current", [
    "neo soul",
    "alternative r&b",
  ], "album-soul"),
  makeTrack("soul-3", "Velvet Logic", "artist-velvet", "Velvet Logic", [
    "neo soul",
    "jazz funk",
  ]),
  makeTrack("soul-4", "Honey Circuit", "artist-honey", "Honey Circuit", [
    "neo soul",
    "alternative r&b",
  ]),
  makeTrack("soul-5", "Blue Hours", "artist-blue", "Blue Hours", [
    "neo soul",
    "jazz funk",
  ]),
  makeTrack("electronic-1", "Vector Bloom", "artist-vector", "Vector Bloom", [
    "electropop",
    "indietronica",
  ]),
  makeTrack("electronic-2", "Night Protocol", "artist-night", "Night Protocol", [
    "electropop",
    "synthpop",
  ]),
  makeTrack("electronic-3", "Parallel Light", "artist-parallel", "Parallel Light", [
    "indietronica",
    "synthpop",
  ]),
  makeTrack("electronic-4", "Signal Garden", "artist-signal", "Signal Garden", [
    "indietronica",
    "electronica",
  ]),
  makeTrack("folk-1", "Cedar Lines", "artist-cedar", "Cedar Lines", [
    "indie folk",
    "singer-songwriter",
  ]),
  makeTrack("folk-2", "North Window", "artist-north", "North Window", [
    "indie folk",
    "chamber folk",
  ]),
  makeTrack("folk-3", "Paper Pines", "artist-paper", "Paper Pines", [
    "chamber folk",
    "singer-songwriter",
  ]),
  makeTrack("folk-4", "Quiet County", "artist-quiet", "Quiet County", [
    "indie folk",
    "folk pop",
  ]),
  makeTrack("island-1", "Uncatalogued", "artist-island", "Unknown Current", []),
  makeTrack("duplicate", "Duplicate One", "artist-duplicate", "Duplicate", ["pop"]),
  makeTrack("duplicate", "Duplicate Two", "artist-duplicate", "Duplicate", ["pop"]),
];

export const expectedFixtureCommunities = {
  dream: ["dream-1", "dream-2", "dream-3", "dream-4", "dream-5"],
  electronic: ["electronic-1", "electronic-2", "electronic-3", "electronic-4"],
  folk: ["folk-1", "folk-2", "folk-3", "folk-4"],
  soul: ["soul-1", "soul-2", "soul-3", "soul-4", "soul-5"],
};

export const networkBenchmarkCases = [
  { seedId: "dream-1", expectedNeighborIds: ["dream-2", "dream-3", "dream-4", "dream-5"] },
  { seedId: "dream-2", expectedNeighborIds: ["dream-1", "dream-3", "dream-4", "dream-5"] },
  { seedId: "dream-3", expectedNeighborIds: ["dream-1", "dream-2", "dream-4", "dream-5"] },
  { seedId: "dream-4", expectedNeighborIds: ["dream-1", "dream-2", "dream-3", "dream-5"] },
  { seedId: "soul-1", expectedNeighborIds: ["soul-2", "soul-3", "soul-4", "soul-5"] },
  { seedId: "soul-2", expectedNeighborIds: ["soul-1", "soul-3", "soul-4", "soul-5"] },
  { seedId: "soul-3", expectedNeighborIds: ["soul-1", "soul-2", "soul-4", "soul-5"] },
  { seedId: "soul-4", expectedNeighborIds: ["soul-1", "soul-2", "soul-3", "soul-5"] },
  { seedId: "electronic-1", expectedNeighborIds: ["electronic-2", "electronic-3", "electronic-4"] },
  { seedId: "electronic-2", expectedNeighborIds: ["electronic-1", "electronic-3", "electronic-4"] },
  { seedId: "electronic-3", expectedNeighborIds: ["electronic-1", "electronic-2", "electronic-4"] },
  { seedId: "electronic-4", expectedNeighborIds: ["electronic-1", "electronic-2", "electronic-3"] },
  { seedId: "folk-1", expectedNeighborIds: ["folk-2", "folk-3", "folk-4"] },
  { seedId: "folk-2", expectedNeighborIds: ["folk-1", "folk-3", "folk-4"] },
  { seedId: "folk-3", expectedNeighborIds: ["folk-1", "folk-2", "folk-4"] },
  { seedId: "folk-4", expectedNeighborIds: ["folk-1", "folk-2", "folk-3"] },
] as const;
