import { EnrichedTrack } from "@/hooks/useSpotifyLibrary";

export interface SimilarityResult {
    song: EnrichedTrack;
    score: number;
}

export function calculateSimilarity(sourceSong: EnrichedTrack, allSongs: EnrichedTrack[]): SimilarityResult[] {
    // If source has no genres, we can't find similar songs by genre
    if (!sourceSong.genres || sourceSong.genres.length === 0) {
        return [];
    }

    const sourceGenres = new Set(sourceSong.genres);

    const results = allSongs
        .filter(song => song.id !== sourceSong.id) // Don't compare with self
        .map(song => {
            if (!song.genres || song.genres.length === 0) {
                return { song, score: 0 };
            }

            // Jaccard Index for Genre Similarity
            // Intersection / Union
            const otherGenres = new Set(song.genres);

            let intersectionCount = 0;
            sourceGenres.forEach(g => {
                if (otherGenres.has(g)) intersectionCount++;
            });

            const unionCount = sourceGenres.size + otherGenres.size - intersectionCount;

            const score = unionCount === 0 ? 0 : intersectionCount / unionCount;

            return { song, score };
        })
        .filter(result => result.score > 0) // Only return songs with at least some similarity
        .sort((a, b) => b.score - a.score) // Sort by score descending
        .slice(0, 20); // Return top 20

    return results;
}
