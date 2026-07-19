// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SelectedNodeActions from "@/components/network/SelectedNodeActions";
import { makeTrack } from "@/lib/network/__tests__/fixtures";

const mocks = vi.hoisted(() => ({
  afterRender: null as (() => void) | null,
  cameraOff: vi.fn(),
  cameraUpdated: null as (() => void) | null,
  dimensions: { height: 500, width: 600 },
  resize: null as (() => void) | null,
  sigmaOff: vi.fn(),
  viewport: { x: 300, y: 220 },
}));

vi.mock("@react-sigma/core", () => ({
  useSigma: () => ({
    framedGraphToViewport: () => mocks.viewport,
    getCamera: () => ({
      off: mocks.cameraOff,
      on: (event: string, callback: () => void) => {
        if (event === "updated") mocks.cameraUpdated = callback;
      },
    }),
    getDimensions: () => mocks.dimensions,
    getNodeDisplayData: () => ({ size: 12, x: 0.5, y: 0.5 }),
    off: mocks.sigmaOff,
    on: (event: string, callback: () => void) => {
      if (event === "afterRender") mocks.afterRender = callback;
      if (event === "resize") mocks.resize = callback;
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
    mocks.cameraOff.mockReset();
    mocks.cameraUpdated = null;
    mocks.dimensions = { height: 500, width: 600 };
    mocks.resize = null;
    mocks.sigmaOff.mockReset();
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

    expect(title?.style.top).toBe("126px");
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

  it("keeps play disabled while still allowing queue", async () => {
    const onPlay = vi.fn(async () => undefined);
    const onQueue = vi.fn(async () => undefined);
    await act(async () => {
      root.render(
        <SelectedNodeActions
          onPlay={onPlay}
          onQueue={onQueue}
          playDisabled
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
    await act(async () => playButton?.click());
    await act(async () => queueButton?.click());

    expect(playButton?.disabled).toBe(true);
    expect(onPlay).not.toHaveBeenCalled();
    expect(onQueue).toHaveBeenCalledOnce();
  });

  it("blocks duplicate actions while a request is pending", async () => {
    let finishPlay = () => undefined;
    const onPlay = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishPlay = resolve;
        }),
    );
    await act(async () => {
      root.render(
        <SelectedNodeActions
          onPlay={onPlay}
          onQueue={vi.fn(async () => undefined)}
          track={track}
        />,
      );
    });
    await act(async () => mocks.afterRender?.());

    const playButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Play Ojos Lindos"]',
    );
    await act(async () => playButton?.click());
    expect(playButton?.disabled).toBe(true);
    await act(async () => playButton?.click());
    expect(onPlay).toHaveBeenCalledOnce();

    await act(async () => finishPlay());
    expect(playButton?.disabled).toBe(false);
  });

  it.each(["play", "queue"] as const)(
    "announces a failed %s action without showing queue success",
    async (failedAction) => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const onPlay = vi.fn(async () => {
        if (failedAction === "play") throw new Error("play failed");
      });
      const onQueue = vi.fn(async () => {
        if (failedAction === "queue") throw new Error("queue failed");
      });
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

      const button = container.querySelector<HTMLButtonElement>(
        failedAction === "play"
          ? '[aria-label="Play Ojos Lindos"]'
          : '[aria-label="Add to queue: Ojos Lindos"]',
      );
      await act(async () => button?.click());

      expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(
        failedAction === "play"
          ? "Could not play Ojos Lindos"
          : "Could not queue Ojos Lindos",
      );
      expect(button?.className).toContain("ring-red-500");
      expect(
        container.querySelector('[aria-label="Queue again: Ojos Lindos"]'),
      ).toBeNull();
      errorSpy.mockRestore();
    },
  );

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
    expect(actions?.style.left).toBe("476px");
    expect(actions?.style.transform).toBe("");
  });

  it("keeps the title and both actions separate inside every viewport corner", async () => {
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

    for (const viewport of [
      { x: 48, y: 48 },
      { x: 552, y: 48 },
      { x: 48, y: 452 },
      { x: 552, y: 452 },
    ]) {
      mocks.viewport = viewport;
      await act(async () => mocks.cameraUpdated?.());

      const playButton = container.querySelector<HTMLButtonElement>(
        '[aria-label="Play Ojos Lindos"]',
      );
      const actions = playButton?.parentElement;
      const title = Array.from(container.querySelectorAll("div")).find(
        (element) => element.textContent === "Ojos Lindos",
      );
      const actionLeft = Number.parseFloat(actions?.style.left ?? "NaN");
      const actionTop = Number.parseFloat(actions?.style.top ?? "NaN");
      const titleCenter = Number.parseFloat(title?.style.left ?? "NaN");
      const titleTop = Number.parseFloat(title?.style.top ?? "NaN");
      const titleWidth = Number.parseFloat(title?.style.maxWidth ?? "NaN");
      const overlaps =
        titleCenter - titleWidth / 2 < actionLeft + 44 &&
        titleCenter + titleWidth / 2 > actionLeft &&
        titleTop < actionTop + 96 &&
        titleTop + 32 > actionTop;

      expect(actionLeft).toBeGreaterThanOrEqual(12);
      expect(actionLeft + 44).toBeLessThanOrEqual(588);
      expect(actionTop).toBeGreaterThanOrEqual(12);
      expect(actionTop + 96).toBeLessThanOrEqual(488);
      expect(titleCenter - titleWidth / 2).toBeGreaterThanOrEqual(12);
      expect(titleCenter + titleWidth / 2).toBeLessThanOrEqual(588);
      expect(titleTop).toBeGreaterThanOrEqual(12);
      expect(titleTop + 32).toBeLessThanOrEqual(488);
      expect(overlaps).toBe(false);
    }
  });

  it("hides the whole overlay when the selected artwork is offscreen", async () => {
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

    mocks.viewport = { x: 300, y: -100 };
    await act(async () => mocks.cameraUpdated?.());
    expect(container.textContent).toBe("");

    mocks.viewport = { x: 300, y: 600 };
    await act(async () => mocks.cameraUpdated?.());
    expect(container.textContent).toBe("");
  });

  it("recomputes viewport bounds on resize and removes every listener", async () => {
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
    const afterRender = mocks.afterRender;
    const resize = mocks.resize;
    const cameraUpdated = mocks.cameraUpdated;

    mocks.dimensions = { height: 400, width: 400 };
    mocks.viewport = { x: 380, y: 200 };
    await act(async () => mocks.resize?.());
    const actions = container.querySelector<HTMLButtonElement>(
      '[aria-label="Play Ojos Lindos"]',
    )?.parentElement;
    expect(actions?.style.left).toBe("276px");

    await act(async () => root.unmount());
    expect(mocks.sigmaOff).toHaveBeenCalledWith("afterRender", afterRender);
    expect(mocks.sigmaOff).toHaveBeenCalledWith("resize", resize);
    expect(mocks.cameraOff).toHaveBeenCalledWith("updated", cameraUpdated);
    root = createRoot(container);
  });

  it("reserves the loading-banner region when requested", async () => {
    await act(async () => {
      root.render(
        <SelectedNodeActions
          onPlay={vi.fn(async () => undefined)}
          onQueue={vi.fn(async () => undefined)}
          track={track}
          viewportTopInset={146}
        />,
      );
    });
    await act(async () => mocks.afterRender?.());

    const actions = container.querySelector<HTMLButtonElement>(
      '[aria-label="Play Ojos Lindos"]',
    )?.parentElement;
    const title = Array.from(container.querySelectorAll("div")).find(
      (element) => element.textContent === "Ojos Lindos",
    );
    expect(Number.parseFloat(actions?.style.top ?? "0")).toBeGreaterThanOrEqual(
      146,
    );
    expect(Number.parseFloat(title?.style.top ?? "0")).toBeGreaterThanOrEqual(
      146,
    );
  });

  it("reserves the persistent top map controls without moving a centered title", async () => {
    await act(async () => {
      root.render(
        <SelectedNodeActions
          onPlay={vi.fn(async () => undefined)}
          onQueue={vi.fn(async () => undefined)}
          track={track}
          viewportTopInset={96}
        />,
      );
    });
    await act(async () => mocks.afterRender?.());

    const actions = container.querySelector<HTMLButtonElement>(
      '[aria-label="Play Ojos Lindos"]',
    )?.parentElement;
    const title = Array.from(container.querySelectorAll("div")).find(
      (element) => element.textContent === "Ojos Lindos",
    );
    expect(Number.parseFloat(actions?.style.top ?? "0")).toBeGreaterThanOrEqual(
      96,
    );
    expect(title?.style.top).toBe("126px");
  });
});
