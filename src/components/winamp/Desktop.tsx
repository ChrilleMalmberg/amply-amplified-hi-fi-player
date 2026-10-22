import { useEffect, useState } from "react";
import { PlayerProvider, usePlayer } from "./player-context";
import { WaWindow } from "./WaWindow";
import { MainWindow } from "./MainWindow";
import { PlaylistWindow } from "./PlaylistWindow";
import { EqualizerWindow } from "./EqualizerWindow";
import { IntroSplash } from "./IntroSplash";
import { LibraryWindow } from "./LibraryWindow";
import { useMusicLibrary } from "./use-music-library";
import { PluginWindow } from "./PluginWindow";
import { Button } from "@/components/ui/button";
import { Library, Minimize2, Maximize2, Columns2, Plug } from "lucide-react";

const SKINS = ["silver", "classic", "nucleo", "ruby", "matrix"] as const;
type Pos = { x: number; y: number };
const DEFAULT = { main: { x: 8, y: 8 }, pl: { x: 8, y: 236 }, vis: { x: 600, y: 8 }, eq: { x: 8, y: 560 }, plugins: { x: 32, y: 80 } };

function Shell() {
  const p = usePlayer();
  const [intro, setIntro] = useState(true);
  const [skin, setSkin] = useState<string>("silver");
  const [pos, setPos] = useState<Record<string, Pos>>(DEFAULT);
  const [show, setShow] = useState({ pl: true, vis: true, eq: true });
  const [menu, setMenu] = useState<Pos | null>(null);
  const [showPlugins, setShowPlugins] = useState(false);
  const library = useMusicLibrary();
  const [mode, setMode] = useState<"small" | "large">("large");
  const [browsers, setBrowsers] = useState([{ id: "library", source: "" }]);
  const addBrowser = (source: string) => {
    const id = `source-${Date.now()}`;
    const n = browsers.length;
    setPos(s => ({ ...s, [id]: { x: 580 + n * 28, y: 32 + n * 28 } }));
    setBrowsers(s => [...s, { id, source }]);
    setMode("large");
  };

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("wa-state") || "null");
      if (s?.pos && s.v === 4) setPos(s.pos);
      if (s?.skin && s.v >= 3) setSkin(s.skin);
      if (s?.show) setShow(s.show);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("wa-state", JSON.stringify({ v: 4, pos, skin, show }));
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
    <div className="wa-desktop" data-skin={skin} data-mode={mode} onClick={() => setMenu(null)}>
      {intro && <IntroSplash onDone={() => { p.ensureGraph(); setIntro(false); }} />}
      <WaWindow id="main" title="AMPLY · HIFI PLAYER" pos={mode === "small" ? DEFAULT.main : pos["main"] ?? DEFAULT.main} onMove={mv("main")} width={550}
        controls={<>
          <Button variant="retro" size="retro" className="wa-tbtn" aria-label="Open plug-in settings" title="Audio plug-ins" onClick={() => { setMode("large"); setShowPlugins(true); }}><Plug /></Button>
          <Button variant="retro" size="retro" className="wa-tbtn" aria-label="Open music library" title="Music library" onClick={() => { setMode("large"); if (!browsers.length) setBrowsers([{ id: "library", source: "" }]); }}><Library /></Button>
          <Button variant="retro" size="retro" className="wa-tbtn" aria-label="Compact player" title="Compact player" onClick={() => setMode("small")}><Minimize2 /></Button>
          <Button variant="retro" size="retro" className="wa-tbtn" aria-label="Full player" title="Full player" onClick={() => setMode("large")}><Maximize2 /></Button>
          <Button variant="retro" size="retro" className="wa-tbtn" aria-label="Arrange windows" title="Arrange windows" onClick={() => setPos(DEFAULT)}><Columns2 /></Button>
        </>}
        onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}>
        <MainWindow onTogglePL={() => setShow((s) => ({ ...s, pl: !s.pl }))} onToggleEQ={() => setShow((s) => ({ ...s, eq: !s.eq }))} />
      </WaWindow>
      {mode === "large" && showPlugins && <WaWindow id="plugins" title="AUDIO PLUG-INS" width={680} pos={pos["plugins"] ?? DEFAULT.plugins} onMove={mv("plugins")} onClose={() => setShowPlugins(false)}><PluginWindow /></WaWindow>}
      {mode === "large" && show.pl && (
        <WaWindow id="pl" title="PLAYLIST" pos={pos["pl"] ?? DEFAULT.pl} onMove={mv("pl")} width={550} onClose={() => setShow((s) => ({ ...s, pl: false }))}>
          <PlaylistWindow />
        </WaWindow>
      )}
      {mode === "large" && show.eq && (
        <WaWindow id="eq" title="EQUALIZER" pos={pos["eq"] ?? DEFAULT.eq} onMove={mv("eq")} width={550} onClose={() => setShow((s) => ({ ...s, eq: false }))}>
          <EqualizerWindow />
        </WaWindow>
      )}
      {mode === "large" && browsers.map((browser, i) => <WaWindow key={browser.id} id={browser.id} title={browser.source ? `SOURCE · ${browser.source}` : "MUSIC LIBRARY"} width={680}
        pos={pos[browser.id] ?? { x: 580 + i * 28, y: 8 + i * 28 }} onMove={mv(browser.id)} onClose={() => setBrowsers(s => s.filter(b => b.id !== browser.id))}>
        <LibraryWindow library={library} initialSource={browser.source} onNewWindow={addBrowser} />
      </WaWindow>)}
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
