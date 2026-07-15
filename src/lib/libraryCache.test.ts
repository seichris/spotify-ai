import { describe, expect, it, vi } from "vitest";
import {
  compactLibraryTrack,
  LIBRARY_CACHE_KEY,
  persistLibraryCache,
} from "@/lib/libraryCache";
import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";

const track = {
  added_at: "2026-07-15T00:00:00Z",
  album: {
    id: "album-id",
    images: [{ height: 640, url: "https://example.test/cover.jpg", width: 640 }],
    name: "Album",
    available_markets: ["US", "SG"],
  },
  artists: [
    {
      external_urls: { spotify: "https://open.spotify.com/artist/id" },
      id: "artist-id",
      name: "Artist",
    },
  ],
  available_markets: ["US", "SG"],
  duration_ms: 180_000,
  features: { energy: 0.8, tempo: 120 },
  genres: ["indie pop"],
  id: "track-id",
  is_local: false,
  is_playable: true,
  name: "Track",
  type: "track",
  uri: "spotify:track:track-id",
} as unknown as EnrichedTrack;

describe("liked-song library cache", () => {
  it("removes large Spotify response fields before persistence", () => {
    const compact = compactLibraryTrack(track) as EnrichedTrack &
      Record<string, unknown>;

    expect(compact.available_markets).toBeUndefined();
    expect(compact.album.images).toEqual([
      { url: "https://example.test/cover.jpg" },
    ]);
    expect(compact.artists).toEqual([{ id: "artist-id", name: "Artist" }]);
  });

  it("clears the cache and reports failure when storage quota is exceeded", () => {
    const storage = {
      removeItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new DOMException("Storage quota exceeded", "QuotaExceededError");
      }),
    };

    expect(
      persistLibraryCache(storage, {
        hasMore: false,
        offset: 1,
        songs: [track],
        timestamp: 1,
        total: 1,
      }),
    ).toBe(false);
    expect(storage.removeItem).toHaveBeenCalledWith(LIBRARY_CACHE_KEY);
  });
});
