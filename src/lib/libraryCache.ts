import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";

export const LIBRARY_CACHE_KEY = "spotify_library_cache_v2";

interface LibraryCachePayload {
  hasMore: boolean;
  offset: number;
  songs: EnrichedTrack[];
  timestamp: number;
  total: number;
}

interface WritableStorage {
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
}

export const compactLibraryTrack = (
  track: EnrichedTrack,
): EnrichedTrack => ({
  added_at: track.added_at,
  album: {
    id: track.album.id,
    images: (track.album.images ?? []).map(({ url }) => ({ url })),
    name: track.album.name,
  },
  artists: (track.artists ?? []).map(({ id, name }) => ({ id, name })),
  duration_ms: track.duration_ms,
  features: track.features
    ? { energy: track.features.energy, tempo: track.features.tempo }
    : null,
  genres: [...(track.genres ?? [])],
  id: track.id,
  is_local: track.is_local,
  is_playable: track.is_playable,
  name: track.name,
  type: track.type,
  uri: track.uri,
});

export const persistLibraryCache = (
  storage: WritableStorage,
  payload: LibraryCachePayload,
) => {
  try {
    storage.setItem(
      LIBRARY_CACHE_KEY,
      JSON.stringify({
        ...payload,
        songs: payload.songs.map(compactLibraryTrack),
      }),
    );
    return true;
  } catch {
    try {
      storage.removeItem(LIBRARY_CACHE_KEY);
    } catch {
      // Storage can also reject cleanup in restricted browser contexts.
    }
    return false;
  }
};
