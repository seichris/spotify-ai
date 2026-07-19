import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SongInspector from "@/components/network/SongInspector";
import { buildPreviewGraph } from "@/lib/network/buildPreviewGraph";
import { makeTrack } from "@/lib/network/__tests__/fixtures";

describe("SongInspector", () => {
  it("does not render a separate discovery button for a selected liked song", () => {
    const track = makeTrack(
      "liked-track",
      "Liked Track",
      "artist",
      "Artist",
      ["dream pop"],
    );
    const graph = buildPreviewGraph([track]);
    const html = renderToStaticMarkup(
      <SongInspector
        activeTrack={track}
        graph={graph}
        isSelected
        onClear={vi.fn()}
        onPlaySong={vi.fn()}
        tracksById={new Map([[track.id, track]])}
      />,
    );

    expect(html).toContain("Play song");
    expect(html).not.toContain("Discover 10 new songs");
  });
});
