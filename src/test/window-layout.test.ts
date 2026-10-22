import { describe, it, expect } from "vitest";
import { connectedWindows, resizeWindows, touching, type WindowRect } from "@/lib/window-layout";

const three: WindowRect[] = [
  { id: "main", x: 8, y: 8, w: 550, h: 220, minW: 320, minH: 180 },
  { id: "pl", x: 8, y: 228, w: 550, h: 300, minW: 320, minH: 140 },
  { id: "eq", x: 8, y: 528, w: 550, h: 260, minW: 320, minH: 200 },
];
describe("customizable window groups", () => {
  it("finds all three snapped windows, but excludes overlapping or separate windows", () => {
    expect(connectedWindows("eq", [...three, { id: "other", x: 900, y: 8, w: 400, h: 300 }]).map(w => w.id)).toEqual(["eq", "pl", "main"]);
    expect(touching(three[0] ?? three[1] as WindowRect, { x: 20, y: 20, w: 300, h: 180 })).toBe(false);
  });
  it("resizes three windows as one diagonally without breaking snapped edges", () => {
    const result = resizeWindows(three, 110, 156);
    expect(result.map(w => w.w)).toEqual([660, 660, 660]);
    expect(result.map(w => w.h)).toEqual([264, 360, 312]);
    expect(result.map(w => w.y)).toEqual([8, 272, 632]);
  });
  it("detaches a window so group resize no longer includes it", () => {
    expect(connectedWindows("eq", three, ["eq"]).map(w => w.id)).toEqual(["eq"]);
    expect(connectedWindows("main", three, ["eq"]).map(w => w.id)).toEqual(["main", "pl"]);
  });
  it("keeps minimum sizes on group shrink", () => {
    const result = resizeWindows(three, -1000, -1000);
    for (const w of result) {
      expect(w.w).toBeGreaterThanOrEqual(w.minW ?? 320);
      expect(w.h).toBeGreaterThanOrEqual(w.minH ?? 140);
    }
  });
});