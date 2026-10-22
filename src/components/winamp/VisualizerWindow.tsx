import { useEffect, useRef, useState } from "react";
import { usePlayer } from "./player-context";

const PRESETS = [
  { name: "Tunnel of Llamas", zoom: 1.04, rot: 0.01, shape: "ring" },
  { name: "Waveform Trails", zoom: 1.01, rot: 0, shape: "wave" },
  { name: "Spiral Feedback", zoom: 0.97, rot: -0.03, shape: "ring" },
  { name: "Bass Starburst", zoom: 1.06, rot: 0.02, shape: "burst" },
] as const;

export function VisualizerWindow() {
  const p = usePlayer();
  const ref = useRef<HTMLCanvasElement>(null);
  const [preset, setPreset] = useState(0);

  useEffect(() => {
    const c = ref.current!;
    const g = c.getContext("2d")!;
    const tmp = document.createElement("canvas");
    tmp.width = c.width;
    tmp.height = c.height;
    const tg = tmp.getContext("2d")!;
    let raf = 0;
    let hue = 0;
    const pr = PRESETS[preset];
    g.fillStyle = "#000";
    g.fillRect(0, 0, c.width, c.height);
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const W = c.width, H = c.height;
      const an = p.analyserRef.current;
      const wave = new Uint8Array(1024);
      const freq = new Uint8Array(256);
      if (an) {
        an.getByteTimeDomainData(wave);
        an.getByteFrequencyData(freq);
      } else wave.fill(128);
      let bass = 0;
      for (let i = 0; i < 12; i++) bass += freq[i];
      bass /= 12 * 255;
      // feedback
      tg.clearRect(0, 0, W, H);
      tg.drawImage(c, 0, 0);
      g.save();
      g.fillStyle = "rgba(0,0,0,0.08)";
      g.fillRect(0, 0, W, H);
      g.translate(W / 2, H / 2);
      g.rotate(pr.rot + bass * 0.02);
      const z = pr.zoom + bass * 0.03;
      g.scale(z, z);
      g.globalAlpha = 0.92;
      g.drawImage(tmp, -W / 2, -H / 2);
      g.restore();
      hue = (hue + 0.6 + bass * 4) % 360;
      g.strokeStyle = `hsl(${hue},100%,60%)`;
      g.lineWidth = 2 + bass * 4;
      g.beginPath();
      if (pr.shape === "wave") {
        for (let i = 0; i < wave.length; i++) {
          const x = (i / wave.length) * W;
          const y = H / 2 + ((wave[i] - 128) / 128) * H * 0.4;
          if (i) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
      } else if (pr.shape === "ring") {
        const r0 = Math.min(W, H) * (0.15 + bass * 0.15);
        for (let i = 0; i <= 256; i++) {
          const a = (i / 256) * Math.PI * 2;
          const r = r0 + ((wave[(i * 4) % 1024] - 128) / 128) * r0;
          const x = W / 2 + Math.cos(a) * r, y = H / 2 + Math.sin(a) * r;
          if (i) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
      } else {
        for (let i = 0; i < 64; i++) {
          const a = (i / 64) * Math.PI * 2 + hue / 50;
          const r = (freq[i * 2] / 255) * Math.min(W, H) * 0.45;
          g.moveTo(W / 2, H / 2);
          g.lineTo(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r);
        }
      }
      g.stroke();
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [p.analyserRef, preset]);

  return (
    <div className="wa-vis">
      <canvas ref={ref} width={520} height={300} className="wa-vis-canvas" onDoubleClick={() => ref.current?.requestFullscreen()} />
      <div className="wa-pl-bar">
        <span className="wa-lcd wa-small wa-grow">{PRESETS[preset].name}</span>
        <button className="wa-toggle" onClick={() => setPreset((x) => (x + 1) % PRESETS.length)}>NEXT</button>
        <button className="wa-toggle" onClick={() => ref.current?.requestFullscreen()}>FULLSCREEN</button>
      </div>
    </div>
  );
}
