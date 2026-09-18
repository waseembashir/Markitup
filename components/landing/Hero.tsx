"use client";

import Link from "next/link";
import { useRef } from "react";
import { gsap, MOTION_OK, useGSAP } from "./gsap";
import { HeroFilm } from "./HeroFilm";
import { HeroWidgets } from "./HeroWidgets";
import { HeroComments } from "./HeroComments";

// Splits a line into words that rise into place (CSS only, see .lp-word).
function Words({ text, from }: { text: string; from: number }) {
  const words = text.split(" ");
  return words.map((w, i) => (
    <span key={i}>
      <span className="lp-word">
        <span style={{ "--i": from + i } as React.CSSProperties}>{w}</span>
      </span>
      {i < words.length - 1 ? " " : null}
    </span>
  ));
}

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      // The live widgets float away as the page scrolls on to the demo.
      mm.add(MOTION_OK, () => {
        gsap.utils.toArray<HTMLElement>(".lp-hw-slot", root.current).forEach((el) => {
          const depth = Number(el.dataset.depth);
          gsap.to(el, {
            y: -220 * depth - 40,
            opacity: 0,
            ease: "none",
            scrollTrigger: { trigger: root.current, start: "top top", end: "45% top", scrub: true },
          });
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="top" className="lp-hero">
      <div className="lp-hero-stage">
        <HeroWidgets />

        <div className="lp-container relative text-center">
          <h1 className="lp-serif lp-display">
            <span className="block">
              <Words text="Don’t explain it." from={0} />
            </span>{" "}
            <span className="block">
              <em>
                <Words text="Pin it." from={3} />
              </em>
            </span>
          </h1>
          <p className="lp-lede lp-fade-in mx-auto mt-7 max-w-[41rem]" style={{ "--d": "520ms" } as React.CSSProperties}>
            Clients click anywhere on your design to leave a comment. Every note
            lands exactly where it belongs.
          </p>
          <div
            className="lp-fade-in mt-9 flex flex-wrap items-center justify-center gap-3"
            style={{ "--d": "640ms" } as React.CSSProperties}
          >
            <Link href="/signup" className="lp-btn lp-btn-primary">
              Start free
              <svg className="lp-arrow" width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                <path d="M3 8h9.5M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <a href="#how" className="lp-btn lp-btn-ghost">
              See how it works
            </a>
          </div>
          <p className="lp-fade-in mt-4 text-sm text-(--lp-muted)" style={{ "--d": "760ms" } as React.CSSProperties}>
            Clients never need an account.
          </p>
        </div>

        <HeroComments />
      </div>

      <HeroFilm />
    </section>
  );
}
