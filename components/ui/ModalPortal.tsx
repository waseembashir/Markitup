"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// The hydration flag never changes after mount, so there is nothing to subscribe to.
const subscribeNever = () => () => {};

// Render modal content at the document root so `position: fixed` is relative to
// the viewport — not trapped/clipped by an ancestor card's transform/overflow.
export function ModalPortal({ children }: { children: React.ReactNode }) {
  // `false` on the server, `true` once hydrated — the same guard as the old
  // mount flag, but without a setState-in-effect and its extra render.
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
