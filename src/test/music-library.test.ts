import { describe, expect, it } from "vitest";
import { filterLibrary, mergeLibrary, organizeFile } from "@/lib/music-library";

const file = new File(["audio"], "Song.wav", { lastModified: 123 });
Object.defineProperty(file, "webkitRelativePath", { value: "Music/Artist/Album/Song.wav" });
describe("Music library organization", () => {
  it("uses tags for artist categories", () => {
    expect(organizeFile(file, { artist: "Tagged Artist" }).artist).toBe("Tagged Artist");
  });
  it("falls back to folder hierarchy without tags", () => {
    expect(organizeFile(file, {})).toMatchObject({ artist: "Artist", album: "Album", source: "Music", folder: "Music/Artist/Album" });
  });
  it("deduplicates repeated folder imports", () => {
    const item = organizeFile(file, {});
    expect(mergeLibrary([item], [item])).toHaveLength(1);
  });
  it("keeps source filters separate", () => {
    const item = organizeFile(file, {});
    expect(filterLibrary([item], "", "artist", "", "Other")).toHaveLength(0);
    expect(filterLibrary([item], "", "artist", "Artist", "Music")).toHaveLength(1);
  });
  it("searches albums as well as titles", () => {
    expect(filterLibrary([organizeFile(file, {})], "album", "artist", "", "")).toHaveLength(1);
    expect(filterLibrary([organizeFile(file, {})], "absent", "artist", "", "")).toHaveLength(0);
  });
});