import { useEffect, useState } from "react";
import { PlayerProvider, usePlayer } from "./player-context";
import { WaWindow } from "./WaWindow";
import { MainWindow } from "./MainWindow";
import { PlaylistWindow } from "./PlaylistWindow";
import { VisualizerWindow } from "./VisualizerWindow";
import { IntroSplash } from "./IntroSplash";

const SKINS = ["classic", "nucleo", "ruby", "matrix"] as const;
type Pos = { x: number; y: number };
const DEFAULT = { main: { x: 40, y: 40 }, pl: { x: 40, y: 276 }, vis: { x: 600, y: 40 } };

function Shell() {
  const p = usePlayer();
  const [intro, setIntro] = useState(true);
  const [skin, setSkin] = useState<string>("classic");
  const [pos, setPos] = useState<Record<string, Pos>>(DEFAULT);
  const [show, setShow] = useState({ pl: true, vis: true });
  const [menu, setMenu] = useState<Pos | null>(null);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("wa-state") || "null");
      if (s?.pos) setPos(s.pos);
      if (s?.skin) setSkin(s.skin);
      if (s?.show) setShow(s.show);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("wa-state", JSON.stringify({ pos, skin, show }));
  }, [pos, skin, show]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" && (e.target as HTMLInputElement).type !== "range") return;
      const m: Record<string, () => void> = {
        z: p.prev, x: p.play, c: p.pause, v: p.stop, b: p.next,
        ArrowLeft: () => p.seek(p.time - 5), ArrowRight: () => p.seek(p.time + 5),
        ArrowUp: () => p.setVolume(p.volume + 0.05), ArrowDown: () => p.setVolume(p.volume - 0.05),
      };
      const f = m[e.key];
      if (f) {
        e.preventDefault();
        f();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [p]);

  const mv = (id: string) => (np: Pos) => setPos((s) => ({ ...s, [id]: np }));

  return (
    <div className="wa-desktop" data-skin={skin} onClick={() => setMenu(null)}>
      {intro && <IntroSplash onDone={() => { p.ensureGraph(); setIntro(false); }} />}
      <WaWindow id="main" title="WINAMP" pos={pos.main} onMove={mv("main")} width={550}
        onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}>
        <MainWindow onTogglePL={() => setShow((s) => ({ ...s, pl: !s.pl }))} onToggleVis={() => setShow((s) => ({ ...s, vis: !s.vis }))} />
      </WaWindow>
      {show.pl && (
        <WaWindow id="pl" title="WINAMP PLAYLIST" pos={pos.pl} onMove={mv("pl")} width={550} onClose={() => setShow((s) => ({ ...s, pl: false }))}>
          <PlaylistWindow />
        </WaWindow>
      )}
      {show.vis && (
        <WaWindow id="vis" title="MILKDROP" pos={pos.vis} onMove={mv("vis")} width={540} onClose={() => setShow((s) => ({ ...s, vis: false }))}>
          <VisualizerWindow />
        </WaWindow>
      )}
      {menu && (
        <div className="wa-menu" style={{ left: menu.x, top: menu.y }}>
          <div className="wa-menu-head">Skins</div>
          {SKINS.map((s) => (
            <button key={s} className={`wa-menu-item ${skin === s ? "wa-on" : ""}`} onClick={() => setSkin(s)}>
              {skin === s ? "✓ " : "  "}
              {s}
            </button>
          ))}
          <button className="wa-menu-item" onClick={() => setPos(DEFAULT)}>  reset windows</button>
        </div>
      )}
      <div className="wa-hint">Right-click the player for skins · Z X C V B keys · double-click visuals for fullscreen</div>
    </div>
  );
}

export function Desktop() {
  return (
    <PlayerProvider>
      <Shell />
    </PlayerProvider>
  );
}
