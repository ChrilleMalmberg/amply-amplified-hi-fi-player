import { useMemo, useRef, useState } from "react";
import { FolderPlus, Plus, Play, Search, X, Folder, Disc3, Users, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { filterLibrary, GROUP_LABELS, type LibraryGroup } from "@/lib/music-library";
import { fmtTime } from "@/lib/winamp-logic";
import type { StoredItem } from "@/lib/playlist-store";
import type { useMusicLibrary } from "./use-music-library";
import { usePlayer } from "./player-context";

type Props = { library: ReturnType<typeof useMusicLibrary>; onNewWindow: (source: string) => void; initialSource?: string };
const ICONS = { artist: Users, album: Disc3, genre: Tags, folder: Folder, source: Folder };

export function LibraryWindow({ library, onNewWindow, initialSource = "" }: Props) {
  const p = usePlayer();
  const [group, setGroup] = useState<LibraryGroup>("artist");
  const [selected, setSelected] = useState("");
  const [source, setSource] = useState(initialSource);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const dirRef = useRef<HTMLInputElement>(null);
  const [cols, setCols] = useState<number[]>(() => { try { return JSON.parse(localStorage.getItem("amply-library-cols") || "") } catch { return [48, 40, 12]; } });
  const [groupW, setGroupW] = useState(() => Number(localStorage.getItem("amply-library-groupw")) || 175);
  const tableRef = useRef<HTMLTableElement>(null);
  const dragCol = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const total = tableRef.current?.clientWidth || 1, x0 = e.clientX, start = [...cols];
    const move = (ev: PointerEvent) => {
      const dp = ((ev.clientX - x0) / total) * 100;
      const a = Math.max(8, (start[i] ?? 0) + dp), b = Math.max(8, (start[i] ?? 0) + (start[i + 1] ?? 0) - a);
      const next = [...start]; next[i] = (start[i] ?? 0) + (start[i + 1] ?? 0) - b; next[i + 1] = b; setCols(next);
      localStorage.setItem("amply-library-cols", JSON.stringify(next));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const dragGroups = (e: React.PointerEvent) => {
    e.preventDefault(); const x0 = e.clientX, w0 = groupW;
    const move = (ev: PointerEvent) => { const w = Math.max(80, Math.min(500, w0 + ev.clientX - x0)); setGroupW(w); localStorage.setItem("amply-library-groupw", String(w)); };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const sources = useMemo(() => [...new Set(library.items.map(i => i.source || "Loose files"))].sort(), [library.items]);
  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    filterLibrary(library.items, query, group, "", source).forEach(item => {
      const name = item[group] || "Unknown";
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return [...counts].sort(([a], [b]) => a.localeCompare(b));
  }, [library.items, group, query, source]);
  const rows = useMemo(() => filterLibrary(library.items, query, group, selected, source), [library.items, query, group, selected, source]);
  const play = (items: StoredItem[]) => {
    if (!items.length) return;
    p.playItems(items);
    setMessage(`Playing ${items.length} track${items.length === 1 ? "" : "s"}`);
  };
  const queue = () => {
    p.appendItems(rows);
    setMessage(`Added ${rows.length} tracks to queue`);
  };
  return <section className="wa-library" aria-label="Music library">
    <input ref={dirRef} type="file" multiple hidden {...{ webkitdirectory: "" }} onChange={e => {
      if (e.target.files) void library.importFiles(Array.from(e.target.files));
      e.target.value = "";
    }} />
    <div className="wa-library-toolbar">
      <Button variant="retro" size="retro" className="wa-toggle" disabled={!library.ready || !!library.progress} onClick={() => dirRef.current?.click()}><FolderPlus /> ADD FOLDER</Button>
      <select aria-label="Music source" className="wa-library-select" value={source} onChange={e => { setSource(e.target.value); setSelected(""); }}>
        <option value="">All sources</option>{sources.map(s => <option key={s}>{s}</option>)}
      </select>
      <Button variant="retro" size="retro" className="wa-toggle wa-icon-control" aria-label="Open another source window" title="Open another source window" onClick={() => onNewWindow(source)}><Plus /></Button>
    </div>
    <div className="wa-library-tabs" role="tablist" aria-label="Group music">
      {(Object.keys(GROUP_LABELS) as LibraryGroup[]).map(key => {
        const Icon = ICONS[key];
        return <Button key={key} variant="retro" size="retro" role="tab" aria-selected={group === key} className={`wa-toggle ${key === group ? "wa-on" : ""}`} onClick={() => { setGroup(key); setSelected(""); }}><Icon />{GROUP_LABELS[key]}</Button>;
      })}
    </div>
    <div className="wa-library-search"><Search size={16} /><input aria-label="Search music library" value={query} placeholder="Search music…" onChange={e => setQuery(e.target.value)} /><Button variant="retro" size="retro" className="wa-toggle wa-icon-control" aria-label="Clear music search" onClick={() => setQuery("")}><X /></Button></div>
    <div className="wa-library-body" style={{ gridTemplateColumns: `${groupW}px minmax(0, 1fr)` }}>
      <nav className="wa-library-groups" aria-label={GROUP_LABELS[group]}>
        <Button variant="retro" size="retro" className={`wa-group ${!selected ? "wa-selected" : ""}`} onClick={() => setSelected("")}><span>All {GROUP_LABELS[group].toLowerCase()}</span><span>{groups.reduce((sum, [, n]) => sum + n, 0)}</span></Button>
        {groups.map(([name, count]) => <Button key={name} variant="retro" size="retro" className={`wa-group ${selected === name ? "wa-selected" : ""}`} onClick={() => setSelected(name)} title={name}><span>{name}</span><span>{count}</span></Button>)}
      </nav>
      <span className="wa-col-grip" style={{ left: groupW - 3, right: "auto" }} role="separator" aria-label="Resize categories" onPointerDown={dragGroups} />
      <div className="wa-library-tracks">
        <table ref={tableRef}><colgroup>{cols.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup><thead><tr>
          <th style={{ position: "sticky" }}>Title<span className="wa-col-grip" role="separator" aria-label="Resize Title column" onPointerDown={dragCol(0)} /></th>
          <th style={{ position: "sticky" }}>Artist / Album<span className="wa-col-grip" role="separator" aria-label="Resize Artist column" onPointerDown={dragCol(1)} /></th>
          <th>Time</th></tr></thead><tbody>
          {rows.map((item, i) => <tr key={`${item.folder}/${item.file.name}/${i}`}><td><Button variant="retro" size="retro" className="wa-track-title" onClick={() => play([item])} title={`Play ${item.title}`}><Play size={12} /><span>{item.title}</span></Button></td><td><span>{item.artist}</span><small>{item.album}</small></td><td>{item.duration ? fmtTime(item.duration) : "—"}</td></tr>)}
        </tbody></table>
        {!rows.length && <div className="wa-pl-empty">{!library.ready ? "Loading music…" : library.items.length ? "No matching music" : "No folders added"}</div>}
      </div>
    </div>
    <div className="wa-library-footer">
      <Button variant="retro" size="retro" className="wa-toggle" disabled={!rows.length} onClick={() => play(rows)}><Play />PLAY</Button>
      <Button variant="retro" size="retro" className="wa-toggle" disabled={!rows.length} onClick={queue}><Plus />QUEUE</Button>
      <span className="wa-library-status" role="status">{library.progress ? `Importing ${library.progress.done} / ${library.progress.total}` : library.error || message || `${rows.length} tracks · ${sources.length} sources`}</span>
    </div>
    {library.progress && <progress className="wa-import-progress" aria-label="Folder import progress" max={library.progress.total || 1} value={library.progress.done} />}
  </section>;
}