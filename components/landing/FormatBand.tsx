"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, ScrollTrigger, useGSAP } from "./gsap";

const FORMATS = [
  "PNG & JPG",
  "Live HTML pages",
  "Figma frames",
  "Desktop views",
  "Mobile views",
  "Slack",
  "Email reminders",
];

const Sep = () => (
  <svg className="lp-band-sep" viewBox="0 0 24 28" aria-hidden>
    <path
      d="M12 26.2c-.4 0-.8-.2-1-.5C8.4 22.4 3 16.6 3 11.2a9 9 0 0 1 18 0c0 5.4-5.4 11.2-8 14.5-.2.3-.6.5-1 .5Z"
      fill="var(--lp-lime)"
    />
    <circle cx="12" cy="11" r="3.2" fill="var(--lp-charcoal)" />
  </svg>
);

function Row({ hidden }: { hidden?: boolean }) {
  return (
    <ul className="lp-band-row" aria-hidden={hidden || undefined}>
      {FORMATS.map((f) => (
        <li key={f}>
          <span className="lp-serif">{f}</span>
          <Sep />
        </li>
      ))}
    </ul>
  );
}

/**
 * The dark band under the hero: a marquee of what MarkItUp works with, standing
 * in for a customer-logo strip. It drifts on its own, speeds up with the
 * scroll, and runs backwards while you scroll up.
 */
export function FormatBand() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const loop = gsap.to(".lp-band-track", { xPercent: -50, duration: 42, ease: "none", repeat: -1 });
        // Start far into the loop so it can also run in reverse.
        loop.totalTime(loop.duration() * 500);

        let direction = 1;
        ScrollTrigger.create({
          trigger: root.current,
          start: "top bottom",
          end: "bottom top",
          onUpdate: (self) => {
            direction = self.direction;
            const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 350, 5);
            gsap.to(loop, { timeScale: direction * boost, duration: 0.2, overwrite: true });
            gsap.to(loop, { timeScale: direction, duration: 1.1, delay: 0.2, ease: "power2.out" });
          },
        });

        // The panel settles into place as it rises over the hero.
        gsap.fromTo(
          root.current,
          { scale: 0.96 },
          {
            scale: 1,
            ease: "none",
            scrollTrigger: { trigger: root.current, start: "top bottom", end: "top 55%", scrub: true },
          },
        );
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="lp-band lp-panel-dark lp-on-dark" aria-labelledby="lp-band-title">
      <p id="lp-band-title" className="lp-eyebrow text-center">
        Works with what you make
      </p>
      <div className="lp-band-viewport">
        <div className="lp-band-track">
          <Row />
          <Row hidden />
        </div>
      </div>
    </section>
  );
}
