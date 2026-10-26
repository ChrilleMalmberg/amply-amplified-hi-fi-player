import { useEffect, useRef } from "react";
import { usePlayer, EQ_FREQS } from "./player-context";

/** Read-only visual: live band levels from the analyser side tap plus the current EQ curve. */
export function EqBeat() {
  const p = usePlayer();
  const ref = useRef<HTMLCanvasElement>(null);
  const eqRef = useRef(p.eq);
  eqRef.current = p.eq;
  useEffect(() => {
    const c = ref.current; const g = c?.getContext("2d");
    if (!c || !g) return;
    const peaks = EQ_FREQS.map(() => 0);
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const w = (c.width = c.clientWidth || 300), h = (c.height = c.clientHeight || 56);
      const cs = getComputedStyle(c);
      const lo = cs.getPropertyValue("--wa-lcd-text").trim() || "lime", hi = cs.getPropertyValue("--wa-spec-hi").trim() || "orange";
      g.clearRect(0, 0, w, h);
      const an = p.analyserRef.current;
      const n = EQ_FREQS.length, bw = w / n;
      if (an) {
        const d = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(d);
        const hz = an.context.sampleRate / 2 / d.length;
        EQ_FREQS.forEach((f, i) => {
          const a = Math.max(1, Math.floor((f * 0.7) / hz)), b = Math.max(a + 1, Math.ceil((f * 1.4) / hz));
          let m = 0; for (let k = a; k < b && k < d.length; k++) m = Math.max(m, d[k] ?? 0);
          const bh = (m / 255) * h;
          peaks[i] = Math.max((peaks[i] ?? 0) - 0.8, bh);
          const grad = g.createLinearGradient(0, h, 0, 0); grad.addColorStop(0, lo); grad.addColorStop(1, hi);
          g.fillStyle = grad; g.globalAlpha = 0.85;
          g.fillRect(i * bw + 3, h - bh, bw - 6, bh);
          g.globalAlpha = 1; g.fillStyle = hi;
          g.fillRect(i * bw + 3, h - (peaks[i] ?? 0) - 2, bw - 6, 2);
        });
      }
      const eq = eqRef.current;
      g.strokeStyle = eq.on ? hi : lo; g.globalAlpha = eq.on ? 1 : 0.4; g.lineWidth = 2; g.setLineDash(eq.on ? [] : [4, 4]);
      g.beginPath();
      eq.bands.forEach((v, i) => { const x = i * bw + bw / 2, y = h / 2 - (eq.on ? v : 0) / 12 * (h / 2 - 3); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [p.analyserRef]);
  return <canvas ref={ref} className="wa-eq-beat" aria-label="Equalizer beat display" />;
}
