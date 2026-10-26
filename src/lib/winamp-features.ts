// Pure helpers for Winamp-style playback, playlist editing and shortcut behaviour.
export type RepeatMode = "off" | "all" | "track";
export const REPEAT_ORDER: RepeatMode[] = ["off", "all", "track"];
export const nextRepeat = (m: RepeatMode): RepeatMode => REPEAT_ORDER[(REPEAT_ORDER.indexOf(m) + 1) % REPEAT_ORDER.length] ?? "off";

/** Track to play when the current one ends; -1 stops. */
export function indexAfterEnd(cur: number, len: number, o: { shuffle: boolean; repeat: RepeatMode; stopAfter: boolean }, rand: () => number = Math.random) {
  if (len === 0 || o.stopAfter) return -1;
  if (o.repeat === "track") return cur;
  if (o.shuffle) {
    if (len === 1) return o.repeat === "all" ? 0 : -1;
    let n = Math.floor(rand() * (len - 1));
    if (n >= cur) n += 1;
    return n;
  }
  if (cur + 1 < len) return cur + 1;
  return o.repeat === "all" ? 0 : -1;
}

type Sortable = { title: string; file: { name: string; webkitRelativePath?: string; size: number } };
export type SortKey = "title" | "filename" | "path";
const keyOf = (t: Sortable, k: SortKey) => k === "title" ? t.title : k === "filename" ? t.file.name : (t.file.webkitRelativePath || t.file.name);
export function sortTracks<T extends Sortable>(list: T[], k: SortKey) {
  return [...list].sort((a, b) => keyOf(a, k).localeCompare(keyOf(b, k), undefined, { numeric: true, sensitivity: "base" }));
}
export function randomize<T>(list: T[], rand: () => number = Math.random) {
  const n = [...list];
  for (let i = n.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [n[i], n[j]] = [n[j] as T, n[i] as T]; }
  return n;
}
export function removeDuplicates<T extends Sortable>(list: T[]) {
  const seen = new Set<string>();
  return list.filter(t => { const k = `${t.file.name}:${t.file.size}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
/** Move selected rows one step up (-1) or down (+1), keeping their order. */
export function moveSelected<T extends { id: number }>(list: T[], ids: Set<number>, dir: -1 | 1) {
  const n = [...list];
  const idx = n.map((t, i) => (ids.has(t.id) ? i : -1)).filter(i => i >= 0);
  if (!idx.length) return n;
  if (dir < 0 && idx[0] === 0) return n;
  if (dir > 0 && idx[idx.length - 1] === n.length - 1) return n;
  for (const i of dir < 0 ? idx : [...idx].reverse()) { const t = n[i] as T; n[i] = n[i + dir] as T; n[i + dir] = t; }
  return n;
}

/** Parse "m:ss", "h:mm:ss" or plain seconds. Returns null when invalid. */
export function parseTime(text: string): number | null {
  const s = text.trim();
  if (!/^\d+(:\d{1,2}){0,2}$/.test(s)) return null;
  const parts = s.split(":").map(Number);
  if (parts.slice(1).some(v => v >= 60)) return null;
  return parts.reduce((acc, v) => acc * 60 + v, 0);
}

export function toM3U(list: { title: string; duration: number; file: { name: string; webkitRelativePath?: string } }[]) {
  return ["#EXTM3U", ...list.flatMap(t => [`#EXTINF:${Math.round(t.duration || -1)},${t.title}`, t.file.webkitRelativePath || t.file.name])].join("\r\n") + "\r\n";
}
/** File names referenced by an M3U/M3U8 or PLS playlist (folders stripped). */
export function playlistEntries(text: string) {
  return text.split(/\r?\n/).map(l => l.trim()).flatMap(l => {
    if (!l || l.startsWith("#") || l.startsWith("[")) return [];
    const m = /^File\d+=(.+)$/i.exec(l);
    const ref = m ? m[1] ?? "" : /^[A-Za-z]+\d*=/.test(l) ? "" : l;
    if (!ref || /^[a-z]+:\/\//i.test(ref)) return [];
    return [ref.split(/[\\/]/).pop() ?? ref];
  });
}

export function searchTracks<T extends { title: string; file: { name: string } }>(list: T[], q: string) {
  const words = q.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return list.map((t, i) => ({ t, i })).filter(({ t }) => { const h = `${t.title} ${t.file.name}`.toLocaleLowerCase(); return words.every(w => h.includes(w)); });
}

export const SHORTCUTS: [string, string][] = [
  ["Z / X / C / V / B", "Previous / Play / Pause / Stop / Next"],
  ["Shift+V", "Fade out and stop"],
  ["Ctrl+V", "Stop after current track"],
  ["← / →", "Rewind / forward 5 seconds"],
  ["↑ / ↓", "Volume up / down"],
  ["S", "Shuffle on/off"],
  ["R", "Repeat: off → all → track"],
  ["A", "A-B repeat: set A, set B, clear"],
  ["J", "Jump to file"],
  ["Ctrl+J", "Jump to time"],
  ["L / Shift+L", "Open files / add folder"],
  ["Ctrl+T", "Elapsed / remaining time"],
  ["Alt+3", "File info"],
  ["Alt+E / Alt+G", "Show playlist / equalizer"],
  ["Alt+L", "Music library"],
  ["Ctrl+A / Ctrl+I", "Playlist: select all / invert selection"],
  ["Delete / Ctrl+Delete", "Playlist: remove selected / crop to selected"],
  ["Alt+↑ / Alt+↓", "Playlist: move selected up / down"],
  ["Enter", "Playlist: play selected"],
  ["F1", "This help"],
];
