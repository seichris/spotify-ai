import { describe, expect, it } from "vitest";
import { buildPlaybackQueue } from "@/lib/network/buildPlaybackQueue";

const tracks = [
  { id: "one", uri: "spotify:track:one" },
  { id: "two", uri: "spotify:track:two" },
  { id: "three", uri: "spotify:track:three" },
];

describe("buildPlaybackQueue", () => {
  it("starts with the selected song and wraps through the visible order", () => {
    expect(buildPlaybackQueue(tracks, "two")).toEqual([
      "spotify:track:two",
      "spotify:track:three",
      "spotify:track:one",
    ]);
  });

  it("deduplicates songs before rotating the queue", () => {
    expect(
      buildPlaybackQueue([...tracks, tracks[1]], "two"),
    ).toEqual([
      "spotify:track:two",
      "spotify:track:three",
      "spotify:track:one",
    ]);
  });

  it("returns no queue when the selected song is unavailable", () => {
    expect(buildPlaybackQueue(tracks, "missing")).toEqual([]);
  });
});
