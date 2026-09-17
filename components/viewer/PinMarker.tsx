"use client";

import { useRef, useState } from "react";

// A press that travels less than this is a click that opens the thread, not a
// drag. Without it, the hand's own tremor on a trackpad turns every attempt to
// open a comment into a one-pixel move.
const DRAG_THRESHOLD_PX = 4;

export function PinMarker({
  number,
  x,
  y,
  w = 0,
  h = 0,
  status,
  selected = false,
  onClick,
  draggable = false,
  onMove,
}: {
  number: number;
  x: number;
  y: number;
  w?: number;
  h?: number;
  status: "active" | "resolved";
  selected?: boolean;
  onClick?: () => void;
  // Whether this person may reposition the pin: its author, or the team.
  draggable?: boolean;
  // Called once, on release, with the pin's new anchor in the same 0–1 space.
  onMove?: (x: number, y: number) => void;
}) {
  const bg = status === "resolved" ? "var(--success)" : "var(--primary)";
  const fg = status === "resolved" ? "#fff" : "var(--primary-foreground)";
  const isArea = w > 0 && h > 0;

  // Where the pin is drawn while it is being dragged, before the parent knows.
  const [dragAt, setDragAt] = useState<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const shownX = dragAt?.x ?? x;
  const shownY = dragAt?.y ?? y;

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    // Never let a press on a pin reach the canvas underneath, which would start
    // dropping a NEW pin at the same spot.
    e.stopPropagation();
    if (!draggable || e.button !== 0) return;

    const button = e.currentTarget;
    // The pin's coordinates are fractions of the layer the pins are laid out in.
    const layer = button.offsetParent as HTMLElement | null;
    if (!layer) return;
    const rect = layer.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const startX = e.clientX;
    const startY = e.clientY;
    // Remember where on the marker it was grabbed. Snapping the pin's tip to the
    // cursor would make it jump by the marker's own height on the first move.
    const tipX = rect.left + (x + w) * rect.width;
    const tipY = rect.top + (y + h) * rect.height;
    const offX = startX - tipX;
    const offY = startY - tipY;

    moved.current = false;
    let latest = { x, y };
    button.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      if (!moved.current && Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD_PX) return;
      moved.current = true;
      const tipFracX = (ev.clientX - offX - rect.left) / rect.width;
      const tipFracY = (ev.clientY - offY - rect.top) / rect.height;
      // The marker sits at a region's bottom-right corner, so the region's own
      // anchor is the tip minus its size — and it may not leave the design.
      latest = {
        x: Math.min(Math.max(0, tipFracX - w), 1 - w),
        y: Math.min(Math.max(0, tipFracY - h), 1 - h),
      };
      setDragAt(latest);
    };

    const up = (ev: PointerEvent) => {
      button.removeEventListener("pointermove", move);
      button.removeEventListener("pointerup", up);
      button.removeEventListener("pointercancel", up);
      if (button.hasPointerCapture(ev.pointerId)) button.releasePointerCapture(ev.pointerId);
      if (moved.current) onMove?.(latest.x, latest.y);
      setDragAt(null);
    };

    button.addEventListener("pointermove", move);
    button.addEventListener("pointerup", up);
    button.addEventListener("pointercancel", up);
  }

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    // A drag ends in a click event too. It was a move, not a request to open.
    if (moved.current) {
      moved.current = false;
      return;
    }
    onClick?.();
  }

  return (
    <>
      {/* A dragged region, revealed only while its pin is selected — or while it
          is being moved, so the person moving it can see what they are placing.
          Left on screen permanently, the dashed boxes read as marks on the design
          itself and confuse whoever is doing the work. */}
      {isArea && (selected || dragAt) && (
        <span
          aria-hidden
          onClick={(e) => { e.stopPropagation(); onClick?.(); }}
          style={{
            left: `${shownX * 100}%`,
            top: `${shownY * 100}%`,
            width: `${w * 100}%`,
            height: `${h * 100}%`,
            borderColor: bg,
            background: "color-mix(in srgb, var(--primary) 12%, transparent)",
          }}
          className="pointer-events-auto absolute cursor-pointer rounded-[3px] border-2 border-dashed transition-colors"
        />
      )}
      <button
        onPointerDown={onPointerDown}
        onClick={handleClick}
        style={{
          left: `${(shownX + (isArea ? w : 0)) * 100}%`,
          top: `${(shownY + (isArea ? h : 0)) * 100}%`,
          background: bg,
          color: fg,
          touchAction: draggable ? "none" : undefined,
        }}
        className={`pointer-events-auto absolute grid h-7 w-7 -translate-x-1/2 -translate-y-full place-items-center rounded-full rounded-bl-none font-mono text-xs font-bold shadow-md ring-2 ${
          dragAt ? "z-20 scale-125 cursor-grabbing" : "transition-transform duration-150 hover:scale-110"
        } ${draggable && !dragAt ? "cursor-grab" : ""} ${selected ? "z-10 scale-110 ring-white" : "ring-white/75"}`}
        aria-label={`Pin ${number}, ${status}${draggable ? ", drag to move" : ""}`}
        title={draggable ? "Click to open · drag to move" : undefined}
      >
        {number}
      </button>
    </>
  );
}
