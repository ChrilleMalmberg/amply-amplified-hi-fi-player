import { useEffect, useState } from "react";

export type NativePanel = { id: string; kind: "main" | "pl" | "eq" | "library" | "plugins" | "connection"; source: string };
export type HomeAssistantSettings = { enabled: boolean; allowedAddress: string; port: number; addresses: string[]; fingerprint: string; error: string; token?: string };
export type HomeAssistantCommand = { action: "play" | "pause" | "stop" | "next" | "previous" | "seek" | "volume_set" | "volume_mute"; value?: number | boolean };
export type HomeAssistantSnapshot = { state: "idle" | "playing" | "paused"; title: string; track_id: string; position: number; duration: number; volume: number; muted: boolean; track_count: number; ready: boolean };
export type NativeWindowState = { detached: boolean; grouped: boolean };
export type DesktopBridge = {
  info: () => Promise<NativePanel>;
  control: (action: "ready" | "open" | "toggle" | "close" | "minimize" | "maximize" | "arrange" | "compact" | "full" | "shade" | "detach" | "ontop", value?: string | boolean) => void;
  gesture: (action: "move" | "resize" | "end", axis?: "both" | "x" | "y") => void;
  onWindowState: (callback: (state: NativeWindowState) => void) => () => void;
  homeAssistant: (action: "status" | "enable" | "disable" | "pairing" | "rotate", options?: { allowedAddress: string; port: number }) => Promise<HomeAssistantSettings>;
  publishHomeAssistantState: (state: HomeAssistantSnapshot) => void;
  completeHomeAssistantCommand: (id: string, ok: boolean) => void;
  onHomeAssistantCommand: (callback: (request: { id: string; command: HomeAssistantCommand }) => void) => () => void;
};
declare global { interface Window { amplyDesktop?: DesktopBridge } }
export function desktopBridge() { return typeof window === "undefined" ? undefined : window.amplyDesktop; }
export function useNativePanel() {
  const [panel, setPanel] = useState<NativePanel | null>(null);
  useEffect(() => { let active = true; void desktopBridge()?.info().then(value => { if (active) setPanel(value); }); return () => { active = false; }; }, []);
  return panel;
}
