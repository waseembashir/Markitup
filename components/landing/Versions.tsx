"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, MOTION_OK, ScrollTrigger, useGSAP } from "./gsap";

const Check = () => (
  <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden>
    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Pins sit on the same spots in both versions: the feedback travels with the file.
const PINS = [
  { n: 1, x: 17, y: 16 },
  { n: 2, x: 30, y: 67 },
  { n: 3, x: 80, y: 38 },
];

function Page({ v }: { v: 1 | 2 }) {
  return (
    <div className={`lp-ver-page lp-ver-v${v}`} aria-hidden>
      <div className="lp-ver-nav">
        <span className="lp-serif lp-ver-logo">fernleaf</span>
        <i />
        <i />
        <i />
        <span className="lp-ver-shop">Shop</span>
      </div>
      <div className="lp-ver-hero">
        <div>
          <p className="lp-serif lp-ver-h">
            Slow mornings, <em>better coffee.</em>
          </p>
          <span className="lp-ver-line" />
          <span className="lp-ver-line" style={{ width: "66%" }} />
          <span className="lp-ver-cta">{v === 1 ? "Learn more" : "Start trial"}</span>
        </div>
        <div className="lp-ver-img">
          <span />
        </div>
      </div>
      {PINS.map((p) => (
        <span
          key={p.n}
          className="lp-pin lp-ver-pin"
          data-resolved={v === 2 || undefined}
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
        >
          {v === 2 ? <Check /> : p.n}
        </span>
      ))}
      <span className="lp-ver-tag lp-tnum">{v === 1 ? "v1 · 3 open" : "v2 · 3 resolved"}</span>
    </div>
  );
}

/**
 * Versions: scrolling wipes v1 into v2 with the pins carried across. Holding
 * Space (or the button) flips back to v1, as it does in the app.
 */
export function Versions() {
  const root = useRef<HTMLElement>(null);
  const inView = useRef(false);
  const [holding, setHolding] = useState(false);

  useGSAP(
    () => {
      ScrollTrigger.create({
        trigger: root.current,
        start: "top bottom",
        end: "bottom top",
        onToggle: (self) => {
          inView.current = self.isActive;
        },
      });

      const mm = gsap.matchMedia();
      mm.add(`${MOTION_OK} and (min-width: 1024px)`, () => {
        gsap.fromTo(
          ".lp-ver-card",
          { "--x": "100%" },
          {
            "--x": "0%",
            ease: "none",
            scrollTrigger: { trigger: ".lp-ver-track", start: "top top", end: "bottom bottom", scrub: 0.4 },
          },
        );
      });
    },
    { scope: root },
  );

  useEffect(() => {
    const typing = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !inView.current || typing(e.target)) return;
      e.preventDefault();
      if (!e.repeat) setHolding(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setHolding(false);
    };
    const blur = () => setHolding(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  return (
    <section ref={root} id="versions" className="lp-ver" aria-labelledby="lp-ver-title">
      <div className="lp-ver-track">
        <div className="lp-ver-frame">
          <div className="lp-ver-grid lp-container">
            <div className="lp-ver-copy">
              <p className="lp-eyebrow">Versions</p>
              <h2 id="lp-ver-title" className="lp-serif lp-h2 mt-5">
                New version. <em>Same conversation.</em>
              </h2>
              <p className="lp-lede mt-6">
                Upload v2 on top of v1 and every comment comes along. Compare the
                two side by side, or flip between them to spot what changed.
              </p>
              <button
                type="button"
                className="lp-ver-hold"
                aria-pressed={holding}
                onPointerDown={() => setHolding(true)}
                onPointerUp={() => setHolding(false)}
                onPointerLeave={() => setHolding(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setHolding(true);
                }}
                onKeyUp={() => setHolding(false)}
              >
                <kbd>Space</kbd>
                <span>{holding ? "Showing v1" : "Hold to see v1"}</span>
              </button>
            </div>

            <div className="lp-ver-card" data-holding={holding || undefined}>
              <div className="lp-ver-chrome" aria-hidden>
                <span className="lp-film-dots">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="lp-ver-switch">
                  <b data-on={holding || undefined}>v1</b>
                  <b data-on={!holding || undefined}>v2</b>
                </span>
              </div>
              <div className="lp-ver-view">
                <Page v={1} />
                <Page v={2} />
                <span className="lp-ver-divider" aria-hidden>
                  <span className="lp-ver-handle">
                    <svg viewBox="0 0 20 12" width="18" height="11" aria-hidden>
                      <path d="M6 1 1 6l5 5M14 1l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
