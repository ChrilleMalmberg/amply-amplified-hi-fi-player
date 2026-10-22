import { useRef, useState } from "react";
import { usePlayer, AUDIO_ACCEPT } from "./player-context";
import { fmtTime } from "@/lib/winamp-logic";

export function PlaylistWindow() {
  const p = usePlayer();
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);
  const total = p.tracks.reduce((s, t) => s + (t.duration || 0), 0);

  const click = (e: React.MouseEvent, id: number) => {
    setSel((s) => {
      const n = new Set(e.ctrlKey || e.metaKey ? s : []);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const remove = () => {
    const cur = p.tracks[p.current];
    if (cur && sel.has(cur.id)) p.stop();
    p.setTracks((ts) => ts.filter((t) => !sel.has(t.id)));
    setSel(new Set());
  };
  const reorder = (to: number) => {
    if (drag === null || drag === to) return;
    p.setTracks((ts) => {
      const n = [...ts];
      const [m] = n.splice(drag, 1);
      n.splice(to, 0, m);
      return n;
    });
    setDrag(null);
  };

  return (
    <div
      className={`wa-pl ${over ? "wa-drop" : ""}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setOver(false);
        void p.addFiles(e.dataTransfer.files);
      }}
    >
      <input ref={fileRef} type="file" multiple accept={AUDIO_ACCEPT} hidden onChange={(e) => e.target.files && p.addFiles(e.target.files)} />
      <input ref={dirRef} type="file" multiple hidden {...{ webkitdirectory: "" }} onChange={(e) => e.target.files && p.addFiles(e.target.files)} />
      <div className="wa-pl-list">
        {p.tracks.length === 0 && <div className="wa-pl-empty">Drop music files here (MP3, FLAC, WAV, OGG, OPUS, M4A, AIFF...)</div>}
        {p.tracks.map((t, i) => (
          <div
            key={t.id}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              if (drag !== null) {
                e.stopPropagation();
                reorder(i);
              }
            }}
            onClick={(e) => click(e, t.id)}
            onDoubleClick={() => p.playAt(i)}
            className={`wa-pl-row ${i === p.current ? "wa-current" : ""} ${sel.has(t.id) ? "wa-selected" : ""}`}
          >
            <span className="wa-pl-name">
              {i + 1}. {t.title}
            </span>
            <span>{t.duration ? fmtTime(t.duration) : ""}</span>
          </div>
        ))}
      </div>
      {p.skipped.length > 0 && <div className="wa-pl-warn">Your browser can't play: {p.skipped.join(", ")}</div>}
      <div className="wa-pl-bar">
        <button className="wa-toggle" onClick={() => fileRef.current?.click()}>+FILE</button>
        <button className="wa-toggle" onClick={() => dirRef.current?.click()}>+DIR</button>
        <button className="wa-toggle" onClick={remove}>REM</button>
        <button className="wa-toggle" onClick={() => setSel(new Set(p.tracks.map((t) => t.id)))}>SEL ALL</button>
        <span className="wa-spacer" />
        <span className="wa-lcd wa-small">
          {p.tracks.length} / {fmtTime(total)}
        </span>
      </div>
    </div>
  );
}
