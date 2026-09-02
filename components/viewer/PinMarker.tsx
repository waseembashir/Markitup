"use client";

export function PinMarker({
  number,
  x,
  y,
  w = 0,
  h = 0,
  status,
  selected = false,
  onClick,
}: {
  number: number;
  x: number;
  y: number;
  w?: number;
  h?: number;
  status: "active" | "resolved";
  selected?: boolean;
  onClick?: () => void;
}) {
  const bg = status === "resolved" ? "var(--success)" : "var(--primary)";
  const fg = status === "resolved" ? "#fff" : "var(--primary-foreground)";
  const isArea = w > 0 && h > 0;
  return (
    <>
      {/* A dragged region: dashed outline with the marker pinned to its
          bottom-right, so the badge never covers what is being pointed at. */}
      {isArea && (
        <span
          aria-hidden
          onClick={(e) => { e.stopPropagation(); onClick?.(); }}
          style={{
            left: `${x * 100}%`,
            top: `${y * 100}%`,
            width: `${w * 100}%`,
            height: `${h * 100}%`,
            borderColor: bg,
            background: selected ? "color-mix(in srgb, var(--primary) 12%, transparent)" : "transparent",
          }}
          className="pointer-events-auto absolute cursor-pointer rounded-[3px] border-2 border-dashed transition-colors"
        />
      )}
      <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      style={{
        left: `${(x + (isArea ? w : 0)) * 100}%`,
        top: `${(y + (isArea ? h : 0)) * 100}%`,
        background: bg,
        color: fg,
      }}
      className={`pointer-events-auto absolute grid h-7 w-7 -translate-x-1/2 -translate-y-full place-items-center rounded-full rounded-bl-none font-mono text-xs font-bold shadow-md ring-2 transition-transform duration-150 hover:scale-110 ${
        selected ? "z-10 scale-110 ring-white" : "ring-white/75"
      }`}
      aria-label={`Pin ${number}, ${status}`}
    >
      {number}
    </button>
    </>
  );
}
