import { describe, expect, it } from "vitest";
import {
  normalizeSpotifyId,
  normalizeTrackUris,
} from "@/lib/spotifyValidation";

describe("Spotify library mutations", () => {
  it("accepts bounded track URIs, deduplicates them, and rejects other resources", () => {
    expect(
      normalizeTrackUris([
        "spotify:track:abcdefghijklmnopqrstuv",
        "spotify:track:abcdefghijklmnopqrstuv",
        "spotify:track:1234567890abcdefghijkl",
      ]),
    ).toEqual([
      "spotify:track:abcdefghijklmnopqrstuv",
      "spotify:track:1234567890abcdefghijkl",
    ]);
    expect(normalizeTrackUris(["spotify:album:abc123"])).toBeNull();
    expect(normalizeTrackUris([])).toBeNull();
    expect(
      normalizeTrackUris(
        Array.from(
          { length: 41 },
          (_, index) => `spotify:track:${index.toString().padStart(22, "0")}`,
        ),
      ),
    ).toBeNull();
  });

  it("accepts only canonical Spotify resource IDs", () => {
    expect(normalizeSpotifyId("abcdefghijklmnopqrstuv")).toBe(
      "abcdefghijklmnopqrstuv",
    );
    expect(normalizeSpotifyId("too-short")).toBeNull();
    expect(normalizeSpotifyId("../../unexpected-value!")).toBeNull();
  });
});
