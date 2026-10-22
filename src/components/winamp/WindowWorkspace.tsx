import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { WindowRect } from "@/lib/window-layout";

type Workspace = {
  layout: Record<string, WindowRect>;
  detached: string[];
  update: (windows: WindowRect[]) => void;
  detach: (id: string, detached: boolean) => void;
  reset: () => void;
};
const Context = createContext<Workspace | null>(null);
export function useWindowWorkspace() { return useContext(Context); }

export function WindowWorkspace({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState<Record<string, WindowRect>>({});
  const [detached, setDetached] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("amply-window-layout") || "null");
      if (saved?.layout) {
        const clean: Record<string, WindowRect> = {};
        for (const [id, value] of Object.entries(saved.layout)) {
          const r = value as WindowRect;
          if (r && [r.x, r.y, r.w, r.h].every(Number.isFinite) && r.w >= 300 && r.h >= 80) clean[id] = { ...r, id, x: Math.max(0, r.x), y: Math.max(0, r.y) };
        }
        setLayout(clean);
      }
      if (Array.isArray(saved?.detached)) setDetached(saved.detached.filter((id: unknown) => typeof id === "string"));
    } catch { /* use default layout */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem("amply-window-layout", JSON.stringify({ layout, detached })); } catch { /* offline storage unavailable */ }
  }, [layout, detached, ready]);
  return <Context.Provider value={{ layout, detached,
    update: windows => setLayout(old => ({ ...old, ...Object.fromEntries(windows.map(w => [w.id, w])) })),
    detach: (id, off) => setDetached(old => off ? [...new Set([...old, id])] : old.filter(item => item !== id)),
    reset: () => { setLayout({}); setDetached([]); },
  }}>{children}</Context.Provider>;
}