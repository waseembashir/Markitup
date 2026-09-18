import { celebrate } from "@/lib/confetti";

/**
 * The app's own resolve confetti (lib/confetti.ts), fired from the middle of
 * an element, so the landing page celebrates exactly like the product does.
 * Skipped when the element is off screen; celebrate() itself already skips
 * reduced motion.
 */
export function burstFrom(el: Element | null | undefined, count?: number) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.bottom < 0 || r.top > window.innerHeight || r.width === 0) return;
  celebrate(r.left + r.width / 2, r.top + r.height / 2, count);
}
