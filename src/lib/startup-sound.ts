/** Original six-second AmPly power-on chord, isolated from the music graph. */
export const STARTUP_DURATION_MS = 6200;

export function playStartupSound(): { stop: () => void; ready: Promise<void> } | null {
  if (typeof window === "undefined" || !window.AudioContext) return null;
  const context = new AudioContext({ latencyHint: "playback" });
  const master = context.createGain();
  master.gain.value = 0.22;
  const compressor = context.createDynamicsCompressor();
  master.connect(compressor);
  compressor.connect(context.destination);
  const now = context.currentTime;
  // A distinct ascending suspended chord, never a sample of a branded sound.
  const voices = [110, 164.81, 220, 293.66, 440, 587.33];
  const oscillators = voices.map((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency * (0.48 + index * 0.045), now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency, now + 3.8);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.095, now + 2.8);
    gain.gain.setValueAtTime(0.095, now + 4.3);
    gain.gain.linearRampToValueAtTime(0, now + 5.9);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + 6);
    return oscillator;
  });
  let stopped = false;
  return {
    ready: context.resume(),
    stop: () => {
      if (stopped) return;
      stopped = true;
      for (const oscillator of oscillators) {
        try { oscillator.stop(); } catch { /* Already ended. */ }
      }
      void context.close().catch(() => {});
    },
  };
}