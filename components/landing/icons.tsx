// Hand-drawn duo-tone icons: thick ink strokes with round ends over lime-filled
// shapes. Stroke paths carry `pathLength="1"` and the `lp-draw` class so they
// can be drawn in with a single dashoffset tween; lime shapes carry `lp-fill`
// so they can pop in after the line work.
//
// Each icon also has a small looping animation once it is on screen: the
// moving parts are wrapped in `lp-i-*` groups (animated in CSS), so the loop
// never fights the scroll-driven draw-in, which animates the children.

type IconProps = { className?: string };

const INK = "var(--lp-ink)";
const LIME = "var(--lp-lime)";

const stroke = {
  fill: "none",
  stroke: INK,
  strokeWidth: 3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  pathLength: 1,
  className: "lp-draw",
};

// A CSS custom property for staggering a loop.
const n = (i: number) => ({ "--n": i }) as React.CSSProperties;
// Where a group turns or scales from, in viewBox units.
const origin = (x: number, y: number) => ({ transformOrigin: `${x}px ${y}px` });

export function Mark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 28" className={`lp-mark ${className ?? ""}`} aria-hidden>
      <g className="lp-mark-pin">
        <path
          d="M12 26.2c-.4 0-.8-.2-1-.5C8.4 22.4 3 16.6 3 11.2a9 9 0 0 1 18 0c0 5.4-5.4 11.2-8 14.5-.2.3-.6.5-1 .5Z"
          fill={LIME}
          stroke={INK}
          strokeWidth="1.8"
        />
        <circle className="lp-mark-dot" cx="12" cy="11" r="3.2" fill={INK} />
      </g>
    </svg>
  );
}

/** Three lime tiles (image, code, frame) hopping under a looping arrow. */
export function IconUpload({ className }: IconProps) {
  return (
    <svg viewBox="0 0 160 112" className={className} aria-hidden>
      <g className="lp-i-hop" style={n(0)}>
        <rect className="lp-fill" x="18" y="56" width="36" height="36" rx="10" fill={LIME} />
        <path {...stroke} strokeWidth={2.6} d="M26 84 l7-9 5 6 4-4 6 7" />
        <circle cx="44" cy="66" r="2.6" fill={INK} />
      </g>
      <g className="lp-i-hop" style={n(1)}>
        <rect className="lp-fill" x="62" y="56" width="36" height="36" rx="10" fill={LIME} />
        <path {...stroke} strokeWidth={2.6} d="M74 68 l-6 6 6 6 M86 68 l6 6 -6 6 M82 64 l-4 20" />
      </g>
      <g className="lp-i-hop" style={n(2)}>
        <rect className="lp-fill" x="106" y="56" width="36" height="36" rx="10" fill={LIME} />
        <path
          {...stroke}
          strokeWidth={2.6}
          d="M114 70 v-6 h6 M134 70 v-6 h-6 M114 78 v6 h6 M134 78 v6 h-6"
        />
      </g>
      <g className="lp-i-float">
        <path {...stroke} d="M34 48 C 36 22, 62 16, 74 38 C 84 18, 114 14, 124 44" />
        <path {...stroke} d="M116 38 L124.5 45.5 L130 35" />
      </g>
    </svg>
  );
}

/** A wiggling link tile, an arrow that keeps nudging, and two people. */
export function IconShare({ className }: IconProps) {
  return (
    <svg viewBox="0 0 160 112" className={className} aria-hidden>
      <g className="lp-i-wiggle" style={origin(40, 56)}>
        <rect className="lp-fill" x="10" y="30" width="60" height="52" rx="16" fill={LIME} />
        <path
          {...stroke}
          strokeWidth={2.8}
          d="M37 61 l-3.5 3.5 a6.5 6.5 0 0 1 -9.2 -9.2 l6 -6 a6.5 6.5 0 0 1 9.2 0"
        />
        <path
          {...stroke}
          strokeWidth={2.8}
          d="M43 51 l3.5 -3.5 a6.5 6.5 0 0 1 9.2 9.2 l-6 6 a6.5 6.5 0 0 1 -9.2 0"
        />
      </g>
      <g className="lp-i-nudge">
        <path {...stroke} d="M78 58 C 84 52, 90 60, 98 55" />
        <path {...stroke} d="M92 49 L99 55 L91.5 60" />
      </g>
      <rect {...stroke} x="104" y="28" width="48" height="56" rx="15" fill="var(--lp-cream)" />
      <g className="lp-i-float" style={n(0)}>
        <circle className="lp-fill" cx="121" cy="49" r="6" fill={LIME} />
        <circle {...stroke} strokeWidth={2.6} cx="121" cy="49" r="6" />
        <path {...stroke} strokeWidth={2.6} d="M111 72 c0 -7 4.5 -11 10 -11 s10 4 10 11" />
      </g>
      <g className="lp-i-float" style={n(2)}>
        <circle className="lp-fill" cx="137" cy="47" r="5" fill={LIME} />
        <circle {...stroke} strokeWidth={2.6} cx="137" cy="47" r="5" />
        <path {...stroke} strokeWidth={2.6} d="M133 60 c5 -1 11 2 11 10" />
      </g>
    </svg>
  );
}

