"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { burstFrom } from "./confetti";

const prefersReduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const Check = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

type ResolveState = { resolved: boolean; touched: boolean };

function applyResolve(
  next: boolean,
  state: React.RefObject<ResolveState>,
  setResolved: (v: boolean) => void,
  btn: HTMLButtonElement | null,
  count?: number,
) {
  state.current.resolved = next;
  setResolved(next);
  if (next) burstFrom(btn, count);
}

/**
 * A reply waiting to be resolved. It resolves itself every few seconds (with
 * the app's confetti) until the visitor clicks it; then it's theirs to toggle.
 */
function Resolve() {
  const [resolved, setResolved] = useState(false);
  const [pressing, setPressing] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const state = useRef<ResolveState>({ resolved: false, touched: false });

  useEffect(() => {
    if (prefersReduced()) return;
    let t = 0;
    const loop = () => {
      if (state.current.touched) return;
      // a visible "click" on the button, then the toggle
      setPressing(true);
      t = window.setTimeout(() => {
        setPressing(false);
        if (state.current.touched) return;
        applyResolve(!state.current.resolved, state, setResolved, btn.current, 40);
        t = window.setTimeout(loop, state.current.resolved ? 3200 : 2600);
      }, 220);
    };
    t = window.setTimeout(loop, 2600);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="lp-hw lp-hw-resolve" data-resolved={resolved || undefined}>
      <p className="lp-hw-who">
        <span className="lp-pin" data-resolved={resolved || undefined}>
          {resolved ? <Check /> : "1"}
        </span>
        <Avatar n={12} />
        <b>Sam</b>
        <span>Designer · 2m</span>
      </p>
      <p className="lp-hw-text">Done, it’s bigger in v2.</p>
      <button
        ref={btn}
        type="button"
        className="lp-hw-resolve-btn"
        data-pressing={pressing || undefined}
        aria-pressed={resolved}
        onClick={() => {
          state.current.touched = true;
          applyResolve(!state.current.resolved, state, setResolved, btn.current);
        }}
      >
        <Check />
        {resolved ? "Resolved" : "Resolve"}
      </button>
    </div>
  );
}

/** A live piece of the product floating beside the hero headline. */
export function HeroWidgets() {
  return (
    <div className="lp-hws">
      <div className="lp-hw-slot lp-hw-slot-resolve" data-depth="0.8">
        <div className="lp-hw-bob">
          <Resolve />
        </div>
      </div>
    </div>
  );
}
