import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SongInspector from "@/components/network/SongInspector";
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
    track.album.images = [{ url: "https://i.scdn.co/image/test-cover" }];
    const html = renderToStaticMarkup(
      <SongInspector
        activeTrack={track}
        isSelected
        onClear={vi.fn()}
        onPlaySong={vi.fn()}
      />,
    );

    expect(html).toContain("Play song");
    expect(html).toContain(`alt="${track.album.name} cover"`);
    expect(html).not.toContain("Strongest nearby songs");
    expect(html).not.toContain("Discover 10 new songs");
  });
});
