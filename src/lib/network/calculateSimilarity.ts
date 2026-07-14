import { GRAPH_SIMILARITY_WEIGHTS } from "@/lib/network/graphConfig";
import type { SongFeature } from "@/lib/network/buildFeatures";
import type { SimilarityEvidence } from "@/types/network";

export interface SimilarityResult {
  evidence: SimilarityEvidence;
  score: number;
}

const intersect = (left: string[], right: string[]) => {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
};

export const calculateSimilarity = (
  left: SongFeature,
  right: SongFeature,
  genreIdf: Map<string, number>,
): SimilarityResult => {
  const sharedGenres = intersect(left.genres, right.genres);
  const genreUnion = new Set([...left.genres, ...right.genres]);
  const sharedGenreWeight = sharedGenres.reduce(
    (total, genre) => total + (genreIdf.get(genre) ?? 1),
    0,
  );
  const unionGenreWeight = Array.from(genreUnion).reduce(
    (total, genre) => total + (genreIdf.get(genre) ?? 1),
    0,
  );
  const genre =
    unionGenreWeight === 0 ? 0 : sharedGenreWeight / unionGenreWeight;
  const sharedArtists = intersect(left.artistIds, right.artistIds);
  const artist = sharedArtists.length > 0 ? 1 : 0;
  const album =
    Boolean(left.albumId) && left.albumId === right.albumId ? 1 : 0;
  const reasonCodes: string[] = [];

  if (sharedGenres.length > 0) reasonCodes.push("shared_genre");
  if (sharedArtists.length > 0) reasonCodes.push("shared_artist");
  if (album > 0) reasonCodes.push("shared_album");

  const score =
    GRAPH_SIMILARITY_WEIGHTS.genre * genre +
    GRAPH_SIMILARITY_WEIGHTS.artist * artist +
    GRAPH_SIMILARITY_WEIGHTS.album * album;

  return {
    evidence: {
      album,
      artist,
      genre,
      reasonCodes,
      sharedGenres,
    },
    score: Math.max(0, Math.min(1, score)),
  };
};
