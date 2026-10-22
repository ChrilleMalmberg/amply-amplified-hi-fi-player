export type AudioPluginId = "equalizer" | "balance" | "enhancements" | "vst" | "au" | "lv2" | "deadbeef";
export type AudioCapabilities = { equalizer: boolean; balance: boolean };
export type AudioPlugin = { id: AudioPluginId; name: string; format: string; supported: boolean; reason?: string };

export function audioPluginCatalog(capabilities: AudioCapabilities): AudioPlugin[] {
  return [
    { id: "equalizer", name: "AmPly 10-band equalizer", format: "Built-in · Web Audio", supported: capabilities.equalizer, reason: "Web Audio filters are unavailable in this runtime." },
    { id: "balance", name: "AmPly stereo balance", format: "Built-in · Web Audio", supported: capabilities.balance, reason: "Stereo panning is unavailable in this runtime." },
    { id: "enhancements", name: "Audio enhancements", format: "Available later", supported: false, reason: "Audio enhancement plug-ins will be available later. No enhancement plug-ins are installed." },
    { id: "vst", name: "VST / VST3", format: "Native audio plug-ins", supported: false, reason: "This app has no native VST host, including in its Windows edition." },
    { id: "au", name: "Audio Units (AU)", format: "Native macOS plug-ins", supported: false, reason: "Requires macOS and an Audio Units host; neither is available here." },
    { id: "lv2", name: "LV2", format: "Native audio plug-ins", supported: false, reason: "This app has no native LV2 host." },
    { id: "deadbeef", name: "DeaDBeeF extensions", format: "Player-specific native plug-ins", supported: false, reason: "Requires the DeaDBeeF player; its extensions cannot load in AmPly." },
  ];
}

export type EqualizerSettings = { on: boolean; preamp: number; bands: number[] };
export function applyEqualizer(pre: { gain: { value: number } }, bands: { gain: { value: number } }[], eq: EqualizerSettings) {
  pre.gain.value = eq.on ? Math.pow(10, eq.preamp / 20) : 1;
  bands.forEach((band, i) => { band.gain.value = eq.on ? (eq.bands[i] ?? 0) : 0; });
}

export function effectiveBalance(enabled: boolean, balance: number) {
  return enabled ? Math.max(-1, Math.min(1, balance)) : 0;
}

export function normalizeEqGain(value: number) {
  return Number.isFinite(value) ? Math.max(-12, Math.min(12, value)) : 0;
}

/** Conservative preamp starting point; overlapping filters and source peaks can still exceed headroom. */
export function suggestedPreamp(bands: number[]) {
  return -Math.max(0, ...bands.map(normalizeEqGain));
}