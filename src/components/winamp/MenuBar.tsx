import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePlayer } from "./player-context";
import { PlaylistManager } from "./PlaylistManager";
import { PLAYER_SKINS } from "@/lib/player-skins";
import { openDialog, toggleTimeDisplay } from "./WinampCommands";

type MenuBarProps = {
  skin: string;
  onSkin: (skin: string) => void;
  onOpenLibrary: () => void;
  onOpenPlugins: () => void;
  onCompact: () => void;
  onFull: () => void;
  onArrange: () => void;
  onExit: () => void;
  onTogglePL?: () => void;
  onToggleEQ?: () => void;
  onTop?: { value: boolean; set: (v: boolean) => void };
};

export function MenuBar({ skin, onSkin, onOpenLibrary, onOpenPlugins, onCompact, onFull, onArrange, onExit, onTogglePL, onToggleEQ, onTop }: MenuBarProps) {
  const p = usePlayer();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [lists, setLists] = useState(false);
  const enteredAt = useRef(0);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(null); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", key); };
  }, [open]);

  const item = (label: ReactNode, action: () => void) => (
    <button className="wa-menu-item" role="menuitem" onClick={() => { setOpen(null); action(); }}>{label}</button>
  );
  const check = (on: boolean, label: ReactNode, action: () => void) => (
    <button className="wa-menu-item" role="menuitemcheckbox" aria-checked={on} onClick={() => { setOpen(null); action(); }}>{on ? "✓ " : "  "}{label}</button>
  );
  const menu = (id: string, label: string, items: ReactNode) => (
    <span className="wa-menubar-entry">
      <button
        className={`wa-menubar-btn ${open === id ? "wa-open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open === id}
        onClick={(e) => {
          if (open === id) {
            // A hover may have just switched to this menu; the following click must not close it.
            if (Date.now() - enteredAt.current > 400) setOpen(null);
            return;
          }
          const r = e.currentTarget.getBoundingClientRect();
          setAnchor({ x: r.left, y: r.bottom + 2 });
          setOpen(id);
        }}
        onPointerEnter={(e) => {
          if (!open || open === id) return;
          const r = e.currentTarget.getBoundingClientRect();
          enteredAt.current = Date.now();
          setAnchor({ x: r.left, y: r.bottom + 2 });
          setOpen(id);
        }}
      >
        {label}
      </button>
      {open === id && anchor && (
        <div className="wa-menu wa-menubar-menu" role="menu" aria-label={label} style={{ left: anchor.x, top: anchor.y }}>{items}</div>
      )}
    </span>
  );

  return (
    <div className="wa-menubar" ref={rootRef} onPointerDown={(e) => e.stopPropagation()}>
      {menu("file", "File", <>
        {item("Play file…  (L)", () => openDialog("open-files"))}
        {item("Add folder…  (Shift+L)", () => openDialog("open-folder"))}
        {item("Music library  (Alt+L)", onOpenLibrary)}
        <div className="wa-menu-sep" />
        {item("Jump to file…  (J)", () => openDialog("jump-file"))}
        {item("Jump to time…  (Ctrl+J)", () => openDialog("jump-time"))}
        {item("File info…  (Alt+3)", () => openDialog("file-info"))}
        <div className="wa-menu-sep" />
        {item("Exit AmPly", onExit)}
      </>)}
      {menu("play", "Play", <>
        {item("Previous  (Z)", p.prev)}
        {item("Play  (X)", p.play)}
        {item("Pause  (C)", p.pause)}
        {item("Stop  (V)", p.stop)}
        {item("Fade out and stop  (Shift+V)", p.fadeStop)}
        {check(p.stopAfter, "Stop after current  (Ctrl+V)", p.toggleStopAfter)}
        {item("Next  (B)", p.next)}
        <div className="wa-menu-sep" />
        {item("Back 5 seconds  (←)", () => p.seekBy(-5))}
        {item("Forward 5 seconds  (→)", () => p.seekBy(5))}
        {item("Volume up  (↑)", () => p.volumeBy(0.05))}
        {item("Volume down  (↓)", () => p.volumeBy(-0.05))}
        <div className="wa-menu-sep" />
        {check(p.shuffle, "Shuffle  (S)", p.toggleShuffle)}
        <div className="wa-menu-head">Repeat  (R)</div>
        {check(p.repeatMode === "off", "Repeat off", () => p.setRepeatMode("off"))}
        {check(p.repeatMode === "all", "Repeat playlist", () => p.setRepeatMode("all"))}
        {check(p.repeatMode === "track", "Repeat track", () => p.setRepeatMode("track"))}
        {check(p.ab.a !== null, p.ab.a === null ? "A-B repeat: set A  (A)" : p.ab.b === null ? "A-B repeat: set B  (A)" : "A-B repeat: clear  (A)", p.cycleAB)}
      </>)}
      {menu("playlist", "Playlist", <>
        {item("Save / load playlists…", () => setLists((v) => !v))}
        {onTogglePL && item("Show / hide playlist  (Alt+E)", onTogglePL)}
        {item("Clear playlist", () => { p.stop(); p.setTracks([]); })}
      </>)}
      {menu("view", "View", <>
        {item("Elapsed / remaining time  (Ctrl+T)", toggleTimeDisplay)}
        {onToggleEQ && item("Show / hide equalizer  (Alt+G)", onToggleEQ)}
        {item("Compact player", onCompact)}
        {item("Full player", onFull)}
        {item("Reset windows", onArrange)}
        <div className="wa-menu-head">Skins</div>
        {PLAYER_SKINS.map((s) => (
          <button key={s} className="wa-menu-item" role="menuitemradio" aria-checked={skin === s} onClick={() => onSkin(s)}>
            {skin === s ? "✓ " : "  "}{s}
          </button>
        ))}
      </>)}
      {menu("settings", "Options", <>
        {item("Audio plug-ins / Advanced EQ", onOpenPlugins)}
        {onTop && check(onTop.value, "Always on top", () => onTop.set(!onTop.value))}
      </>)}
      {menu("help", "Help", <>
        {item("Keyboard shortcuts  (F1)", () => openDialog("shortcuts"))}
        {item("About AmPly", () => openDialog("about"))}
      </>)}
      {lists && <div className="wa-menubar-lists"><PlaylistManager onClose={() => setLists(false)} /></div>}
    </div>
  );
}
