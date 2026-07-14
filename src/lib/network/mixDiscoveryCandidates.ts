import type { DiscoveryCandidate } from "@/types/network";

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
) => {
  const mixed = [
    ...songCandidates.slice(0, 5),
    ...neighborhoodCandidates.slice(0, 5),
  ];
  const unique = Array.from(
    new Map(mixed.map((candidate) => [candidate.track.id, candidate])).values(),
  );
  return shuffle(unique, random);
};
