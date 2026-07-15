import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";
import { normalizeLibrary } from "@/lib/network/buildFeatures";
import {
  GRAPH_CACHE_SCHEMA_VERSION,
  GRAPH_LAYOUT_VERSION,
  GRAPH_MODEL_VERSION,
} from "@/lib/network/graphConfig";
import { hashHex } from "@/lib/network/hash";
import type { GraphCachePayload } from "@/types/network";

const GRAPH_CACHE_KEY = `spotify_song_graph_cache_v${GRAPH_CACHE_SCHEMA_VERSION}`;

export const createLibraryFingerprint = (tracks: EnrichedTrack[]) => {
  const trackSignatures = normalizeLibrary(tracks).map((track) =>
    [
      track.id,
      track.album.id,
      track.artists.map((artist) => artist.id).sort().join(","),
      track.genres.join(","),
      track.features?.energy ?? "",
      track.features?.tempo ?? "",
    ].join(":"),
  );
  const source = [
    GRAPH_MODEL_VERSION,
    GRAPH_LAYOUT_VERSION,
    ...trackSignatures,
  ].join("|");
  return `${trackSignatures.length}-${hashHex(source)}${hashHex(
    source.split("").reverse().join(""),
  )}`;
};

export const isGraphCacheValid = (
  payload: GraphCachePayload,
  libraryFingerprint: string,
) =>
  payload.cacheSchemaVersion === GRAPH_CACHE_SCHEMA_VERSION &&
  payload.modelVersion === GRAPH_MODEL_VERSION &&
  payload.layoutVersion === GRAPH_LAYOUT_VERSION &&
  payload.libraryFingerprint === libraryFingerprint;

export const loadGraphCache = (libraryFingerprint: string) => {
  if (typeof window === "undefined") return null;

  try {
    const serialized = window.localStorage.getItem(GRAPH_CACHE_KEY);
    if (!serialized) return null;
    const payload = JSON.parse(serialized) as GraphCachePayload;
    return isGraphCacheValid(payload, libraryFingerprint) ? payload : null;
  } catch (error) {
    console.warn("Ignoring an unreadable song graph cache", error);
    return null;
  }
};

export const saveGraphCache = (payload: GraphCachePayload) => {
  if (typeof window === "undefined") return false;

  try {
    window.localStorage.setItem(GRAPH_CACHE_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn("Could not persist the song graph cache", error);
    return false;
  }
};
