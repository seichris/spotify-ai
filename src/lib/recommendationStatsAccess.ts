export const canViewRecommendationStats = (
  spotifyUserId: string | null | undefined,
  configuredOwnerId: string | null | undefined,
) => {
  const ownerId = configuredOwnerId?.trim();
  return Boolean(spotifyUserId && ownerId && spotifyUserId === ownerId);
};
