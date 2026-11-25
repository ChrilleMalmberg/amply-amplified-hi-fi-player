import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ListMusic, Library, SlidersHorizontal, Plug } from "lucide-react";
import { MainWindow } from "./MainWindow";
import { PlaylistWindow } from "./PlaylistWindow";
import { EqualizerWindow } from "./EqualizerWindow";
import { LibraryWindow } from "./LibraryWindow";
import { PluginWindow } from "./PluginWindow";
import { MenuBar } from "./MenuBar";
import { WinampCommands } from "./WinampCommands";
import { useMusicLibrary } from "./use-music-library";
import { usePlayer } from "./player-context";
import { UNIFIED_SKINS, type PlayerInterface } from "@/lib/player-interface";
import { fmtTime } from "@/lib/winamp-logic";

export function UnifiedPlayer({ skin, onSkin, onInterface, onReset, onExit }: {
  skin: string; onSkin: (skin: string) => void; onInterface: (value: PlayerInterface) => void; onReset: () => void; onExit: () => void;
}) {
  const [view, setView] = useState("playlist");
  const library = useMusicLibrary();
  const p = usePlayer();
  const total = p.tracks.reduce((sum, track) => sum + track.duration, 0);
  return <div className="wa-unified-content">
    <WinampCommands onTogglePL={() => setView("playlist")} onToggleEQ={() => setView(v => v === "eq" ? "playlist" : "eq")} onOpenLibrary={() => setView("library")} />
    <MenuBar skin={skin} onSkin={onSkin} skins={UNIFIED_SKINS} onInterface={onInterface} interfaceMode="unified"
      onOpenLibrary={() => setView("library")} onOpenPlugins={() => setView("plugins")}
      onCompact={() => setView("playlist")} onFull={() => setView("library")} onArrange={onReset} onExit={onExit}
      onTogglePL={() => setView("playlist")} onToggleEQ={() => setView("eq")} />
    <div className="wa-unified-toolbar" role="tablist" aria-label="Player views">
      {([{ id: "playlist", label: "Playlist", icon: ListMusic }, { id: "library", label: "Music library", icon: Library }, { id: "eq", label: "Equalizer", icon: SlidersHorizontal }, { id: "plugins", label: "Audio settings", icon: Plug }]).map(({ id, label, icon: Icon }) =>
        <Button key={id} variant="retro" size="retro" role="tab" aria-selected={view === id} className={`wa-toggle ${view === id ? "wa-on" : ""}`} onClick={() => setView(id)}><Icon />{label}</Button>)}
    </div>
    <div className="wa-unified-body" role="tabpanel">
      {view === "playlist" ? <PlaylistWindow /> : view === "library" ? <LibraryWindow library={library} onNewWindow={() => setView("library")} /> : view === "eq" ? <EqualizerWindow onAdvanced={() => setView("plugins")} /> : <PluginWindow />}
    </div>
    <MainWindow onTogglePL={() => setView("playlist")} onToggleEQ={() => setView(v => v === "eq" ? "playlist" : "eq")} />
    <div className="wa-unified-status"><span>{p.tracks.length} tracks · {fmtTime(total)}</span><span>{p.playing ? p.paused ? "Paused" : "Playing" : "Stopped"} · {Math.round(p.sampleRate / 1000)} kHz</span></div>
  </div>;
}