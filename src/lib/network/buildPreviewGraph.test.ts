import { describe, expect, it } from "vitest";
import { networkFixtureTracks } from "@/lib/network/__tests__/fixtures";
import { buildPreviewGraph } from "@/lib/network/buildPreviewGraph";

describe("buildPreviewGraph", () => {
  it("normalizes the current library into one image node per valid track", () => {
    const graph = buildPreviewGraph(networkFixtureTracks);

    expect(graph.order).toBe(new Set(networkFixtureTracks.map((track) => track.id)).size);
    expect(graph.getNodeAttribute("dream-1", "type")).toBe("image");
    expect(graph.getNodeAttribute("dream-1", "image")).toContain("dream-1.jpg");
    expect(graph.getNodeAttribute("dream-1", "albumId")).toBe("album-dream");
  });

  it("creates deterministic finite positions", () => {
    const first = buildPreviewGraph(networkFixtureTracks);
    const second = buildPreviewGraph([...networkFixtureTracks].reverse());

    first.forEachNode((node, attributes) => {
      expect(Number.isFinite(attributes.x)).toBe(true);
      expect(Number.isFinite(attributes.y)).toBe(true);
      expect(second.getNodeAttribute(node, "x")).toBe(attributes.x);
      expect(second.getNodeAttribute(node, "y")).toBe(attributes.y);
    });
  });
});
