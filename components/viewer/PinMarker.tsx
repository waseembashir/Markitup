"use client";

export function PinMarker({
  number,
  x,
  y,
  status,
  selected = false,
  onClick,
}: {
  number: number;
  x: number;
  y: number;
  status: "active" | "resolved";
  selected?: boolean;
  onClick?: () => void;
}) {
  const bg = status === "resolved" ? "var(--success)" : "var(--primary)";
  const fg = status === "resolved" ? "#fff" : "var(--primary-foreground)";
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, background: bg, color: fg }}
      className={`pointer-events-auto absolute grid h-7 w-7 -translate-x-1/2 -translate-y-full place-items-center rounded-full rounded-bl-none font-mono text-xs font-bold shadow-md ring-2 transition-transform duration-150 hover:scale-110 ${
        selected ? "z-10 scale-110 ring-white" : "ring-white/75"
      }`}
      aria-label={`Pin ${number}, ${status}`}
    >
      {number}
    </button>
  );
}
