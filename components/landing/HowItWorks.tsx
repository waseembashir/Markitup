"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, useGSAP } from "./gsap";
import { HOW } from "./content";
import { HOW_ICONS } from "./icons";

/**
 * Draws the line work of every hand-drawn icon inside `scope` when it scrolls
 * into view, then pops the lime fills in behind it. Shared by the sections
 * that use the icon set.
 */
export function useDrawIcons(scope: React.RefObject<HTMLElement | null>, itemSelector: string) {
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.utils.toArray<HTMLElement>(itemSelector, scope.current).forEach((item, i) => {
          // Plays once and stays. Not `once: true`: a trigger that kills itself
          // can do so in the middle of a ScrollTrigger refresh (e.g. when the
          // page loads already scrolled past it) and break the refresh loop.
          const tl = gsap.timeline({
            scrollTrigger: { trigger: item, start: "top 82%", toggleActions: "play none none none" },
            delay: (i % 4) * 0.12,
          });
          tl.from(item, { y: 28, opacity: 0, duration: 0.8, ease: "power3.out" })
            .fromTo(
              item.querySelectorAll(".lp-draw"),
              { strokeDasharray: 1, strokeDashoffset: 1 },
              // autoRound off: these paths are one unit long (pathLength="1"),
              // and GSAP would round the offset to 0 or 1 and pop them in.
              { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut", stagger: 0.08, autoRound: false },
              "<0.1",
            )
            .from(
              item.querySelectorAll(".lp-fill"),
              { scale: 0.4, opacity: 0, transformOrigin: "50% 50%", duration: 0.6, ease: "back.out(2)", stagger: 0.06 },
              "<0.35",
            );
        });
      });
    },
    { scope },
  );
}

export function HowItWorks() {
  const root = useRef<HTMLElement>(null);
  useDrawIcons(root, ".lp-how-item");

  return (
    <section ref={root} id="how" className="lp-how" aria-labelledby="lp-how-title">
      <div className="lp-container relative">
        <div className="text-center">
          <p className="lp-eyebrow">How it works</p>
          <h2 id="lp-how-title" className="lp-serif lp-h2 mt-5">
            Three steps. <em>Zero chasing.</em>
          </h2>
        </div>
        <ol className="lp-how-grid">
          {HOW.map((item) => {
            const Icon = HOW_ICONS[item.key];
            return (
              <li key={item.key} className="lp-how-item">
                <Icon className="lp-how-icon" />
                <h3 className="lp-serif lp-h3">{item.title}</h3>
                <p>{item.body}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
