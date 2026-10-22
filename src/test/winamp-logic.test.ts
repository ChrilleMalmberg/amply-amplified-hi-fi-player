import { describe, it, expect } from "vitest";
import { snap, nextIndex, prevIndex } from "@/lib/winamp-logic";

describe("snap", () => {
  it("snaps to screen left edge within 10px", () => {
    expect(snap({ x: 7, y: 200, w: 100, h: 50 }, [], 1000, 800)).toEqual({ x: 0, y: 200 });
  });
  it("docks below another window", () => {
    const r = snap({ x: 103, y: 156, w: 100, h: 50 }, [{ x: 100, y: 100, w: 100, h: 50 }], 1000, 800);
    expect(r).toEqual({ x: 100, y: 150 });
  });
  it("does not snap beyond 10px", () => {
    expect(snap({ x: 30, y: 300, w: 100, h: 50 }, [], 1000, 800)).toEqual({ x: 30, y: 300 });
  });
});

describe("track order", () => {
  const off = { shuffle: false, repeat: false };
  it("stops after last track without repeat", () => expect(nextIndex(2, 3, off)).toBe(-1));
  it("wraps to first track with repeat", () => expect(nextIndex(2, 3, { shuffle: false, repeat: true })).toBe(0));
  it("shuffle never repeats the current track", () => {
    for (const r of [0, 0.3, 0.6, 0.99]) expect(nextIndex(1, 3, { shuffle: true, repeat: false }, () => r)).not.toBe(1);
  });
  it("prev wraps to last with repeat", () => expect(prevIndex(0, 4, { shuffle: false, repeat: true })).toBe(3));
});
