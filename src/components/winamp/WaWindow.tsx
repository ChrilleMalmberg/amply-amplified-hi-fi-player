import { useEffect, useRef, useState, type ReactNode } from "react";
import { snap, type Rect } from "@/lib/winamp-logic";
import { Button } from "@/components/ui/button";
import { Link2, Unlink, MoveDiagonal2, Square } from "lucide-react";
import { WindowMenu } from "./WindowMenu";
import { bounds, connectedWindows, dragWindows, moveWindows, resizeWindows, type WindowRect } from "@/lib/window-layout";
import { useWindowWorkspace } from "./WindowWorkspace";

let nextWindowLayer = 1;

type Props = {
  id: string;
  title: string;
  pos: { x: number; y: number };
  onMove: (p: { x: number; y: number }) => void;
  onClose?: () => void;
  width: number;
  height?: number;
  children: ReactNode;
  onContextMenu?: (e: React.MouseEvent) => void;
  controls?: ReactNode;
};

export function WaWindow({ id, title, pos, onMove, onClose, width, height, children, controls }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [shaded, setShaded] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const restoreRects = useRef<WindowRect[] | null>(null);
  const [layer, setLayer] = useState(1);
  useEffect(() => { setLayer(++nextWindowLayer); }, []);
  const workspace = useWindowWorkspace();
  const saved = workspace?.layout[id];
  const defaultHeight = height ?? (id === "main" ? 220 : id === "eq" ? 260 : id === "pl" ? 300 : id === "plugins" ? 740 : 640);
  useEffect(() => { setShaded(false); restoreRects.current = null; }, [workspace?.resetVersion]);
  const detached = workspace?.detached.includes(id) ?? false;
  const [grouped, setGrouped] = useState(false);
  const readWindows = (): WindowRect[] => Array.from(document.querySelectorAll<HTMLElement>("[data-wa-win]"))
    .filter(n => n.dataset["shaded"] !== "true")
    .map(n => ({ id: n.dataset["waWin"] ?? "", x: n.offsetLeft, y: n.offsetTop, w: n.offsetWidth, h: n.offsetHeight,
      minW: 320, minH: n.dataset["waWin"] === "main" ? 180 : n.dataset["waWin"] === "eq" ? 200 : 140 }));
  useEffect(() => {
    setGrouped(connectedWindows(id, readWindows(), workspace?.detached).length > 1);
  }, [id, workspace?.layout, workspace?.detached, pos]);

  const maximize = () => {
    setShaded(false);
    if (restoreRects.current) { workspace?.update(restoreRects.current); restoreRects.current = null; return; }
    const windows = readWindows();
    const group = id === "main" ? connectedWindows(id, windows, workspace?.detached) : windows.filter(w => w.id === id);
    if (!group.length) return;
    restoreRects.current = group;
    const b = bounds(group);
    const moved = group.map(w => ({ ...w, x: w.x - b.x, y: w.y - b.y }));
    workspace?.update(resizeWindows(moved, window.innerWidth - b.w - 4, window.innerHeight - b.h - 4));
  };

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || e.detail > 1) return;
    if ((e.target as HTMLElement).closest("button")) return;
    const el = ref.current;
    if (!el) return;
    e.preventDefault();
    const windows = readWindows();
    const initial = windows.find(w => w.id === id);
    if (!initial) return;
    const group = dragWindows(id, windows, workspace?.detached);
    const groupBounds = bounds(group);
    const ox = e.clientX - groupBounds.x;
    const oy = e.clientY - groupBounds.y;
    const others: Rect[] = detached ? [] : windows.filter(w => !group.some(member => member.id === w.id) && !workspace?.detached.includes(w.id));
    const move = (ev: PointerEvent) => {
      const next = snap({ ...groupBounds, x: Math.max(0, ev.clientX - ox), y: Math.max(0, ev.clientY - oy) }, others, Math.max(window.innerWidth, groupBounds.x + groupBounds.w), Math.max(window.innerHeight, groupBounds.y + groupBounds.h));
      const moved = moveWindows(group, next.x - groupBounds.x, next.y - groupBounds.y);
      workspace?.update(moved);
      const player = moved.find(w => w.id === id);
      if (player) onMove({ x: player.x, y: player.y });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const onResize = (e: React.PointerEvent, axis: "both" | "x" | "y") => {
    e.preventDefault();
    e.stopPropagation();
    const windows = readWindows();
    const narrow = window.innerWidth <= 560;
    const group = connectedWindows(id, windows, narrow ? windows.filter(w => w.id !== id).map(w => w.id) : workspace?.detached);
    if (!group.length) return;
    const startX = e.clientX, startY = e.clientY;
    const move = (ev: PointerEvent) => {
      const resized = resizeWindows(group, axis === "y" ? 0 : ev.clientX - startX, axis === "x" ? 0 : ev.clientY - startY);
      workspace?.update(resized);
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return (
    <div
      ref={ref}
      data-wa-win={id}
      data-shaded={shaded}
      data-grouped={grouped}
      className="wa-window"
      style={{ left: saved?.x ?? pos.x, top: saved?.y ?? pos.y, width: saved?.w ?? width, height: shaded ? 26 : saved?.h ?? defaultHeight, zIndex: layer }}
      onPointerDownCapture={() => setLayer(++nextWindowLayer)}
      onContextMenu={e => { if ((e.target as HTMLElement).closest("input,textarea,select")) return; e.preventDefault(); e.stopPropagation(); setMenu({ x: Math.max(0, Math.min(e.clientX, window.innerWidth - 220)), y: Math.max(0, Math.min(e.clientY, window.innerHeight - 190)) }); }}
    >
      <div className="wa-titlebar" onPointerDown={onDown} onDoubleClick={e => { if (!(e.target as HTMLElement).closest("button")) maximize(); }}>
        <span className="wa-title-stripes" />
        <span className="wa-title-text">{title}</span>
        <span className="wa-title-stripes" />
        <span className="wa-title-controls">{controls}
        <Button variant="retro" size="retro" className="wa-tbtn" aria-label={`Maximize ${title}`} title="Maximize / Restore" onClick={maximize}><Square /></Button>
        <Button variant="retro" size="retro" className="wa-tbtn" aria-label={`${detached ? "Join" : "Detach"} ${title}`} title={detached ? "Allow snapping and joined resizing" : "Separate from joined resizing"} aria-pressed={!detached} onClick={() => workspace?.detach(id, !detached)}>{detached ? <Unlink /> : <Link2 />}</Button>
        <Button variant="retro" size="retro" className="wa-tbtn" aria-label={`Shade ${title}`} title="Collapse to title bar" onClick={() => setShaded((s) => !s)}>
          _
        </Button>
        {onClose && (
          <Button variant="retro" size="retro" className="wa-tbtn" aria-label={`Close ${title}`} title="Close window" onClick={onClose}>
            ×
          </Button>
        )}
        </span>
      </div>
      {!shaded && <><div className="wa-window-content">{children}</div>
        <div className="wa-resize-edge wa-resize-right" onPointerDown={e => onResize(e, "x")} />
        <div className="wa-resize-edge wa-resize-bottom" onPointerDown={e => onResize(e, "y")} />
        <Button variant="retro" size="retro" className="wa-resize-corner" aria-label={`Resize ${title}`} title={grouped ? "Resize joined windows" : "Resize window"} onPointerDown={e => onResize(e, "both")} onKeyDown={e => {
          const delta = { ArrowRight: [20, 0], ArrowLeft: [-20, 0], ArrowDown: [0, 20], ArrowUp: [0, -20] }[e.key];
          if (!delta) return;
          e.preventDefault(); e.stopPropagation();
          workspace?.update(resizeWindows(connectedWindows(id, readWindows(), workspace.detached), delta[0] ?? 0, delta[1] ?? 0));
        }}><MoveDiagonal2 /></Button>
      </>}
      {menu && <WindowMenu {...menu} onClose={() => setMenu(null)} onMaximize={maximize} onMinimize={() => setShaded(true)} onDetach={() => workspace?.detach(id, !detached)} detached={detached} onReset={() => { workspace?.reset(); window.dispatchEvent(new Event("amply:reset-windows")); }} {...(onClose ? { onExit: onClose } : {})} />}
    </div>
  );
}
