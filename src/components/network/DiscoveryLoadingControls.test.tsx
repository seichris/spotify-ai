// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DiscoveryControls from "@/components/network/DiscoveryControls";
import DiscoveryTray from "@/components/network/DiscoveryTray";
import { makeTrack } from "@/lib/network/__tests__/fixtures";
import type { DiscoveryCandidate } from "@/types/network";

const candidate: DiscoveryCandidate = {
  anchors: [],
  confidence: "medium",
  mapped: true,
  proposal: {
    artist: "Candidate Artist",
    matchedSeedIds: ["seed"],
    reason: "A related discovery.",
    title: "Candidate Song",
  },
  recommendationExploration: "balanced",
  recommendationId: "candidate-recommendation",
  resolutionConfidence: 1,
  scope: "song",
  score: 0.8,
  status: "unseen",
  track: makeTrack(
    "candidate-track",
    "Candidate Song",
    "candidate-artist",
    "Candidate Artist",
    ["dream pop"],
  ),
};

describe("discovery loading controls", () => {
  it("does not offer cancel or history reset while impressions are pending", () => {
    const tray = renderToStaticMarkup(
      <DiscoveryTray
        candidates={[candidate]}
        error={null}
        feedbackError={null}
        feedbackStates={{}}
        feedbackStats={[]}
        isPlaybackPaused={false}
        isLoading
        onAddToPlaylist={vi.fn()}
        onClear={vi.fn()}
        onDismiss={vi.fn()}
        onFeedback={vi.fn()}
        onPlay={vi.fn()}
        onSave={vi.fn()}
        onSelect={vi.fn()}
        onTogglePlayback={vi.fn()}
        playlistStates={{}}
        saveStates={{}}
        summary=""
      />,
    );
    const controls = renderToStaticMarkup(
      <DiscoveryControls
        eventCount={1}
        exploration="balanced"
        hasRestored
        isLoading
        onChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(tray).toContain('aria-label="Discovery in progress"');
    expect(tray).not.toContain('aria-label="Cancel discovery"');
    expect(tray).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Discovery in progress"/);
    expect(tray.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(8);
    expect(controls).toMatch(/<select[^>]*aria-label="Discovery range"[^>]*disabled=""/);
    expect(controls).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Reset discovery history"/);
  });

  it("collapses the tray before focusing a mapped candidate", async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onSelect = vi.fn();

    await act(async () => {
      root.render(
        <DiscoveryTray
          candidates={[candidate]}
          error={null}
          feedbackError={null}
          feedbackStates={{}}
          feedbackStats={[]}
          isPlaybackPaused
          isLoading={false}
          onAddToPlaylist={vi.fn()}
          onClear={vi.fn()}
          onDismiss={vi.fn()}
          onFeedback={vi.fn()}
          onPlay={vi.fn()}
          onSave={vi.fn()}
          onSelect={onSelect}
          onTogglePlayback={vi.fn()}
          playlistStates={{}}
          saveStates={{}}
          summary=""
        />,
      );
    });

    const mapButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Map"),
    );
    mapButton?.focus();
    expect(document.activeElement).toBe(mapButton);
    await act(async () => mapButton?.click());
    expect(onSelect).toHaveBeenCalledWith(candidate);
    expect(container.querySelector("aside")).toBeNull();

    const reopenButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Show nearby discoveries"]',
    );
    expect(reopenButton).not.toBeNull();
    expect(document.activeElement).toBe(reopenButton);
    await act(async () => reopenButton?.click());
    expect(container.querySelector("aside")).not.toBeNull();
    const restoredMapButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Map"));
    expect(document.activeElement).toBe(restoredMapButton);

    await act(async () => root.unmount());
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });
});
