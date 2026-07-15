import type { DiscoveryCandidate } from "@/types/network";
import type { RecommendationStrategyAllocation } from "@/lib/network/recommendationLearning";

const shuffle = <T>(candidates: T[], random: () => number) => {
  const result = [...candidates];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

export const mixDiscoveryCandidates = (
  songCandidates: DiscoveryCandidate[],
  neighborhoodCandidates: DiscoveryCandidate[],
  random: () => number = Math.random,
  allocation: RecommendationStrategyAllocation = { neighborhood: 5, song: 5 },
) => {
  const pools = {
    neighborhood: neighborhoodCandidates,
    song: songCandidates,
  };
  const songTrackIds = new Set(songCandidates.map((item) => item.track.id));
  const neighborhoodTrackIds = new Set(
    neighborhoodCandidates.map((item) => item.track.id),
  );
  const sharedTrackIds = Array.from(songTrackIds).filter((trackId) =>
    neighborhoodTrackIds.has(trackId),
  );
  const uniqueSongCount = Array.from(songTrackIds).filter(
    (trackId) => !neighborhoodTrackIds.has(trackId),
  ).length;
  const uniqueNeighborhoodCount = Array.from(neighborhoodTrackIds).filter(
    (trackId) => !songTrackIds.has(trackId),
  ).length;
  const minimumSharedSong = Math.max(0, allocation.song - uniqueSongCount);
  const minimumSharedNeighborhood = Math.max(
    0,
    allocation.neighborhood - uniqueNeighborhoodCount,
  );
  const sharedOwners = new Map<
    string,
    keyof RecommendationStrategyAllocation
  >();
  const randomizedSharedTrackIds = shuffle(sharedTrackIds, random);

  if (
    minimumSharedSong + minimumSharedNeighborhood <=
    randomizedSharedTrackIds.length
  ) {
    randomizedSharedTrackIds.forEach((trackId, index) => {
      if (index < minimumSharedSong) {
        sharedOwners.set(trackId, "song");
      } else if (
        index < minimumSharedSong + minimumSharedNeighborhood
      ) {
        sharedOwners.set(trackId, "neighborhood");
      } else {
        sharedOwners.set(
          trackId,
          random() < 0.5 ? "song" : "neighborhood",
        );
      }
    });
  } else {
    randomizedSharedTrackIds.forEach((trackId) => {
      sharedOwners.set(
        trackId,
        random() < 0.5 ? "song" : "neighborhood",
      );
    });
  }

  const selected: DiscoveryCandidate[] = [];
  const selectedTrackIds = new Set<string>();

  (["song", "neighborhood"] as const).forEach((strategy) => {
    let selectedForStrategy = 0;
    for (const candidate of pools[strategy]) {
      if (selectedForStrategy >= allocation[strategy]) break;
      if (selectedTrackIds.has(candidate.track.id)) continue;
      const sharedOwner = sharedOwners.get(candidate.track.id);
      if (sharedOwner && sharedOwner !== strategy) continue;
      selected.push(candidate);
      selectedTrackIds.add(candidate.track.id);
      selectedForStrategy += 1;
    }
  });

  return shuffle(selected, random);
};
