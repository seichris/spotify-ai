import { describe, expect, it } from "vitest";
import { parseAudioFeaturesResponse } from "@/lib/reccobeats";

describe("ReccoBeats audio-feature parsing", () => {
  it("maps valid public Spotify track URLs to tempo and energy", () => {
    const features = parseAudioFeaturesResponse({
      content: [
        {
          energy: 0.81,
          href: "https://open.spotify.com/track/7Mts0OfPorF4iwOomvfqn1",
          tempo: 124.5,
        },
      ],
    });

    expect(features.get("7Mts0OfPorF4iwOomvfqn1")).toEqual({
      energy: 0.81,
      tempo: 124.5,
    });
  });

  it("ignores malformed IDs and out-of-range values", () => {
    const features = parseAudioFeaturesResponse({
      content: [
        { energy: 2, href: "https://open.spotify.com/track/bad", tempo: 120 },
        {
          energy: 0.5,
          href: "https://open.spotify.com/track/0DiWol3AO6WpXZgp0goxAV",
          tempo: 0,
        },
      ],
    });

    expect(features.size).toBe(0);
  });
});
