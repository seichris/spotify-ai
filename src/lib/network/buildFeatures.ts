import type { EnrichedTrack } from "@/hooks/useSpotifyLibrary";

export interface SongFeature {
  albumId: string;
  artistIds: string[];
  genres: string[];
  track: EnrichedTrack;
}

export interface SongFeatureSet {
  features: SongFeature[];
  genreIdf: Map<string, number>;
}

export const normalizeGenre = (genre: string) =>
  genre.trim().toLowerCase().replace(/\s+/g, " ");

const normalizeGenres = (genres: string[]) =>
  Array.from(new Set(genres.map(normalizeGenre).filter(Boolean))).sort();

const trackPreferenceSignature = (track: EnrichedTrack) =>
  [
    track.name,
    track.uri,
    track.album.id,
    track.album.name,
    track.artists.map((artist) => `${artist.id}:${artist.name}`).join("|"),
    track.genres.join("|"),
  ].join("\u0000");

export const normalizeLibrary = (
  tracks: EnrichedTrack[],
): EnrichedTrack[] => {
  const normalizedById = new Map<string, EnrichedTrack>();

  tracks.forEach((track) => {
    if (!track?.id || track.type !== "track" || track.is_local) return;

    const normalizedTrack = {
      ...track,
      album: {
        ...track.album,
        id: track.album.id ?? "",
      },
      artists: track.artists.filter((artist) => Boolean(artist.id)),
      genres: normalizeGenres(track.genres ?? []),
    };
    const current = normalizedById.get(track.id);
    const signature = trackPreferenceSignature(normalizedTrack);
    const currentSignature = current ? trackPreferenceSignature(current) : null;
    if (!currentSignature || signature.localeCompare(currentSignature) < 0) {
      normalizedById.set(track.id, normalizedTrack);
    }
  });

  return Array.from(normalizedById.values()).sort((left, right) =>
    left.id.localeCompare(right.id),
  );
};

export const createSongFeatures = (tracks: EnrichedTrack[]): SongFeature[] =>
  normalizeLibrary(tracks).map((track) => ({
    albumId: track.album.id,
    artistIds: Array.from(
      new Set(track.artists.map((artist) => artist.id).filter(Boolean)),
    ).sort(),
    genres: track.genres,
    track,
  }));

export const buildFeatures = (tracks: EnrichedTrack[]): SongFeatureSet => {
  const normalizedTracks = normalizeLibrary(tracks);
  const documentFrequency = new Map<string, number>();

  normalizedTracks.forEach((track) => {
    track.genres.forEach((genre) => {
      documentFrequency.set(genre, (documentFrequency.get(genre) ?? 0) + 1);
    });
  });

  const genreIdf = new Map<string, number>();
  documentFrequency.forEach((frequency, genre) => {
    genreIdf.set(
      genre,
      Math.log((normalizedTracks.length + 1) / (frequency + 1)) + 1,
    );
  });

  return {
    features: createSongFeatures(normalizedTracks),
    genreIdf,
  };
};
