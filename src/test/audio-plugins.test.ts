import { describe, it, expect } from "vitest";
import { audioPluginCatalog, applyEqualizer, effectiveBalance } from "@/lib/audio-plugins";

describe("platform plug-in support", () => {
  it("supports only the implemented Web Audio processors", () => {
    expect(audioPluginCatalog({ equalizer: true, balance: true }).filter(p => p.supported).map(p => p.id)).toEqual(["equalizer", "balance"]);
  });
  it("disables processors when the runtime cannot supply them", () => {
    expect(audioPluginCatalog({ equalizer: false, balance: false }).some(p => p.supported)).toBe(false);
  });
});

describe("live processor bypass", () => {
  it("enables EQ gain and flattens every band when disabled", () => {
    const pre = { gain: { value: 1 } };
    const bands = Array.from({ length: 10 }, () => ({ gain: { value: 0 } }));
    const eq = { on: true, preamp: 6, bands: [3, -2, 1, 0, 4, -1, 2, 0, -3, 5] };
    applyEqualizer(pre, bands, eq);
    expect(pre.gain.value).toBeCloseTo(1.995262);
    expect(bands.map(b => b.gain.value)).toEqual(eq.bands);
    applyEqualizer(pre, bands, { ...eq, on: false });
    expect(pre.gain.value).toBe(1);
    expect(bands.map(b => b.gain.value)).toEqual(Array(10).fill(0));
  });
  it("centers disabled balance without losing the configured value", () => {
    expect(effectiveBalance(true, -0.7)).toBe(-0.7);
    expect(effectiveBalance(false, -0.7)).toBe(0);
    expect(effectiveBalance(true, -0.7)).toBe(-0.7);
  });
});