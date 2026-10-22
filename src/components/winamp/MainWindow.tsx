import { AmplyLogo } from "./AmplyLogo";
import { useEffect, useRef, useState } from "react";
import { usePlayer, AUDIO_ACCEPT } from "./player-context";
import { fmtTime } from "@/lib/winamp-logic";

function cssVar(el: Element, n: string) {
  return getComputedStyle(el).getPropertyValue(n).trim();
}

function Spectrum() {
  const p = usePlayer();
  const ref = useRef<HTMLCanvasElement>(null);
  const [scope, setScope] = useState(false);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext("2d");
    if (!g) return;
    const peaks = new Array(19).fill(0);
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const an = p.analyserRef.current;
      const lo = cssVar(c, "--wa-lcd-text");
      const hi = cssVar(c, "--wa-spec-hi");
      g.clearRect(0, 0, c.width, c.height);
      if (!an) return;
      if (scope) {
        const d = new Uint8Array(an.fftSize);
        an.getByteTimeDomainData(d);
        g.strokeStyle = lo;
        g.lineWidth = 2;
        g.beginPath();
        for (let x = 0; x < c.width; x++) {
          const v = (d[Math.floor((x / c.width) * d.length)] ?? 0) / 255;
          const y = v * c.height;
          if (x) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        g.stroke();
        return;
      }
      const d = new Uint8Array(an.frequencyBinCount);
      an.getByteFrequencyData(d);
      const bw = c.width / 19;
      const grad = g.createLinearGradient(0, c.height, 0, 0);
      grad.addColorStop(0, lo);
      grad.addColorStop(1, hi);
      for (let i = 0; i < 19; i++) {
        const a = Math.floor(Math.pow(i / 19, 2) * 300) + 1;
        const b = Math.floor(Math.pow((i + 1) / 19, 2) * 300) + 2;
        let m = 0;
        for (let k = a; k < b; k++) m = Math.max(m, d[k] ?? 0);
        const h = Math.round(((m / 255) * c.height) / 2) * 2;
        peaks[i] = Math.max(peaks[i] - 0.6, h);
        g.fillStyle = grad;
        g.fillRect(i * bw, c.height - h, bw - 2, h);
        g.fillStyle = hi;
        g.fillRect(i * bw, c.height - peaks[i] - 2, bw - 2, 2);
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [p.analyserRef, scope]);
  return <canvas ref={ref} width={152} height={32} className="wa-spectrum" onClick={() => setScope((s) => !s)} title="Click: spectrum / oscilloscope" />;
}

export function MainWindow({ onTogglePL, onToggleEQ }: { onTogglePL: () => void; onToggleEQ: () => void }) {
  const p = usePlayer();
  const fileRef = useRef<HTMLInputElement>(null);
  const t = p.tracks[p.current];
  const kbps = t && t.duration ? Math.round((t.file.size * 8) / t.duration / 1000) : 0;
  const title = t ? `${p.current + 1}. ${t.title} (${fmtTime(t.duration)})  ***  ` : "AMPLY HIFI PLAYER V-3.0  ***  BIT-PERFECT LOSSLESS PLAYBACK  ***  ";
  const [remaining, setRemaining] = useState(false);
  const shown = remaining ? p.duration - p.time : p.time;

  return (
    <div className="wa-main">
      <input ref={fileRef} type="file" multiple accept={AUDIO_ACCEPT} hidden onChange={(e) => e.target.files && p.addFiles(e.target.files)} />
      <div className="wa-row">
        <div className="wa-lcd wa-display">
          <div className="wa-status">{p.playing ? (p.paused ? "❚❚" : "▶") : "■"}</div>
          <button className={`wa-time ${p.paused ? "wa-blink" : ""}`} onClick={() => setRemaining((r) => !r)}>
            {remaining ? "-" : " "}
            {fmtTime(shown)}
          </button>
          <Spectrum />
        </div>
        <div className="wa-info">
          <div className="wa-lcd wa-marquee">
            <span className="wa-marquee-inner">
              {title}
              {title}
            </span>
          </div>
          <div className="wa-meta">
            <span className="wa-lcd wa-small">{kbps || "--"}</span>
            <span className="wa-label">kbps</span>
            <span className="wa-lcd wa-small">{Math.round(p.sampleRate / 1000)}</span>
            <span className="wa-label">kHz</span>
            <span className={`wa-label ${t ? "wa-on" : ""}`}>stereo</span>
          </div>
          <div className="wa-sliders">
            <div className="wa-slwrap">
              <input aria-label="Volume" className="wa-range" type="range" min={0} max={1} step={0.01} value={p.volume} onChange={(e) => p.setVolume(+e.target.value)} />
              <span className="wa-slval">VOL {p.volume <= 0.001 ? "-∞" : (20 * Math.log10(p.volume)).toFixed(1)} dB</span>
            </div>
            <div className="wa-slwrap wa-balance">
              <input aria-label="Balance" className="wa-range" type="range" min={-1} max={1} step={0.02} value={p.balance} onChange={(e) => p.setBalance(+e.target.value)} onDoubleClick={() => p.setBalance(0)} />
              <span className="wa-slval">BAL {Math.round(p.balance * 100) === 0 ? "0" : `${p.balance > 0 ? "+" : ""}${Math.round(p.balance * 100)}`}</span>
            </div>
            <button className={`wa-toggle ${p.eq.on ? "wa-on" : ""}`} onClick={onToggleEQ}>EQ</button>
            <button className="wa-toggle" onClick={onTogglePL}>PL</button>
          </div>
        </div>
      </div>
      <input aria-label="Seek" className="wa-range wa-seek" type="range" min={0} max={p.duration || 1} step={0.1} value={Math.min(p.time, p.duration || 0)} onChange={(e) => p.seek(+e.target.value)} disabled={!t} />
      <div className="wa-controls">
        <button className="wa-btn" aria-label="Previous" onClick={p.prev}>⏮</button>
        <button className="wa-btn" aria-label="Play" onClick={p.play}>▶</button>
        <button className="wa-btn" aria-label="Pause" onClick={p.pause}>❚❚</button>
        <button className="wa-btn" aria-label="Stop" onClick={p.stop}>■</button>
        <button className="wa-btn" aria-label="Next" onClick={p.next}>⏭</button>
        <button className="wa-btn wa-eject" aria-label="Open files" onClick={() => fileRef.current?.click()}>⏏</button>
        <span className="wa-spacer" />
        <button className={`wa-toggle ${p.shuffle ? "wa-on" : ""}`} onClick={p.toggleShuffle}>SHUFFLE</button>
        <button className={`wa-toggle ${p.repeat ? "wa-on" : ""}`} onClick={p.toggleRepeat}>↻</button>
        <AmplyLogo size={14} />
      </div>
    </div>
  );
}
