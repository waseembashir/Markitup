"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, ScrollTrigger, useGSAP } from "./gsap";

/** The path's own length, in the units the dash is counted in. */
const DASH = 1000;

/**
 * A wide, soft ribbon behind a section that draws itself as you scroll through
 * it and drifts slightly against the content. The trigger is the nearest
 * <section>, so inside a sticky frame it follows the whole tall section.
 * With reduced motion it is simply shown fully drawn.
 */
export function Ribbon({
  d,
  viewBox = "0 0 1440 900",
  className = "",
  fit = "xMidYMid slice",
  drift = 5,
  end = "bottom 70%",
}: {
  d: string;
  viewBox?: string;
  className?: string;
  fit?: string;
  /** How far it slides against the page, in percent. 0 for a ribbon that spans several sections. */
  drift?: number;
  end?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const svg = ref.current!;
        // A ribbon that runs across several sections is triggered by the run,
        // not by whichever section it happens to sit in.
        const trigger = svg.closest(".lp-flow") ?? svg.closest("section") ?? svg.parentElement!;
        // Drawn straight from the trigger's progress rather than a scrubbed
        // tween: the ribbon is one long path, and this keeps every frame of
        // it on the scroll, so it grows steadily instead of arriving at once.
        // GSAP rounds pixel values, so the dash is counted in 1000ths of the
        // path (pathLength below) rather than in units of 1 — at 1 the offset
        // could only ever be 0 or 1, and the ribbon jumped from nothing to
        // drawn.
        const path = svg.querySelector("path")!;
        gsap.set(path, { strokeDashoffset: DASH });
        const draw = gsap.quickTo(path, "strokeDashoffset", { duration: 0.45, ease: "power2.out" });
        ScrollTrigger.create({
          trigger,
          start: "top 85%",
          end,
          // The run grows as fonts and images land, so measure again on refresh.
          invalidateOnRefresh: true,
          onUpdate: (self) => draw(DASH * (1 - self.progress)),
          onRefresh: (self) => draw(DASH * (1 - self.progress)),
        });
        // Sticky sections inside the run settle late; measure once they have.
        document.fonts.ready.then(() => ScrollTrigger.refresh());
        if (!drift) return;
        gsap.fromTo(
          svg,
          { yPercent: drift },
          {
            yPercent: -drift,
            ease: "none",
            scrollTrigger: { trigger, start: "top bottom", end: "bottom top", scrub: true },
          },
        );
      });
    },
    { scope: ref },
  );

  return (
    <svg ref={ref} className={`lp-ribbon ${className}`} viewBox={viewBox} preserveAspectRatio={fit} aria-hidden>
      <path d={d} pathLength={DASH} />
    </svg>
  );
}
