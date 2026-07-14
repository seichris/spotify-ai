export interface SpotifyRefreshResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export const isSpotifyAccessTokenCurrent = (
  expiresAt: number | undefined,
  now = Date.now(),
) => Boolean(expiresAt && now < expiresAt * 1000 - 60_000);

export const mergeSpotifyRefresh = (
  currentRefreshToken: string,
  response: SpotifyRefreshResponse,
  now = Date.now(),
) => ({
  access_token: response.access_token,
  expires_at: Math.floor(now / 1000 + response.expires_in),
  refresh_token: response.refresh_token ?? currentRefreshToken,
});
