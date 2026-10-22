import { useRef, useState, type ReactNode } from "react";
import { snap, type Rect } from "@/lib/winamp-logic";

type Props = {
  id: string;
  title: string;
  pos: { x: number; y: number };
  onMove: (p: { x: number; y: number }) => void;
  onClose?: () => void;
  width: number;
  children: ReactNode;
  onContextMenu?: (e: React.MouseEvent) => void;
};

export function WaWindow({ id, title, pos, onMove, onClose, width, children, onContextMenu }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [shaded, setShaded] = useState(false);

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const el = ref.current;
    if (!el) return;
    const ox = e.clientX - pos.x;
    const oy = e.clientY - pos.y;
    const others: Rect[] = Array.from(document.querySelectorAll<HTMLElement>("[data-wa-win]"))
      .filter((n) => n.dataset.waWin !== id)
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
      style={{ left: pos.x, top: pos.y, width }}
      onContextMenu={onContextMenu}
    >
      <div className="wa-titlebar" onPointerDown={onDown} onDoubleClick={() => setShaded((s) => !s)}>
        <span className="wa-title-stripes" />
        <span className="wa-title-text">{title}</span>
        <span className="wa-title-stripes" />
        <button className="wa-tbtn" aria-label="Shade" onClick={() => setShaded((s) => !s)}>
          _
        </button>
        {onClose && (
          <button className="wa-tbtn" aria-label="Close" onClick={onClose}>
            ×
          </button>
        )}
      </div>
      {!shaded && children}
    </div>
  );
}
