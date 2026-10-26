import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayer, AUDIO_ACCEPT } from "./player-context";
import { fmtTime } from "@/lib/winamp-logic";
import { parseTime, searchTracks, SHORTCUTS } from "@/lib/winamp-features";

export type DialogName = "jump-file" | "jump-time" | "file-info" | "shortcuts" | "about" | "open-files" | "open-folder";
export const openDialog = (name: DialogName) => window.dispatchEvent(new CustomEvent("amply:dialog", { detail: name }));
export const toggleTimeDisplay = () => window.dispatchEvent(new Event("amply:toggle-time"));

type Props = { onTogglePL?: () => void; onToggleEQ?: () => void; onOpenLibrary?: () => void };

/** Winamp-style keyboard shortcuts and the small utility dialogs (jump, info, help). */
export function WinampCommands({ onTogglePL, onToggleEQ, onOpenLibrary }: Props) {
  const p = usePlayer();
  const [dialog, setDialog] = useState<DialogName | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);
  const latest = useRef({ p, onTogglePL, onToggleEQ, onOpenLibrary });
  latest.current = { p, onTogglePL, onToggleEQ, onOpenLibrary };

  useEffect(() => {
    const show = (e: Event) => {
      const name = (e as CustomEvent<DialogName>).detail;
      if (name === "open-files") fileRef.current?.click();
      else if (name === "open-folder") dirRef.current?.click();
      else setDialog(name);
    };
    window.addEventListener("amply:dialog", show);
    return () => window.removeEventListener("amply:dialog", show);
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented || (e.target as HTMLElement).closest("input, select, textarea, [role='dialog']")) return;
      const { p, onTogglePL, onToggleEQ, onOpenLibrary } = latest.current;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const c = e.ctrlKey || e.metaKey;
      let f: (() => void) | undefined;
      if (e.altKey) f = ({ e: onTogglePL, g: onToggleEQ, l: onOpenLibrary, "3": () => setDialog("file-info") } as Record<string, (() => void) | undefined>)[k];
      else if (c) f = ({ v: p.toggleStopAfter, j: () => setDialog("jump-time"), t: toggleTimeDisplay } as Record<string, () => void>)[k];
      else if (e.shiftKey && k === "v") f = p.fadeStop;
      else if (e.shiftKey && k === "l") f = () => dirRef.current?.click();
      else f = ({
        z: p.prev, x: p.play, c: p.pause, v: p.stop, b: p.next, s: p.toggleShuffle, r: p.toggleRepeat, a: p.cycleAB,
        j: () => setDialog("jump-file"), l: () => fileRef.current?.click(), F1: () => setDialog("shortcuts"),
        ArrowLeft: () => p.seekBy(-5), ArrowRight: () => p.seekBy(5), ArrowUp: () => p.volumeBy(0.05), ArrowDown: () => p.volumeBy(-0.05),
      } as Record<string, () => void>)[k];
      if (f) { e.preventDefault(); f(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  return <>
    <input ref={fileRef} type="file" multiple accept={AUDIO_ACCEPT} hidden onChange={e => { if (e.target.files) void p.addFiles(e.target.files); e.target.value = ""; }} />
    <input ref={dirRef} type="file" multiple hidden {...{ webkitdirectory: "" }} onChange={e => { if (e.target.files) void p.addFiles(e.target.files); e.target.value = ""; }} />
    {dialog && <div className="wa-dialog-backdrop" onPointerDown={e => { if (e.target === e.currentTarget) setDialog(null); }}>
      <div className="wa-window wa-dialog" role="dialog" aria-modal="true" aria-label={dialog} onKeyDown={e => { if (e.key === "Escape") setDialog(null); }}>
        {dialog === "jump-file" && <JumpFile close={() => setDialog(null)} />}
        {dialog === "jump-time" && <JumpTime close={() => setDialog(null)} />}
        {dialog === "file-info" && <FileInfo close={() => setDialog(null)} />}
        {dialog === "shortcuts" && <Frame title="KEYBOARD SHORTCUTS" close={() => setDialog(null)}>
          <table className="wa-dialog-table"><tbody>{SHORTCUTS.map(([k, d]) => <tr key={k}><th>{k}</th><td>{d}</td></tr>)}</tbody></table>
        </Frame>}
        {dialog === "about" && <Frame title="ABOUT AMPLY" close={() => setDialog(null)}>
          <p>AmPly HiFi Player V-3.0 — a free, open hobby player with classic Winamp-style controls.</p>
          <p>Independent project, not affiliated with Winamp or Nullsoft. All features are rebuilt in AmPly's own code.</p>
        </Frame>}
      </div>
    </div>}
  </>;
}

function Frame({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  return <>
    <div className="wa-titlebar"><span className="wa-title-text">{title}</span><span className="wa-title-stripes" /><button className="wa-tbtn" aria-label="Close dialog" onClick={close}>✕</button></div>
    <div className="wa-dialog-body">{children}</div>
  </>;
}

function JumpFile({ close }: { close: () => void }) {
  const p = usePlayer();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const hits = useMemo(() => searchTracks(p.tracks, q).slice(0, 200), [p.tracks, q]);
  const go = (i: number | undefined) => { if (i !== undefined) { p.playAt(i); close(); } };
  return <Frame title="JUMP TO FILE" close={close}>
    <input autoFocus className="wa-dialog-input" aria-label="Search playlist" placeholder="Type to search the playlist…" value={q}
      onChange={e => { setQ(e.target.value); setSel(0); }}
      onKeyDown={e => {
        if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(hits.length - 1, s + 1)); }
        if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
        if (e.key === "Enter") go(hits[sel]?.i);
        if (e.key === "Escape") close();
      }} />
    <div className="wa-dialog-list" role="listbox">
      {hits.map(({ t, i }, n) => <div key={t.id} role="option" aria-selected={n === sel} className={`wa-pl-row ${n === sel ? "wa-selected" : ""}`} onClick={() => setSel(n)} onDoubleClick={() => go(i)}>{i + 1}. {t.title}</div>)}
      {!hits.length && <div className="wa-pl-empty">No matching tracks</div>}
    </div>
    <div className="wa-dialog-actions"><button className="wa-toggle" onClick={() => go(hits[sel]?.i)} disabled={!hits.length}>PLAY</button><button className="wa-toggle" onClick={close}>CLOSE</button></div>
  </Frame>;
}

function JumpTime({ close }: { close: () => void }) {
  const p = usePlayer();
  const [v, setV] = useState("");
  const secs = parseTime(v);
  const ok = secs !== null && p.duration > 0 && secs <= p.duration;
  const go = () => { if (ok) { p.seek(secs); close(); } };
  return <Frame title="JUMP TO TIME" close={close}>
    <p>Track length: {fmtTime(p.duration)}. Enter a time as m:ss.</p>
    <input autoFocus className="wa-dialog-input" aria-label="Time" placeholder="1:30" value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === "Enter") go(); if (e.key === "Escape") close(); }} />
    {v && !ok && <p className="wa-pl-warn">{p.duration ? "Enter a time within the track." : "Nothing is playing."}</p>}
    <div className="wa-dialog-actions"><button className="wa-toggle" disabled={!ok} onClick={go}>JUMP</button><button className="wa-toggle" onClick={close}>CLOSE</button></div>
  </Frame>;
}

function FileInfo({ close }: { close: () => void }) {
  const p = usePlayer();
  const t = p.tracks[p.current];
  const rows: [string, string][] = t ? [
    ["Title", t.title], ["File", t.file.webkitRelativePath || t.file.name], ["Type", t.file.type || "unknown"],
    ["Size", `${(t.file.size / 1048576).toFixed(2)} MB`], ["Length", fmtTime(t.duration)],
    ["Average bitrate", t.duration ? `${Math.round((t.file.size * 8) / t.duration / 1000)} kbps` : "—"],
    ["Output sample rate", `${p.sampleRate} Hz`], ["Position in playlist", `${p.current + 1} of ${p.tracks.length}`],
  ] : [];
  return <Frame title="FILE INFO" close={close}>
    {t ? <table className="wa-dialog-table"><tbody>{rows.map(([k, d]) => <tr key={k}><th>{k}</th><td>{d}</td></tr>)}</tbody></table> : <p>No track selected.</p>}
  </Frame>;
}
