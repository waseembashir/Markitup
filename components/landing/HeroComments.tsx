"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, MOTION_OK, useGSAP } from "./gsap";
import { Avatar } from "./Avatar";
import { burstFrom } from "./confetti";

// Positions are percentages of the hero stage, so comments stay put when the
// window is resized.
type Box = { x: number; y: number; w: number; h: number };
type Note = Box & { id: number; n: number; text: string };

const DEMO_TEXT = "Could this line be a little bigger?";
// A press that moves less than this is a point comment, not an area.
const DRAG_THRESHOLD = 6;
// Anything that already does something on click keeps doing it.
const IGNORE = "a, button, input, textarea, label, .lp-hw, .lp-hc-composer, .lp-hc-note";
// --lp-resolved, as a value GSAP can tween to.
const RESOLVED = "#2f9e62";

const Check = () => (
  <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden>
    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Makes the whole hero commentable, the way a design is in the app: click to
 * drop a pin, or drag to mark an area, then write the comment. Until the
 * visitor tries it, a loop shows how: an area is dragged over the headline and
 * a comment is typed on it.
 */
export function HeroComments() {
  const root = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"demo" | "user">("demo");
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [draft, setDraft] = useState<Box | null>(null);
  const [text, setText] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const input = useRef<HTMLInputElement>(null);
  // The demo's comment is pin 1; the visitor's follow on from there.
  const nextN = (notes.at(-1)?.n ?? 1) + 1;

  // --- The visitor's own comments --------------------------------------------
  useEffect(() => {
    const stage = root.current?.parentElement;
    if (!stage) return;
    let start: { x: number; y: number; px: number; py: number } | null = null;

    const pct = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as Element).closest(IGNORE)) return;
      e.preventDefault(); // no text selection while dragging an area
      setMode("user");
      setDraft(null);
      setText("");
      const p = pct(e);
      start = { ...p, px: e.clientX, py: e.clientY };
      setMarquee({ x: p.x, y: p.y, w: 0, h: 0 });
    };
    const move = (e: PointerEvent) => {
      if (!start) return;
      const p = pct(e);
      setMarquee({
        x: Math.min(start.x, p.x),
        y: Math.min(start.y, p.y),
        w: Math.abs(p.x - start.x),
        h: Math.abs(p.y - start.y),
      });
    };
    const up = (e: PointerEvent) => {
      if (!start) return;
      const moved = Math.hypot(e.clientX - start.px, e.clientY - start.py) > DRAG_THRESHOLD;
      const p = pct(e);
      setDraft(
        moved
          ? { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) }
          : { x: start.x, y: start.y, w: 0, h: 0 },
      );
      setMarquee(null);
      start = null;
    };
    const cancel = () => {
      start = null;
      setMarquee(null);
    };

    stage.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      stage.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, []);

  useEffect(() => {
    if (draft) input.current?.focus({ preventScroll: true });
  }, [draft]);

  const post = () => {
    const value = text.trim();
    if (!draft || !value) return;
    setNotes((list) => [...list, { ...draft, id: Date.now(), n: nextN, text: value }].slice(-6));
    setDraft(null);
    setText("");
  };

  // --- The demo loop ----------------------------------------------------------
  useGSAP(
    () => {
      if (mode !== "demo") return;
      const stage = root.current!.parentElement!;
      const line = stage.querySelector("h1 > span");
      const mm = gsap.matchMedia();

      // Narrow screens have no margin beside the headline, so the comment opens
      // above it, to the left of the pin (see [data-narrow] in hero.css).
      mm.add({ motion: MOTION_OK, wide: "(min-width: 1024px)" }, (ctx) => {
        const { motion, wide } = ctx.conditions as { motion: boolean; wide: boolean };
        if (!motion) return;
        let tl: gsap.core.Timeline | null = null;

        const build = () => {
          tl?.kill();
          if (!line) return;
          // The area to mark: the first headline line, as the text sits.
          const range = document.createRange();
          range.selectNodeContents(line);
          const t = range.getBoundingClientRect();
          const s = stage.getBoundingClientRect();
          const box = { left: t.left - s.left - 16, top: t.top - s.top - 6, width: t.width + 32, height: t.height + 10 };

          const q = gsap.utils.selector(root);
          const typed = q(".lp-hc-demo-text")[0] as HTMLElement;
          const anchor = q(".lp-hc-demo-anchor")[0] as HTMLElement;
          anchor.toggleAttribute("data-narrow", !wide);
          gsap.set(q(".lp-hc-demo-box"), { ...box, scale: 0, opacity: 1, transformOrigin: "0 0" });
          gsap.set(
            anchor,
            wide
              ? { left: box.left + box.width, top: box.top + box.height }
              : // the pin stands on the box's top edge, clear of the screen's side
                { left: box.left + box.width - 44, top: box.top },
          );
          gsap.set(q(".lp-hc-demo-pin"), { scale: 0 });
          gsap.set(q(".lp-hc-demo-composer, .lp-hc-demo-posted"), { opacity: 0, y: 8 });
          gsap.set(q(".lp-hc-demo-cursor"), { x: wide ? box.left - 70 : box.left + 20, y: box.top + box.height + 60, opacity: 0, scale: 1 });
          typed.textContent = "";

          const cursor = q(".lp-hc-demo-cursor");
          const o = { n: 0 };
          tl = gsap
            .timeline({ repeat: -1, repeatDelay: 1.2, delay: 1.2, defaults: { ease: "power2.inOut" }, onRepeat: () => (typed.textContent = "") })
            .to(cursor, { opacity: 1, duration: 0.3 })
            .to(cursor, { x: box.left, y: box.top, duration: 0.9 }, "<")
            .to(cursor, { scale: 0.85, duration: 0.1 })
            .to(cursor, { x: box.left + box.width, y: box.top + box.height, duration: 1, ease: "power1.inOut" })
            .to(q(".lp-hc-demo-box"), { scale: 1, duration: 1, ease: "power1.inOut" }, "<")
            .to(cursor, { scale: 1, duration: 0.1 })
            .to(cursor, { x: `+=${40}`, y: `+=${46}`, opacity: 0, duration: 0.5 }, ">0.1")
            .to(q(".lp-hc-demo-pin"), { scale: 1, duration: 0.45, ease: "back.out(2.4)" }, "<")
            .to(q(".lp-hc-demo-composer"), { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }, "<0.1")
            .fromTo(
              o,
              { n: 0 },
              {
                n: DEMO_TEXT.length,
                duration: 1.6,
                ease: "none",
                onUpdate: () => (typed.textContent = DEMO_TEXT.slice(0, Math.round(o.n))),
              },
              ">0.1",
            )
            .to(q(".lp-hc-demo-post"), { scale: 0.9, duration: 0.1, yoyo: true, repeat: 1 }, ">0.3")
            .to(q(".lp-hc-demo-composer"), { opacity: 0, y: 8, duration: 0.25 }, ">")
            .to(q(".lp-hc-demo-posted"), { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }, "<0.1");

          if (!wide) {
            // Narrow screens: the cursor comes back and resolves the comment,
            // so the one card tells the whole story. Measured while the card
            // still sits 8px low, before it rises into place.
            const btn = q(".lp-hc-demo-resolve")[0] as HTMLElement;
            const r = btn.getBoundingClientRect();
            const at = { x: r.left - s.left + r.width * 0.4, y: r.top - s.top + r.height * 0.5 - 8 };
            const pin = q(".lp-hc-demo-pin");
            tl.set(cursor, { x: at.x + 36, y: at.y + 60, scale: 1 }, ">0.5")
              .to(cursor, { opacity: 1, x: at.x, y: at.y, duration: 0.7 })
              .to(cursor, { scale: 0.85, duration: 0.1 })
              .to(btn, { backgroundColor: RESOLVED, boxShadow: `inset 0 0 0 1.5px ${RESOLVED}`, duration: 0.2 }, "<")
              .to(q(".lp-hc-demo-resolve-off"), { opacity: 0, duration: 0.15 }, "<")
              .to(q(".lp-hc-demo-resolve-on"), { opacity: 1, duration: 0.15 }, "<")
              .to(pin, { backgroundColor: RESOLVED, color: "#fff", duration: 0.25 }, "<")
              .to(q(".lp-hc-demo-num"), { opacity: 0, duration: 0.15 }, "<")
              .to(q(".lp-hc-demo-check"), { opacity: 1, duration: 0.15 }, "<")
              .call(() => burstFrom(pin[0], 30), [], "<")
              .to(cursor, { scale: 1, duration: 0.1 })
              .to(cursor, { x: `+=${40}`, y: `+=${46}`, opacity: 0, duration: 0.5 }, ">0.2");
          }

          tl.to(q(".lp-hc-demo-box, .lp-hc-demo-pin, .lp-hc-demo-posted"), { opacity: 0, duration: 0.5 }, wide ? ">2.4" : ">1.2")
            .set(q(".lp-hc-demo-box"), { scale: 0, opacity: 1 })
            .set(q(".lp-hc-demo-pin"), { scale: 0, opacity: 1, clearProps: "backgroundColor,color" })
            .set(q(".lp-hc-demo-posted"), { y: 8 })
            .set(q(".lp-hc-demo-resolve"), { clearProps: "backgroundColor,boxShadow" })
            .set(q(".lp-hc-demo-num, .lp-hc-demo-resolve-off"), { opacity: 1 })
            .set(q(".lp-hc-demo-check, .lp-hc-demo-resolve-on"), { opacity: 0 });
        };

        // Measure once the display font is in, and again if the layout changes.
        document.fonts.ready.then(build);
        const ro = new ResizeObserver(() => build());
        ro.observe(stage);
        return () => {
          ro.disconnect();
          tl?.kill();
        };
      });
    },
    // Revert on change: once the visitor takes over, the loop is torn down.
    { scope: root, dependencies: [mode], revertOnUpdate: true },
  );

  // --- The cursor label ------------------------------------------------------
  useGSAP(
    () => {
      const stage = root.current!.parentElement!;
      const label = root.current!.querySelector<HTMLElement>(".lp-hc-hint")!;
      const mm = gsap.matchMedia();
      mm.add("(pointer: fine)", () => {
        const x = gsap.quickTo(label, "x", { duration: 0.25, ease: "power3.out" });
        const y = gsap.quickTo(label, "y", { duration: 0.25, ease: "power3.out" });
        const move = (e: PointerEvent) => {
          const r = stage.getBoundingClientRect();
          x(e.clientX - r.left + 18);
          y(e.clientY - r.top + 18);
          label.dataset.on = (e.target as Element).closest(IGNORE) ? "false" : "true";
        };
        const leave = () => (label.dataset.on = "false");
        stage.addEventListener("pointermove", move);
        stage.addEventListener("pointerleave", leave);
        return () => {
          stage.removeEventListener("pointermove", move);
          stage.removeEventListener("pointerleave", leave);
        };
      });
    },
    { scope: root },
  );

  const at = (b: Box) => ({ left: `${b.x + b.w}%`, top: `${b.y + b.h}%` });
  const flip = (b: Box) => ({ left: b.x + b.w > 68, up: b.y + b.h > 62 });

  return (
    <div ref={root} className="lp-hc" aria-live="polite">
      {/* demo */}
      {mode === "demo" && (
        <div className="lp-hc-demo" aria-hidden>
          <span className="lp-hc-box lp-hc-demo-box" />
          <div className="lp-hc-demo-anchor">
            <span className="lp-pin lp-hc-pin lp-hc-demo-pin">
              <span className="lp-hc-demo-num">1</span>
              <span className="lp-hc-demo-check">
                <Check />
              </span>
            </span>
            <div className="lp-hc-card lp-hc-demo-composer">
              <p className="lp-hc-who">
                <Avatar n={3} /> <b>Emma</b> <span>Client</span>
              </p>
              <div className="lp-hc-field">
                <span className="lp-hc-input">
                  <span className="lp-hc-demo-text" />
                  <i className="lp-hc-caret" />
                </span>
                <span className="lp-hc-post lp-hc-demo-post">Post</span>
              </div>
            </div>
            <div className="lp-hc-card lp-hc-demo-posted">
              <p className="lp-hc-who">
                <Avatar n={3} /> <b>Emma</b> <span className="lp-hc-demo-when">just now</span>
                {/* narrow screens only: the loop resolves the comment */}
                <span className="lp-hc-demo-resolve">
                  <span className="lp-hc-demo-resolve-off">
                    <Check /> Resolve
                  </span>
                  <span className="lp-hc-demo-resolve-on">
                    <Check /> Resolved
                  </span>
                </span>
              </p>
              <p className="lp-hc-text">{DEMO_TEXT}</p>
            </div>
          </div>
          <svg className="lp-hc-demo-cursor" viewBox="0 0 24 24">
            <path d="M4 2.5l15.5 9-6.8 1.6-3.4 6.4z" fill="#1c1c17" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {/* the visitor's comments */}
      {notes.map((note, i) => {
        const f = flip(note);
        return (
          <div key={note.id}>
            {note.w > 0 && (
              <span
                className="lp-hc-box lp-hc-saved"
                style={{ left: `${note.x}%`, top: `${note.y}%`, width: `${note.w}%`, height: `${note.h}%` }}
              />
            )}
            <div
              className="lp-hc-note"
              style={at(note)}
              data-left={f.left || undefined}
              data-up={f.up || undefined}
              data-latest={i === notes.length - 1 || undefined}
            >
              <span className="lp-pin lp-hc-pin" tabIndex={0} aria-label={`Comment ${note.n}: ${note.text}`}>
                {note.n}
              </span>
              <div className="lp-hc-card lp-hc-note-card">
                <p className="lp-hc-who">
                  <Avatar n={9} /> <b>You</b> <span>just now</span>
                </p>
                <p className="lp-hc-text">{note.text}</p>
              </div>
            </div>
          </div>
        );
      })}

      {marquee && marquee.w + marquee.h > 0 && (
        <span
          className="lp-hc-box lp-hc-live"
          style={{ left: `${marquee.x}%`, top: `${marquee.y}%`, width: `${marquee.w}%`, height: `${marquee.h}%` }}
        />
      )}

      {draft && (
        <>
          {draft.w > 0 && (
            <span
              className="lp-hc-box lp-hc-live"
              style={{ left: `${draft.x}%`, top: `${draft.y}%`, width: `${draft.w}%`, height: `${draft.h}%` }}
            />
          )}
          <div
            className="lp-hc-note lp-hc-composer"
            style={at(draft)}
            data-left={flip(draft).left || undefined}
            data-up={flip(draft).up || undefined}
          >
            <span className="lp-pin lp-hc-pin">{nextN}</span>
            <form
              className="lp-hc-card"
              onSubmit={(e) => {
                e.preventDefault();
                post();
              }}
            >
              <p className="lp-hc-who">
                <Avatar n={9} /> <b>You</b> <span>{draft.w > 0 ? "on this area" : "right here"}</span>
              </p>
              <div className="lp-hc-field">
                <input
                  ref={input}
                  aria-label="Your comment"
                  placeholder="Leave a comment…"
                  value={text}
                  maxLength={90}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setDraft(null);
                  }}
                />
                <button type="submit" className="lp-hc-post" disabled={!text.trim()}>
                  Post
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      <span className="lp-hc-hint" aria-hidden>
        {mode === "demo" ? "Click or drag to comment" : "Click or drag again"}
      </span>
    </div>
  );
}
