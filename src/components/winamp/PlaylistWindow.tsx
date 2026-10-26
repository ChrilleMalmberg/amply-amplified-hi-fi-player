import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePlayer, AUDIO_ACCEPT, type Track } from "./player-context";
import { fmtTime } from "@/lib/winamp-logic";
import { moveSelected, playlistEntries, randomize, removeDuplicates, sortTracks, toM3U } from "@/lib/winamp-features";
import { PlaylistManager } from "./PlaylistManager";
import { openDialog } from "./WinampCommands";
import { useMusicLibrary } from "./use-music-library";

export function PlaylistWindow() {
  const p = usePlayer();
  const library = useMusicLibrary();
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [anchor, setAnchorRow] = useState<number | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const [lists, setLists] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [menuAt, setMenuAt] = useState({ x: 0, bottom: 0 });
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);
  const plsRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const total = p.tracks.reduce((s, t) => s + (t.duration || 0), 0);
  const selTime = p.tracks.filter(t => sel.has(t.id)).reduce((s, t) => s + (t.duration || 0), 0);

  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest(".wa-pl-menu, .wa-pl-bar")) setMenu(null); };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  const click = (e: React.MouseEvent, i: number, id: number) => {
    if (e.shiftKey && anchor !== null) {
      const [a, b] = [Math.min(anchor, i), Math.max(anchor, i)];
      setSel(new Set(p.tracks.slice(a, b + 1).map(t => t.id)));
      return;
    }
    setAnchorRow(i);
    setSel(s => {
      const n = new Set(e.ctrlKey || e.metaKey ? s : []);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const keep = (fn: (ts: Track[]) => Track[]) => {
    const cur = p.tracks[p.current];
    const next = fn(p.tracks);
    if (cur && !next.some(t => t.id === cur.id)) p.stop();
    p.setTracks(next);
  };
  const remove = () => { keep(ts => ts.filter(t => !sel.has(t.id))); setSel(new Set()); };
  const crop = () => { keep(ts => ts.filter(t => sel.has(t.id))); };
  const invert = () => setSel(new Set(p.tracks.filter(t => !sel.has(t.id)).map(t => t.id)));
  const reorder = (to: number) => {
    if (drag === null || drag === to) return;
    const n = [...p.tracks]; const [m] = n.splice(drag, 1); if (m) n.splice(to, 0, m);
    p.setTracks(n); setDrag(null);
  };
  const removeMissing = () => keep(ts => ts.filter(t => t.duration > 0 || !p.skipped.includes(t.file.name)));
  const exportM3U = () => {
    const url = URL.createObjectURL(new Blob([toM3U(p.tracks)], { type: "audio/x-mpegurl" }));
    const a = document.createElement("a"); a.href = url; a.download = "AmPly playlist.m3u8"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importList = async (file: File) => {
    const names = playlistEntries(await file.text());
    const pool = new Map<string, File>();
    library.items.forEach(it => pool.set(it.file.name.toLowerCase(), it.file));
    p.tracks.forEach(t => pool.set(t.file.name.toLowerCase(), t.file));
    const found = names.flatMap(n => { const f = pool.get(n.toLowerCase()); return f ? [f] : []; });
    if (found.length) await p.addFiles(found);
    setNote(`${found.length} of ${names.length} tracks added${found.length < names.length ? " — import missing songs into the music library first" : ""}.`);
  };
  const playSelected = () => { const i = p.tracks.findIndex(t => sel.has(t.id)); if (i >= 0) p.playAt(i); };

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input, textarea")) return;
    const c = e.ctrlKey || e.metaKey;
    const run = (f: () => void) => { e.preventDefault(); f(); };
    if (c && e.key.toLowerCase() === "a") run(() => setSel(new Set(p.tracks.map(t => t.id))));
    else if (c && e.key.toLowerCase() === "i") run(invert);
    else if (c && e.key === "Delete") run(crop);
    else if (e.key === "Delete") run(remove);
    else if (e.altKey && e.key === "ArrowUp") run(() => p.setTracks(moveSelected(p.tracks, sel, -1)));
    else if (e.altKey && e.key === "ArrowDown") run(() => p.setTracks(moveSelected(p.tracks, sel, 1)));
    else if (e.key === "Enter") run(playSelected);
  };

  const item = (label: ReactNode, action: () => void, disabled = false) => (
    <button className="wa-menu-item" role="menuitem" disabled={disabled} onClick={() => { setMenu(null); action(); }}>{label}</button>
  );
  const group = (id: string, label: string, items: ReactNode) => (
    <span className="wa-pl-group">
      <button className={`wa-toggle ${menu === id ? "wa-on" : ""}`} aria-haspopup="menu" aria-expanded={menu === id} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenuAt({ x: r.left, bottom: window.innerHeight - r.top + 2 }); setMenu(m => m === id ? null : id); }}>{label}</button>
      {menu === id && createPortal(<div className="wa-menu wa-pl-menu" role="menu" aria-label={label} data-skin={rootRef.current?.closest("[data-skin]")?.getAttribute("data-skin") ?? undefined} style={{ left: menuAt.x, bottom: menuAt.bottom }}>{items}</div>, rootRef.current?.closest(".wa-desktop") ?? document.body)}
    </span>
  );
  const none = sel.size === 0;

  return (
    <div ref={rootRef} tabIndex={0} onKeyDown={onKey}
      className={`wa-pl ${over ? "wa-drop" : ""}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); setOver(false); void p.addFiles(e.dataTransfer.files); }}
    >
      <input ref={fileRef} type="file" multiple accept={AUDIO_ACCEPT} hidden onChange={(e) => { if (e.target.files) void p.addFiles(e.target.files); e.target.value = ""; }} />
      <input ref={dirRef} type="file" multiple hidden {...{ webkitdirectory: "" }} onChange={(e) => { if (e.target.files) void p.addFiles(e.target.files); e.target.value = ""; }} />
      <input ref={plsRef} type="file" accept=".m3u,.m3u8,.pls" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importList(f); e.target.value = ""; }} />
      <div className="wa-pl-list">
        {p.tracks.length === 0 && <div className="wa-pl-empty">Drop music files here (MP3, FLAC, WAV, OGG, OPUS, M4A, AIFF...)</div>}
        {p.tracks.map((t, i) => (
          <div key={t.id} draggable
            onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { if (drag !== null) { e.stopPropagation(); reorder(i); } }}
            onClick={(e) => click(e, i, t.id)} onDoubleClick={() => p.playAt(i)}
            className={`wa-pl-row ${i === p.current ? "wa-current" : ""} ${sel.has(t.id) ? "wa-selected" : ""}`}>
            <span className="wa-pl-name">{i + 1}. {t.title}</span>
            <span>{t.duration ? fmtTime(t.duration) : ""}</span>
          </div>
        ))}
      </div>
      {p.skipped.length > 0 && <div className="wa-pl-warn">Can't play: {p.skipped.join(", ")}</div>}
      {note && <div className="wa-pl-warn" role="status" onClick={() => setNote("")}>{note}</div>}
      <div className="wa-pl-bar">
        {group("add", "ADD", <>
          {item("Add files…", () => fileRef.current?.click())}
          {item("Add folder…", () => dirRef.current?.click())}
        </>)}
        {group("rem", "REM", <>
          {item("Remove selected  (Del)", remove, none)}
          {item("Crop to selected  (Ctrl+Del)", crop, none)}
          {item("Remove duplicates", () => keep(removeDuplicates))}
          {item("Remove unplayable files", removeMissing)}
          {item("Remove all", () => keep(() => []))}
        </>)}
        {group("sel", "SEL", <>
          {item("Select all  (Ctrl+A)", () => setSel(new Set(p.tracks.map(t => t.id))))}
          {item("Select none", () => setSel(new Set()))}
          {item("Invert selection  (Ctrl+I)", invert)}
        </>)}
        {group("misc", "MISC", <>
          {item("Sort by title", () => p.setTracks(sortTracks(p.tracks, "title")))}
          {item("Sort by file name", () => p.setTracks(sortTracks(p.tracks, "filename")))}
          {item("Sort by path and file name", () => p.setTracks(sortTracks(p.tracks, "path")))}
          {item("Reverse list", () => p.setTracks([...p.tracks].reverse()))}
          {item("Randomize list", () => p.setTracks(randomize(p.tracks)))}
          {item("Move selected up  (Alt+↑)", () => p.setTracks(moveSelected(p.tracks, sel, -1)), none)}
          {item("Move selected down  (Alt+↓)", () => p.setTracks(moveSelected(p.tracks, sel, 1)), none)}
          {item("Play selected  (Enter)", playSelected, none)}
          {item("File info…  (Alt+3)", () => openDialog("file-info"))}
          {item("Jump to file…  (J)", () => openDialog("jump-file"))}
        </>)}
        {group("list", "LIST", <>
          {item("New list", () => keep(() => []))}
          {item("Save / load AmPly lists…", () => setLists(v => !v))}
          {item("Import M3U / PLS…", () => plsRef.current?.click())}
          {item("Export as M3U…", exportM3U, !p.tracks.length)}
        </>)}
        <span className="wa-spacer" />
        <span className="wa-lcd wa-small">{sel.size ? `${fmtTime(selTime)}/` : ""}{fmtTime(total)} · {p.tracks.length}</span>
      </div>
      {lists && <PlaylistManager onClose={() => setLists(false)} />}
    </div>
  );
}
