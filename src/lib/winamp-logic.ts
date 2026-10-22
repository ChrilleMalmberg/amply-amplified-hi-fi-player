export type Rect = { x: number; y: number; w: number; h: number };

/** Snap a window rect to screen edges and to other windows' edges within `t` pixels. */
export function snap(r: Rect, others: Rect[], vw: number, vh: number, t = 10) {
  const xs = [0, vw - r.w];
  const ys = [0, vh - r.h];
  for (const o of others) {
    xs.push(o.x, o.x + o.w, o.x - r.w, o.x + o.w - r.w);
    ys.push(o.y, o.y + o.h, o.y - r.h, o.y + o.h - r.h);
  }
  const pick = (v: number, cands: number[]) => {
    let best = v;
    let d = t + 1;
    for (const c of cands) {
      const dd = Math.abs(c - v);
      if (dd <= t && dd < d) {
        d = dd;
        best = c;
      }
    }
    return best;
  };
  return { x: pick(r.x, xs), y: pick(r.y, ys) };
}

type Mode = { shuffle: boolean; repeat: boolean };

/** Next track index, or -1 when playback should stop. */
export function nextIndex(cur: number, len: number, mode: Mode, rand: () => number = Math.random) {
  if (len === 0) return -1;
  if (mode.shuffle) {
    if (len === 1) return mode.repeat ? 0 : -1;
    let n = Math.floor(rand() * (len - 1));
    if (n >= cur) n += 1;
    return n;
  }
  if (cur + 1 < len) return cur + 1;
  return mode.repeat ? 0 : -1;
}

export function prevIndex(cur: number, len: number, mode: Mode) {
  if (len === 0) return -1;
  if (cur > 0) return cur - 1;
  return mode.repeat ? len - 1 : 0;
}

export function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function decodeText(data: Uint8Array) {
  const enc = data[0];
  let body = data.slice(1);
  let label = "latin1";
  if (enc === 3) label = "utf-8";
  else if (enc === 2) label = "utf-16be";
  else if (enc === 1) {
    if (body[0] === 0xfe && body[1] === 0xff) label = "utf-16be";
    else label = "utf-16le";
    body = body.slice(2);
  }
  try {
    return new TextDecoder(label).decode(body).replace(/\0/g, "").trim();
  } catch {
    return "";
  }
}

/** Minimal ID3v2.3/2.4 reader for title + artist. */
export async function readTags(file: File): Promise<{ title?: string; artist?: string }> {
  const buf = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
  if (buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return {};
  const B = (i: number) => buf[i] ?? 0;
  const ver = buf[3];
  const ss = (i: number) =>
    ((B(i) & 127) << 21) | ((B(i + 1) & 127) << 14) | ((B(i + 2) & 127) << 7) | (B(i + 3) & 127);
  const end = Math.min(10 + ss(6), buf.length);
  let p = 10;
  const out: { title?: string; artist?: string } = {};
  while (p + 10 < end) {
    const id = String.fromCharCode(B(p), B(p + 1), B(p + 2), B(p + 3));
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const fs =
      ver === 4 ? ss(p + 4) : ((B(p + 4) << 24) | (B(p + 5) << 16) | (B(p + 6) << 8) | B(p + 7)) >>> 0;
    const data = buf.slice(p + 10, p + 10 + fs);
    if (id === "TIT2") out.title = decodeText(data);
    if (id === "TPE1") out.artist = decodeText(data);
    p += 10 + fs;
  }
  return out;
}
