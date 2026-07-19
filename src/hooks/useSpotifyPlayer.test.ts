import { afterEach, describe, expect, it, vi } from "vitest";
import { addTrackToSpotifyQueue } from "@/hooks/useSpotifyPlayer";

describe("addTrackToSpotifyQueue", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds a track to the current Spotify playback queue", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await addTrackToSpotifyQueue({
      token: "access-token",
      uri: "spotify:track:abc123",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.spotify.com/v1/me/player/queue?uri=spotify%3Atrack%3Aabc123",
      {
        headers: { Authorization: "Bearer access-token" },
        method: "POST",
      },
    );
  });

  it("reports Spotify queue failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 403 })),
    );

    await expect(
      addTrackToSpotifyQueue({
        token: "access-token",
        uri: "spotify:track:abc123",
      }),
    ).rejects.toThrow("Spotify queue update failed (403)");
  });
});
