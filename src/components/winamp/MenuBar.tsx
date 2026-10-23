import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePlayer, AUDIO_ACCEPT } from "./player-context";
import { PlaylistManager } from "./PlaylistManager";
import { PLAYER_SKINS } from "@/lib/player-skins";

type MenuBarProps = {
  skin: string;
  onSkin: (skin: string) => void;
  onOpenLibrary: () => void;
  onOpenPlugins: () => void;
  onCompact: () => void;
  onFull: () => void;
  onArrange: () => void;
  onExit: () => void;
};

export function MenuBar({ skin, onSkin, onOpenLibrary, onOpenPlugins, onCompact, onFull, onArrange, onExit }: MenuBarProps) {
  const p = usePlayer();
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [lists, setLists] = useState(false);

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
  const menu = (id: string, label: string, items: ReactNode) => (
    <span className="wa-menubar-entry">
      <button
        className={`wa-menubar-btn ${open === id ? "wa-open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open === id}
        onClick={(e) => {
          if (open === id) { setOpen(null); return; }
          const r = e.currentTarget.getBoundingClientRect();
          setAnchor({ x: r.left, y: r.bottom + 2 });
          setOpen(id);
        }}
        onPointerEnter={(e) => {
          if (!open || open === id) return;
          const r = e.currentTarget.getBoundingClientRect();
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
      <input ref={fileRef} type="file" multiple accept={AUDIO_ACCEPT} hidden onChange={(e) => e.target.files && p.addFiles(e.target.files)} />
      {menu("file", "File", <>
        {item("Open files…", () => fileRef.current?.click())}
        {item("Music library", onOpenLibrary)}
        {item("Exit AmPly", onExit)}
      </>)}
      {menu("playlist", "Playlist", <>
        {item("Save / load playlists…", () => setLists((v) => !v))}
        {item("Clear playlist", () => p.setTracks([]))}
      </>)}
      {menu("view", "View", <>
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
      {menu("settings", "Settings", <>
        {item("Audio plug-ins / Advanced EQ", onOpenPlugins)}
      </>)}
      {lists && <div className="wa-menubar-lists"><PlaylistManager onClose={() => setLists(false)} /></div>}
    </div>
  );
}
