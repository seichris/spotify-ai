const SPOTIFY_TRACK_URI = /^spotify:track:[A-Za-z0-9]{22}$/;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

export const normalizeSpotifyId = (value: unknown) =>
  typeof value === "string" && SPOTIFY_ID.test(value) ? value : null;

export const normalizeTrackUris = (value: unknown, limit = 40) => {
  if (!Array.isArray(value) || value.length === 0 || value.length > limit) {
    return null;
  }
  const unique = Array.from(new Set(value));
  if (
    unique.some(
      (uri) => typeof uri !== "string" || !SPOTIFY_TRACK_URI.test(uri),
    )
  ) {
    return null;
  }
  return unique as string[];
};
