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
  { from: { x: "5vw", y: "52vh", rotate: -9 }, to: { x: "2vw", y: "-72vh", rotate: -2 } },
  { from: { x: "52vw", y: "78vh", rotate: 7 }, to: { x: "56vw", y: "-54vh", rotate: -4 } },
  { from: { x: "6vw", y: "108vh", rotate: -5 }, to: { x: "8vw", y: "6vh", rotate: 5 } },
  { from: { x: "54vw", y: "134vh", rotate: 9 }, to: { x: "50vw", y: "24vh", rotate: 2 } },
  { from: { x: "16vw", y: "166vh", rotate: 4 }, to: { x: "18vw", y: "52vh", rotate: -5 } },
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
      mm.add(`${MOTION_OK} and (min-width: 1024px)`, () => {
        const cards = gsap.utils.toArray<HTMLElement>(".lp-quotes-view .lp-quote", root.current);
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: ".lp-quotes-stage", start: "top top", end: "bottom bottom", scrub: 0.6 },
        });
        cards.forEach((card, i) => tl.fromTo(card, PATHS[i].from, PATHS[i].to, 0));
      });

      // Phones: five cards don't fit one sticky screen without covering each
      // other, so they stay a column and each is tossed into place from
      // alternate sides as it scrolls in. GSAP takes over the CSS rotate and
      // translate, so the end values restate the resting tilt from the CSS.
      mm.add(`${MOTION_OK} and (max-width: 1023.98px)`, () => {
        gsap.utils.toArray<HTMLElement>(".lp-quotes-list .lp-quote", root.current).forEach((card, i) => {
          const side = i % 2 ? 1 : -1;
          gsap.fromTo(
            card,
            { x: `${side * 14}vw`, y: 90, rotation: side * 9 },
            {
              x: side > 0 ? 18 : 0,
              y: 0,
              rotation: side * 2,
              ease: "none",
              scrollTrigger: { trigger: card, start: "top bottom", end: "top 62%", scrub: 0.6 },
            },
          );
        });
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

      {/* Wide screens: cards drift across a sticky view as you scroll. */}
      <div className="lp-quotes-stage">
        <div className="lp-quotes-view">
          {QUOTES.map((q, i) => (
            <Card key={q.name} q={q} i={i} />
          ))}
        </div>
      </div>

      {/* Narrow screens and reduced motion: a column of slightly overlapping cards. */}
      <div className="lp-quotes-list">
        {QUOTES.map((q, i) => (
          <Card key={q.name} q={q} i={i} />
        ))}
      </div>
    </section>
  );
}
