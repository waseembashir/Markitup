"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a CSS media query matches, kept in step with the browser.
 *
 * On the server (and for the first paint, before hydration) it answers false,
 * so a layout built on this renders its wide form and swaps once mounted —
 * rather than mismatching during hydration.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