/** A lime map pin with a tick, inside a circular arrow that keeps turning. */
export function IconLoop({ className }: IconProps) {
  return (
    <svg viewBox="0 0 160 112" className={className} aria-hidden>
      <g className="lp-i-float">
        <path
          className="lp-fill"
          d="M80 84 C 71 73, 63 65, 63 54 a17 17 0 0 1 34 0 c0 11 -8 19 -17 30 Z"
          fill={LIME}
        />
        <path {...stroke} d="M80 84 C 71 73, 63 65, 63 54 a17 17 0 0 1 34 0 c0 11 -8 19 -17 30 Z" />
        <path {...stroke} d="M72.5 53 l5.5 5.5 10 -10" />
      </g>
      <g className="lp-i-spin" style={origin(80, 56)}>
        <path {...stroke} d="M101 19.6 A 42 42 0 1 1 65.6 16.5" />
        <path {...stroke} d="M56.9 14.1 L65.6 16.5 L60.4 23.9" />
      </g>
    </svg>
  );
}

/** An envelope with a small clock whose hand keeps going round. */
export function IconReminder({ className }: IconProps) {
  return (
    <svg viewBox="0 0 96 80" className={className} aria-hidden>
      <g className="lp-i-float">
        <rect className="lp-fill" x="8" y="18" width="58" height="42" rx="10" fill={LIME} />
        <rect {...stroke} strokeWidth={2.6} x="8" y="18" width="58" height="42" rx="10" />
        <path {...stroke} strokeWidth={2.6} d="M12 24 l25 19 25 -19" />
      </g>
      <circle {...stroke} strokeWidth={2.6} cx="70" cy="56" r="15" fill="var(--lp-cream)" />
      <path {...stroke} strokeWidth={2.6} d="M70 56.5 l5 3.5" />
      <g className="lp-i-tick" style={origin(70, 56.5)}>
        <path {...stroke} strokeWidth={2.6} d="M70 56.5 V47.5" />
      </g>
    </svg>
  );
}

/** Two chat bubbles taking turns to speak. */
export function IconSlack({ className }: IconProps) {
  return (
    <svg viewBox="0 0 96 80" className={className} aria-hidden>
      <g className="lp-i-pop" style={{ ...n(1), ...origin(64, 34) }}>
        <path {...stroke} strokeWidth={2.6} d="M40 14 h38 a10 10 0 0 1 10 10 v16 a10 10 0 0 1 -10 10 h-4 v8 l-9 -8" />
      </g>
      <g className="lp-i-pop" style={{ ...n(0), ...origin(34, 50) }}>
        <path
          className="lp-fill"
          d="M16 28 h40 a10 10 0 0 1 10 10 v16 a10 10 0 0 1 -10 10 h-26 l-10 9 v-9 a10 10 0 0 1 -14 -10 v-16 a10 10 0 0 1 10 -10 Z"
          fill={LIME}
        />
        <path
          {...stroke}
          strokeWidth={2.6}
          d="M16 28 h40 a10 10 0 0 1 10 10 v16 a10 10 0 0 1 -10 10 h-26 l-10 9 v-9 a10 10 0 0 1 -14 -10 v-16 a10 10 0 0 1 10 -10 Z"
        />
        <path {...stroke} strokeWidth={2.4} d="M30 40 l-3 16 M40 40 l-3 16 M24 45 h19 M23 51 h19" />
      </g>
    </svg>
  );
}

/** A person on a lime badge, with a padlock that keeps clicking shut. */
export function IconRoles({ className }: IconProps) {
  return (
    <svg viewBox="0 0 96 80" className={className} aria-hidden>
      <rect className="lp-fill" x="10" y="12" width="52" height="58" rx="14" fill={LIME} />
      <rect {...stroke} strokeWidth={2.6} x="10" y="12" width="52" height="58" rx="14" />
      <g className="lp-i-float" style={n(1)}>
        <circle {...stroke} strokeWidth={2.6} cx="36" cy="34" r="8" />
        <path {...stroke} strokeWidth={2.6} d="M22 60 c0 -9 6 -14 14 -14 s14 5 14 14" />
      </g>
      <g className="lp-i-latch">
        <path {...stroke} strokeWidth={2.6} d="M65 44 v-5 a8 8 0 0 1 16 0 v5" />
      </g>
      <rect {...stroke} strokeWidth={2.6} x="60" y="44" width="26" height="22" rx="6" fill="var(--lp-cream)" />
      <circle cx="73" cy="55" r="2.4" fill={INK} />
    </svg>
  );
}

/** Frame corners breathing around a lime tile with a bouncing pin. */
export function IconFigma({ className }: IconProps) {
  return (
    <svg viewBox="0 0 96 80" className={className} aria-hidden>
      <rect className="lp-fill" x="22" y="16" width="52" height="48" rx="10" fill={LIME} />
      <g className="lp-i-breathe" style={origin(48, 40)}>
        <path
          {...stroke}
          strokeWidth={2.6}
          d="M12 22 v-10 h10 M84 22 v-10 h-10 M12 58 v10 h10 M84 58 v10 h-10"
        />
      </g>
      <g className="lp-i-bounce">
        <path
          {...stroke}
          strokeWidth={2.6}
          d="M48 54 c-5 -6 -9 -10 -9 -15 a9 9 0 0 1 18 0 c0 5 -4 9 -9 15 Z"
          fill="var(--lp-cream)"
        />
        <circle cx="48" cy="39" r="2.6" fill={INK} />
      </g>
    </svg>
  );
}

export const HOW_ICONS = { upload: IconUpload, share: IconShare, loop: IconLoop } as const;
export const EXTRA_ICONS = {
  reminder: IconReminder,
  slack: IconSlack,
  roles: IconRoles,
  figma: IconFigma,
} as const;
