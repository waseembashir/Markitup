"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, useGSAP } from "./gsap";
import { QUOTES, type Quote } from "./content";
import { Avatar } from "./Avatar";

// Where each card starts and ends its drift across the sticky view, in
// viewport units. Different distances over the same scroll give each card its
// own speed; the slight turn makes them feel tossed rather than slid.
//
// The first two drift right through and out of the top. The last three end
// inside the view (top, middle, lower), so the view is never empty: when the
// section stops sticking they simply scroll away with it.
const PATHS = [
  { from: { x: "7vw", y: "58vh", rotate: -9 }, to: { x: "3vw", y: "-75vh", rotate: -2 } },
  { from: { x: "56vw", y: "92vh", rotate: 7 }, to: { x: "61vw", y: "-60vh", rotate: -4 } },
  { from: { x: "30vw", y: "140vh", rotate: -5 }, to: { x: "33vw", y: "2vh", rotate: 5 } },
  { from: { x: "64vw", y: "185vh", rotate: 9 }, to: { x: "60vw", y: "30vh", rotate: 2 } },
  { from: { x: "10vw", y: "225vh", rotate: 4 }, to: { x: "14vw", y: "52vh", rotate: -5 } },
];

// Phones: the same drift in one column. Cards are 80vw wide there, so they
// only sway a little left and right, and the last three settle overlapping.
const NARROW_PATHS = [
  { from: { x: "4vw", y: "70vh", rotate: -7 }, to: { x: "2vw", y: "-80vh", rotate: -2 } },
  { from: { x: "16vw", y: "110vh", rotate: 6 }, to: { x: "18vw", y: "-65vh", rotate: -3 } },
  { from: { x: "7vw", y: "150vh", rotate: -4 }, to: { x: "9vw", y: "6vh", rotate: 4 } },
  { from: { x: "16vw", y: "195vh", rotate: 7 }, to: { x: "14vw", y: "30vh", rotate: 2 } },
  { from: { x: "4vw", y: "235vh", rotate: 3 }, to: { x: "6vw", y: "52vh", rotate: -4 } },
];

const Check = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden>
    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Card({ q, i }: { q: Quote; i: number }) {
  return (
    <figure className="lp-quote" data-tone={q.tone}>
      <div className="lp-quote-top">
        <span className="lp-pin">{i + 1}</span>
        <Avatar n={q.avatar} />
        <span className="lp-quote-who">
          <b>{q.name}</b>
          <span>{q.role}</span>
        </span>
        <span className="lp-tnum" aria-hidden>
          {i + 2}d
        </span>
      </div>
      <blockquote className="lp-serif">“{q.quote}”</blockquote>
      <figcaption>
        <span className="lp-quote-chip">
          <Check /> Resolved
        </span>
        <span>{i % 2 ? "2 replies" : "1 reply"}</span>
      </figcaption>
    </figure>
  );
}

/**
 * Quotes styled as MarkItUp comments, drifting up through a sticky view at
 * different speeds and turning as they go. Narrow screens and reduced motion
 * get a simple stack.
 */
export function Testimonials() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add({ motion: MOTION_OK, wide: "(min-width: 1024px)" }, (ctx) => {
        const { motion, wide } = ctx.conditions as { motion: boolean; wide: boolean };
        if (!motion) return;
        const paths = wide ? PATHS : NARROW_PATHS;
        const cards = gsap.utils.toArray<HTMLElement>(".lp-quotes-view .lp-quote", root.current);
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: ".lp-quotes-stage", start: "top top", end: "bottom bottom", scrub: 0.6 },
        });
        cards.forEach((card, i) => tl.fromTo(card, paths[i].from, paths[i].to, 0));
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="lp-quotes lp-panel-dark lp-on-dark" aria-labelledby="lp-quotes-title">
      <div className="lp-quotes-head lp-container">
        <p className="lp-eyebrow">What agencies say</p>
        <h2 id="lp-quotes-title" className="lp-serif lp-h2 mt-5">
          Agencies <em>stopped chasing</em> feedback.
        </h2>
      </div>

      {/* Cards drift across a sticky view as you scroll. */}
      <div className="lp-quotes-stage">
        <div className="lp-quotes-view">
          {QUOTES.map((q, i) => (
            <Card key={q.name} q={q} i={i} />
          ))}
        </div>
      </div>

      {/* Reduced motion: a simple stack. */}
      <div className="lp-quotes-list">
        {QUOTES.map((q, i) => (
          <Card key={q.name} q={q} i={i} />
        ))}
      </div>
    </section>
  );
}
