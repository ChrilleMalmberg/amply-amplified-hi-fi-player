import { useEffect, useState } from "react";

export type NativePanel = { id: string; kind: "main" | "pl" | "eq" | "library" | "plugins"; source: string };
export type NativeWindowState = { detached: boolean; grouped: boolean };
export type DesktopBridge = {
  info: () => Promise<NativePanel>;
  control: (action: "ready" | "open" | "toggle" | "close" | "minimize" | "arrange" | "compact" | "full" | "shade" | "detach", value?: string | boolean) => void;
  gesture: (action: "move" | "resize" | "end", axis?: "both" | "x" | "y") => void;
  onWindowState: (callback: (state: NativeWindowState) => void) => () => void;
};
declare global { interface Window { amplyDesktop?: DesktopBridge } }
export function desktopBridge() { return typeof window === "undefined" ? undefined : window.amplyDesktop; }
export function useNativePanel() {
  const [panel, setPanel] = useState<NativePanel | null>(null);
  useEffect(() => { let active = true; void desktopBridge()?.info().then(value => { if (active) setPanel(value); }); return () => { active = false; }; }, []);
  return panel;
}