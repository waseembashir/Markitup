"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, useGSAP } from "./gsap";

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
        gsap.fromTo(
          svg.querySelector("path"),
          { strokeDashoffset: 1 },
          {
            strokeDashoffset: 0,
            ease: "none",
            scrollTrigger: { trigger, start: "top 85%", end, scrub: 0.8 },
          },
        );
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
      <path d={d} pathLength={1} />
    </svg>
  );
}
