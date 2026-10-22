import type { Rect } from "./winamp-logic";

export type WindowRect = Rect & { id: string; minW?: number; minH?: number };
export function touching(a: Rect, b: Rect, tolerance = 2) {
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return (overlapX > 2 && (Math.abs(a.y + a.h - b.y) <= tolerance || Math.abs(b.y + b.h - a.y) <= tolerance)) ||
    (overlapY > 2 && (Math.abs(a.x + a.w - b.x) <= tolerance || Math.abs(b.x + b.w - a.x) <= tolerance));
}

export function connectedWindows(id: string, windows: WindowRect[], detached: string[] = []) {
  const first = windows.find(w => w.id === id);
  if (!first) return [];
  const result = [first];
  if (detached.includes(id)) return result;
  for (let i = 0; i < result.length; i++) {
    const current = result[i];
    if (!current) continue;
    for (const candidate of windows) {
      if (!detached.includes(candidate.id) && !result.some(w => w.id === candidate.id) && touching(current, candidate)) result.push(candidate);
    }
  }
  return result;
}

export function bounds(windows: Rect[]): Rect {
  if (!windows.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x = Math.min(...windows.map(w => w.x));
  const y = Math.min(...windows.map(w => w.y));
  return { x, y, w: Math.max(...windows.map(w => w.x + w.w)) - x, h: Math.max(...windows.map(w => w.y + w.h)) - y };
}

/** The player leads its docked group; other title bars move only their own window. */
export function dragWindows(id: string, windows: WindowRect[], detached: string[] = []) {
  return id === "main" ? connectedWindows(id, windows, detached) : windows.filter(w => w.id === id);
}

/** Translate without changing shared edges, keeping the whole group on the top/left of the workspace. */
export function moveWindows(windows: WindowRect[], dx: number, dy: number): WindowRect[] {
  const group = bounds(windows);
  const x = Math.max(-group.x, dx);
  const y = Math.max(-group.y, dy);
  return windows.map(w => ({ ...w, x: w.x + x, y: w.y + y }));
}

/** Scale a docked group on both axes, preserving shared edges and each window's minimum size. */
export function resizeWindows(windows: WindowRect[], dx: number, dy: number): WindowRect[] {
  const group = bounds(windows);
  if (!group.w || !group.h) return windows;
  const sx = Math.max((group.w + dx) / group.w, ...windows.map(w => (w.minW ?? 320) / w.w));
  const sy = Math.max((group.h + dy) / group.h, ...windows.map(w => (w.minH ?? 140) / w.h));
  return windows.map(w => {
    const x = Math.round(group.x + (w.x - group.x) * sx);
    const y = Math.round(group.y + (w.y - group.y) * sy);
    return { ...w, x, y, w: Math.round(group.x + (w.x + w.w - group.x) * sx) - x, h: Math.round(group.y + (w.y + w.h - group.y) * sy) - y };
  });
}