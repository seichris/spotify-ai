// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NeighborhoodHighlight from "@/components/network/NeighborhoodHighlight";

interface NodeData {
  forceLabel?: boolean;
  highlighted?: boolean;
  label: string;
  size: number;
  zIndex?: number;
}

type NodeReducer = (node: string, data: NodeData) => NodeData;

const mocks = vi.hoisted(() => ({
  container: null as HTMLDivElement | null,
  settings: null as { nodeReducer?: NodeReducer } | null,
}));

vi.mock("@react-sigma/core", () => ({
  useSigma: () => ({
    getContainer: () => mocks.container,
    getGraph: () => ({
      extremities: () => ["hovered", "neighbor"],
      hasNode: (node: string) => ["hovered", "selected", "neighbor"].includes(node),
      neighbors: () => ["neighbor"],
    }),
    setSettings: (settings: { nodeReducer?: NodeReducer }) => {
      mocks.settings = settings;
    },
  }),
}));

describe("NeighborhoodHighlight", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    mocks.settings = null;
    mocks.container = document.createElement("div");
    Object.defineProperties(mocks.container, {
      clientHeight: { value: 500 },
      clientWidth: { value: 600 },
    });
    document.body.append(mocks.container);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    mocks.container?.remove();
    vi.unstubAllGlobals();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("keeps the selected border while hiding its canvas label", async () => {
    await act(async () => {
      root.render(
        <NeighborhoodHighlight
          focusNodeId="hovered"
          selectedNodeId="selected"
        />,
      );
    });

    const reducer = mocks.settings?.nodeReducer;
    expect(reducer).toBeTypeOf("function");
    const selected = reducer?.("selected", {
      label: "Selected song",
      size: 10,
    });
    const hovered = reducer?.("hovered", {
      label: "Hovered song",
      size: 10,
    });

    expect(selected).toMatchObject({
      forceLabel: false,
      highlighted: true,
      label: "",
      size: 14.5,
    });
    expect(hovered).toMatchObject({
      forceLabel: true,
      highlighted: true,
      label: "Hovered song",
      size: 14.5,
    });
  });
});
