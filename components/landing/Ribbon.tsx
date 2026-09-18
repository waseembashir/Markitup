"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, useGSAP } from "./gsap";

/**
 * A wide, soft ribbon behind a section that draws itself as you scroll through
 * it and drifts slightly against the content. The trigger is the nearest
 * <section>, so inside a sticky frame it follows the whole tall section.
 * With reduced motion it is simply shown fully drawn.
 */
export function Ribbon({ d, viewBox = "0 0 1440 900", className = "" }: { d: string; viewBox?: string; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const svg = ref.current!;
        const trigger = svg.closest("section") ?? svg.parentElement!;
        gsap.fromTo(
          svg.querySelector("path"),
          { strokeDashoffset: 1 },
          {
            strokeDashoffset: 0,
            ease: "none",
            scrollTrigger: { trigger, start: "top 80%", end: "bottom 70%", scrub: 0.8 },
          },
        );
        gsap.fromTo(
          svg,
          { yPercent: 5 },
          {
            yPercent: -5,
            ease: "none",
            scrollTrigger: { trigger, start: "top bottom", end: "bottom top", scrub: true },
          },
        );
      });
    },
    { scope: ref },
  );

  return (
    <svg ref={ref} className={`lp-ribbon ${className}`} viewBox={viewBox} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <path d={d} pathLength={1} />
    </svg>
  );
}
