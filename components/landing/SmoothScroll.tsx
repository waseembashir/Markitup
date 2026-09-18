"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "./gsap";

let instance: Lenis | null = null;

/** Scrolls the page to `y`, through Lenis when it is running. */
export function scrollToY(y: number) {
  if (instance) instance.scrollTo(y);
  else window.scrollTo({ top: y, behavior: "smooth" });
}

// Weighted, smoothed scrolling for the landing page only. Lenis is driven from
// GSAP's ticker so ScrollTrigger reads the same scroll position Lenis paints,
// which keeps scrubbed animations from jittering against the page.
//
// Lenis honours prefers-reduced-motion itself (it stops smoothing and makes
// anchor jumps instant), so there is no separate branch for it here.
export function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.1, anchors: { offset: -96 } });
    instance = lenis;
    lenis.on("scroll", ScrollTrigger.update);

    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
      instance = null;
    };
  }, []);

  return null;
}
