import { describe, expect, it } from "vitest";
import { readPlayerInterface, UNIFIED_SKINS } from "../lib/player-interface";
describe("player interface choices", () => {
  it("defaults to the unified window", () => {
    expect(readPlayerInterface({ getItem: () => null })).toBe("unified");
  });
  it("offers exactly three unified skins", () => {
    expect(UNIFIED_SKINS).toEqual(["silver", "modern", "matrix"]);
  });
  it("preserves the classic window option", () => {
    expect(readPlayerInterface({ getItem: () => "classic" })).toBe("classic");
  });
});