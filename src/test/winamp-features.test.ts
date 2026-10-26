import { describe, expect, it } from "vitest";
import { indexAfterEnd, moveSelected, nextRepeat, parseTime, playlistEntries, removeDuplicates, sortTracks, toM3U } from "@/lib/winamp-features";

const t = (id: number, title: string, name = `${title}.mp3`, size = 1) => ({ id, title, duration: 61, file: { name, size } });

describe("winamp features", () => {
  it("repeat cycles off, all, track", () => {
    expect(nextRepeat("off")).toBe("all"); expect(nextRepeat("all")).toBe("track"); expect(nextRepeat("track")).toBe("off");
  });
  it("repeat track replays the same track", () => expect(indexAfterEnd(2, 5, { shuffle: false, repeat: "track", stopAfter: false })).toBe(2));
  it("stop after current stops even with repeat", () => expect(indexAfterEnd(1, 5, { shuffle: false, repeat: "all", stopAfter: true })).toBe(-1));
  it("repeat all wraps, off stops at the end", () => {
    expect(indexAfterEnd(4, 5, { shuffle: false, repeat: "all", stopAfter: false })).toBe(0);
    expect(indexAfterEnd(4, 5, { shuffle: false, repeat: "off", stopAfter: false })).toBe(-1);
  });
  it("parses jump-to-time input", () => {
    expect(parseTime("1:23")).toBe(83); expect(parseTime("1:02:03")).toBe(3723); expect(parseTime("90")).toBe(90);
    expect(parseTime("1:75")).toBeNull(); expect(parseTime("abc")).toBeNull();
  });
  it("sorts naturally by title", () => expect(sortTracks([t(1, "Track 10"), t(2, "track 2")], "title").map(x => x.id)).toEqual([2, 1]));
  it("removes duplicate files", () => expect(removeDuplicates([t(1, "a"), t(2, "a"), t(3, "b")]).map(x => x.id)).toEqual([1, 3]));
  it("moves selection and stops at edges", () => {
    const l = [t(1, "a"), t(2, "b"), t(3, "c")];
    expect(moveSelected(l, new Set([2, 3]), -1).map(x => x.id)).toEqual([2, 3, 1]);
    expect(moveSelected(l, new Set([1]), -1).map(x => x.id)).toEqual([1, 2, 3]);
  });
  it("reads M3U and PLS entries, ignoring streams", () => {
    expect(playlistEntries("#EXTM3U\n#EXTINF:1,x\nC:\\Music\\a.mp3\nhttp://radio/x\n")).toEqual(["a.mp3"]);
    expect(playlistEntries("[playlist]\nFile1=/home/b.flac\nTitle1=B\nNumberOfEntries=1")).toEqual(["b.flac"]);
    expect(playlistEntries(toM3U([t(1, "c")]))).toEqual(["c.mp3"]);
  });
});
