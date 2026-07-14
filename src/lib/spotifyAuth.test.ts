import { describe, expect, it } from "vitest";
import {
  isSpotifyAccessTokenCurrent,
  mergeSpotifyRefresh,
} from "@/lib/spotifyAuth";

describe("Spotify token refresh state", () => {
  it("refreshes inside the one-minute expiry margin", () => {
    const now = 1_000_000;
    expect(isSpotifyAccessTokenCurrent((now + 61_000) / 1000, now)).toBe(true);
    expect(isSpotifyAccessTokenCurrent((now + 60_000) / 1000, now)).toBe(false);
    expect(isSpotifyAccessTokenCurrent(undefined, now)).toBe(false);
  });

  it("preserves a one-time refresh token when Spotify omits a replacement", () => {
    expect(
      mergeSpotifyRefresh(
        "original-refresh",
        { access_token: "new-access", expires_in: 3600 },
        1_000_000,
      ),
    ).toEqual({
      access_token: "new-access",
      expires_at: 4600,
      refresh_token: "original-refresh",
    });
  });
});
