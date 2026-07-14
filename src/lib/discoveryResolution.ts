import type { SpotifyTrack } from "@/lib/spotify";
import type { DiscoveryProposal } from "@/types/network";

const normalizeCatalogText = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const tokenCoverage = (expected: string, actual: string) => {
  const expectedTokens = new Set(normalizeCatalogText(expected).split(" ").filter(Boolean));
  const actualTokens = new Set(normalizeCatalogText(actual).split(" ").filter(Boolean));
  if (expectedTokens.size === 0 || actualTokens.size === 0) return 0;
  let matches = 0;
  expectedTokens.forEach((token) => {
    if (actualTokens.has(token)) matches += 1;
  });
  return matches / expectedTokens.size;
};

export interface ResolvedCatalogMatch {
  confidence: number;
  track: SpotifyTrack;
}

export const selectBestSpotifyMatch = (
  proposal: DiscoveryProposal,
  tracks: SpotifyTrack[],
): ResolvedCatalogMatch | null => {
  const ranked = tracks
    .map((track) => {
      const titleScore = tokenCoverage(proposal.title, track.name);
      const artistScore = track.artists.reduce(
        (best, artist) => Math.max(best, tokenCoverage(proposal.artist, artist.name)),
        0,
      );
      return {
        artistScore,
        confidence: titleScore * 0.7 + artistScore * 0.3,
        titleScore,
        track,
      };
    })
    .filter((match) => match.titleScore >= 0.75 && match.artistScore >= 0.75)
    .sort(
      (left, right) =>
        right.confidence - left.confidence || left.track.id.localeCompare(right.track.id),
    );

  return ranked[0]
    ? { confidence: ranked[0].confidence, track: ranked[0].track }
    : null;
};
