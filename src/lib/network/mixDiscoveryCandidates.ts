import type { DiscoveryCandidate } from "@/types/network";
import type { RecommendationStrategyAllocation } from "@/lib/network/recommendationLearning";

const shuffle = (
  candidates: DiscoveryCandidate[],
  random: () => number,
) => {
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
  const mixed = [
    ...songCandidates.slice(0, allocation.song),
    ...neighborhoodCandidates.slice(0, allocation.neighborhood),
  ];
  const byTrack = new Map<string, DiscoveryCandidate[]>();
  mixed.forEach((candidate) => {
    const candidates = byTrack.get(candidate.track.id) ?? [];
    candidates.push(candidate);
    byTrack.set(candidate.track.id, candidates);
  });
  const unique = Array.from(
    byTrack.values(),
    (candidates) =>
      candidates.length === 1
        ? candidates[0]
        : candidates[Math.floor(random() * candidates.length)],
  );
  return shuffle(unique, random);
};
