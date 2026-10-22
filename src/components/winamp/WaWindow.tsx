import { useRef, useState, type ReactNode } from "react";
import { snap, type Rect } from "@/lib/winamp-logic";
import { Button } from "@/components/ui/button";

type Props = {
  id: string;
  title: string;
  pos: { x: number; y: number };
  onMove: (p: { x: number; y: number }) => void;
  onClose?: () => void;
  width: number;
  children: ReactNode;
  onContextMenu?: (e: React.MouseEvent) => void;
  controls?: ReactNode;
};

export function WaWindow({ id, title, pos, onMove, onClose, width, children, onContextMenu, controls }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [shaded, setShaded] = useState(false);
  const [layer, setLayer] = useState(1);

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const el = ref.current;
    if (!el) return;
    const ox = e.clientX - pos.x;
    const oy = e.clientY - pos.y;
    const others: Rect[] = Array.from(document.querySelectorAll<HTMLElement>("[data-wa-win]"))
      .filter((n) => n.dataset["waWin"] !== id)
      .map((n) => {
        const r = n.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      });
    const move = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      onMove(snap({ x: ev.clientX - ox, y: ev.clientY - oy, w: r.width, h: r.height }, others, window.innerWidth, window.innerHeight));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      ref={ref}
      data-wa-win={id}
      className="wa-window"
      style={{ left: pos.x, top: pos.y, width, zIndex: layer }}
      onPointerDownCapture={() => setLayer(Date.now())}
      onContextMenu={onContextMenu}
    >
      <div className="wa-titlebar" onPointerDown={onDown} onDoubleClick={() => setShaded((s) => !s)}>
        <span className="wa-title-stripes" />
        <span className="wa-title-text">{title}</span>
        <span className="wa-title-stripes" />
        {controls}
        <Button variant="retro" size="retro" className="wa-tbtn" aria-label={`Shade ${title}`} title="Collapse to title bar" onClick={() => setShaded((s) => !s)}>
          _
        </Button>
        {onClose && (
          <Button variant="retro" size="retro" className="wa-tbtn" aria-label={`Close ${title}`} title="Close window" onClick={onClose}>
            ×
          </Button>
        )}
      </div>
      {!shaded && children}
    </div>
  );
}
