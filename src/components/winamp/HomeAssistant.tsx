import { useEffect, useRef, useState } from "react";
import { Copy, Power, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { desktopBridge, type ControllerSettings } from "@/lib/desktop-bridge";
import { applyControllerCommand, controllerState } from "@/lib/home-assistant-player";
import { usePlayer } from "./player-context";

export function HomeAssistantPlayerBridge() {
  const p = usePlayer();
  const latest = useRef(p); latest.current = p;
  useEffect(() => {
    const bridge = desktopBridge(); if (!bridge) return;
    const publish = () => bridge.publishPlayer(controllerState(latest.current));
    publish(); const timer = setInterval(publish, 1000);
    const unsubscribe = bridge.onControllerCommand(async command => {
      try {
        await applyControllerCommand(latest.current, command);
        // Allow React and the audio element to report the result, not an optimistic state.
        await new Promise(resolve => setTimeout(resolve, 150));
        const state = controllerState(latest.current);
        const failedPlay = ["play", "next", "previous", "track"].includes(command.command) && state.state !== "playing";
        bridge.controllerResult({ id: command.id, ok: !failedPlay, state });
      } catch { bridge.controllerResult({ id: command.id, ok: false }); }
    });
    return () => { clearInterval(timer); unsubscribe(); };
  }, []);
  return null;
}

export function HomeAssistantSettings() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<ControllerSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const change = async (action: "status" | "enable" | "disable" | "rotate" | "copy-token") => {
    const bridge = desktopBridge(); if (!bridge) return;
    setBusy(true); setError("");
    try { const value = await bridge.homeAssistant(action); setSettings(value); setError(value.error); setCopied(action === "copy-token"); }
    catch { setError("Could not update Home Assistant settings."); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    const show = () => { setOpen(true); void change("status"); };
    window.addEventListener("amply:home-assistant-settings", show);
    return () => window.removeEventListener("amply:home-assistant-settings", show);
  }, []);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
      <DialogTitle>Home Assistant</DialogTitle>
      <DialogDescription>Windows controller · {settings?.enabled ? "Enabled" : "Disabled"}</DialogDescription>
      <Button variant="outline" disabled={busy || !settings} onClick={() => void change(settings?.enabled ? "disable" : "enable")}><Power />{settings?.enabled ? "Disable controller" : "Enable controller"}</Button>
      {settings?.enabled && <>
        <label className="text-sm" htmlFor="ha-address">PC address</label>
        <Input id="ha-address" readOnly value={settings.addresses.join(", ") || "No private network address found"} />
        <div className="text-sm text-muted-foreground">Port {settings.port}</div>
        <label className="text-sm" htmlFor="ha-pairing">Pairing key</label>
        <div className="flex min-w-0 gap-2"><Input id="ha-pairing" type="password" readOnly value={settings.token} /><Button variant="outline" size="icon" title={copied ? "Copied" : "Copy pairing key"} aria-label="Copy pairing key" disabled={busy} onClick={() => void change("copy-token")}><Copy /></Button></div>
        <Button variant="outline" disabled={busy} onClick={() => { if (window.confirm("Replace the pairing key? Home Assistant will need the new key.")) void change("rotate"); }}><RefreshCw />Replace pairing key</Button>
      </>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </DialogContent>
  </Dialog>;
}