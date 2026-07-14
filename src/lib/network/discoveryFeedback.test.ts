import { describe, expect, it } from "vitest";
import {
  createEmptyDiscoverySession,
  parseDiscoverySession,
  rerankDiscoveryCandidates,
} from "@/lib/network/discoveryFeedback";
import type {
  DiscoveryCandidate,
  DiscoveryEvent,
  DiscoverySessionState,
} from "@/types/network";
import { makeTrack, networkFixtureTracks } from "@/lib/network/__tests__/fixtures";

const makeCandidate = (
  id: string,
  artistId: string,
  score = 0.2,
): DiscoveryCandidate => ({
  anchors: [
    {
      evidence: {
        album: 0,
        artist: 0,
        genre: 1,
        reasonCodes: ["shared_genre"],
        sharedGenres: ["dream pop"],
      },
      score,
      trackId: "dream-1",
    },
  ],
  confidence: "medium",
  mapped: true,
  proposal: {
    artist: `Artist ${artistId}`,
    matchedSeedIds: ["dream-1"],
    reason: "Shared dream-pop character.",
    title: `Candidate ${id}`,
  },
  recommendationId: `rec-${id}`,
  resolutionConfidence: 1,
  score,
  scope: "neighborhood",
  status: "unseen",
  track: makeTrack(
    id,
    `Candidate ${id}`,
    artistId,
    `Artist ${artistId}`,
    ["dream pop"],
  ),
});

const makeEvent = (
  type: DiscoveryEvent["type"],
  trackId: string,
  artistIds: string[],
): DiscoveryEvent => ({
  artistIds,
  exploration: "balanced",
  id: `${type}-${trackId}`,
  recommendationId: `rec-${trackId}`,
  scope: "neighborhood",
  timestamp: 123,
  trackId,
  type,
});

describe("discovery session persistence", () => {
  it("round-trips a bounded versioned session and rejects stale schemas", () => {
    const candidate = makeCandidate("candidate-a", "artist-new");
    const state: DiscoverySessionState = {
      candidates: [candidate],
      dismissedTrackIds: ["dismissed-a", "dismissed-a"],
      events: [makeEvent("candidate_shown", candidate.track.id, ["artist-new"])],
      exploration: "adventurous",
      schemaVersion: 1,
      summary: "A discovery pocket",
      updatedAt: 123,
    };
    const restored = parseDiscoverySession(JSON.stringify(state));

    expect(restored.candidates[0].track.id).toBe(candidate.track.id);
    expect(restored.dismissedTrackIds).toEqual(["dismissed-a"]);
    expect(restored.exploration).toBe("adventurous");
    expect(
      parseDiscoverySession(JSON.stringify({ ...state, schemaVersion: 2 })),
    ).toEqual(createEmptyDiscoverySession());
  });
});

describe("feedback-aware discovery ranking", () => {
  it("uses exploration mode and explicit feedback without changing map scores", () => {
    const knownArtistId = networkFixtureTracks[0].artists[0].id;
    const familiar = makeCandidate("known", knownArtistId);
    const novel = makeCandidate("novel", "artist-never-liked");

    expect(
      rerankDiscoveryCandidates(
        [novel, familiar],
        networkFixtureTracks,
        "familiar",
        [],
      )[0].track.id,
    ).toBe("known");
    expect(
      rerankDiscoveryCandidates(
        [familiar, novel],
        networkFixtureTracks,
        "adventurous",
        [],
      )[0].track.id,
    ).toBe("novel");
    expect(
      rerankDiscoveryCandidates(
        [familiar, novel],
        networkFixtureTracks,
        "adventurous",
        [
          makeEvent("candidate_dismissed", novel.track.id, ["artist-never-liked"]),
          {
            ...makeEvent(
              "candidate_dismissed",
              novel.track.id,
              ["artist-never-liked"],
            ),
            id: "second-dismissal",
          },
        ],
      )[0].track.id,
    ).toBe("known");
    expect(familiar.score).toBe(0.2);
    expect(novel.score).toBe(0.2);
  });
});
