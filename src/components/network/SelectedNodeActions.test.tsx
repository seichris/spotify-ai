// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SelectedNodeActions from "@/components/network/SelectedNodeActions";
import { makeTrack } from "@/lib/network/__tests__/fixtures";

const mocks = vi.hoisted(() => ({
  afterRender: null as (() => void) | null,
  cameraUpdated: null as (() => void) | null,
  viewport: { x: 300, y: 220 },
}));

vi.mock("@react-sigma/core", () => ({
  useSigma: () => ({
    framedGraphToViewport: () => mocks.viewport,
    getCamera: () => ({
      off: vi.fn(),
      on: (event: string, callback: () => void) => {
        if (event === "updated") mocks.cameraUpdated = callback;
      },
    }),
    getDimensions: () => ({ height: 500, width: 600 }),
    getNodeDisplayData: () => ({ size: 12, x: 0.5, y: 0.5 }),
    off: vi.fn(),
    on: (event: string, callback: () => void) => {
      if (event === "afterRender") mocks.afterRender = callback;
    },
    scaleSize: () => 48,
  }),
}));

const track = makeTrack(
  "liked-a",
  "Ojos Lindos",
  "artist-a",
  "Artist A",
  ["latin pop"],
);

describe("SelectedNodeActions", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    mocks.afterRender = null;
    mocks.cameraUpdated = null;
    mocks.viewport = { x: 300, y: 220 };
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("shows an elevated title and icon-only play and queue controls", async () => {
    const onPlay = vi.fn(async () => undefined);
    const onQueue = vi.fn(async () => undefined);
    await act(async () => {
      root.render(
        <SelectedNodeActions
          onPlay={onPlay}
          onQueue={onQueue}
          track={track}
        />,
      );
    });
    await act(async () => mocks.afterRender?.());

    const playButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Play Ojos Lindos"]',
    );
    const queueButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Add to queue: Ojos Lindos"]',
    );
    const title = Array.from(container.querySelectorAll("div")).find(
      (element) => element.textContent === "Ojos Lindos",
    );

    expect(title?.style.top).toBe("158px");
    expect(playButton?.textContent).toBe("");
    expect(queueButton?.textContent).toBe("");

    await act(async () => playButton?.click());
    await act(async () => queueButton?.click());

    expect(onPlay).toHaveBeenCalledWith(track);
    expect(onQueue).toHaveBeenCalledWith(track);
    expect(
      container.querySelector('[aria-label="Queue again: Ojos Lindos"]'),
    ).not.toBeNull();
  });

  it("follows camera movement and flips actions away from the viewport edge", async () => {
    await act(async () => {
      root.render(
        <SelectedNodeActions
          onPlay={vi.fn(async () => undefined)}
          onQueue={vi.fn(async () => undefined)}
          track={track}
        />,
      );
    });
    await act(async () => mocks.afterRender?.());

    mocks.viewport = { x: 580, y: 180 };
    await act(async () => mocks.cameraUpdated?.());

    const actions = container.querySelector<HTMLButtonElement>(
      '[aria-label="Play Ojos Lindos"]',
    )?.parentElement;
    expect(actions?.style.left).toBe("520px");
    expect(actions?.style.transform).toBe("translateX(-100%)");
  });
});
