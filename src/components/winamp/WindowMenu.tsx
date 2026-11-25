import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export function WindowMenu({ x, y, onClose, onMaximize, onMinimize, onReset, onExit, onDetach, detached = false }: {
  x: number; y: number; onClose: () => void; onMaximize: () => void; onMinimize: () => void;
  onReset: () => void; onExit?: () => void; onDetach?: () => void; detached?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("pointerdown", close); window.addEventListener("keydown", key);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", key); };
  }, [onClose]);
  const item = (label: string, action: () => void) => <Button variant="retro" size="retro" role="menuitem" className="wa-menu-item" onClick={() => { action(); onClose(); }}>{label}</Button>;
  return <div ref={ref} className="wa-menu wa-system-menu" role="menu" aria-label="Window options" style={{ left: x, top: y }}>
    {item("Maximize / Restore", onMaximize)}
    {item("Minimize", onMinimize)}
    {onDetach && item(detached ? "Join snapped windows" : "Detach window", onDetach)}
    <div className="wa-menu-sep" />
    {item("Reset windows", onReset)}
    {onExit && item("Close", onExit)}
  </div>;
}