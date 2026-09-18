"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { gsap, MOTION_OK, ScrollTrigger, useGSAP } from "./gsap";
import { Avatar } from "./Avatar";

const FIRST = "Can the logo be a bit bigger?";
const SECOND = "Make this button say Start trial";

const CheckGlyph = () => (
  <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden>
    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * The hero "video": a code-driven loop of MarkItUp at work on a client's page.
 * A cursor pins the logo, a client comment types itself out, a region gets
 * dragged over the button, a designer replies and the first pin resolves.
 *
 * Everything inside is sized in em off a container-relative font size, so the
 * scene scales like footage. Visitors can click the page to drop their own pin.
 */
export function HeroFilm() {
  const root = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const userPaused = useRef(false);
  const resumeTimer = useRef<number | undefined>(undefined);
  const [paused, setPaused] = useState(false);
  const [visitor, setVisitor] = useState<{ x: number; y: number } | null>(null);

  useGSAP(
    () => {
      const build = (motion: boolean) => {
        const q = gsap.utils.selector(root);
        const canvas = q(".lp-film-canvas")[0] as HTMLElement;

        // Where a point of an element sits inside the canvas, in percent.
        // The cursor track is canvas-sized, so its xPercent/yPercent are
        // exactly these numbers.
        const at = (sel: string, fx = 0.5, fy = 0.5) => {
          const c = canvas.getBoundingClientRect();
          const r = (q(sel)[0] as HTMLElement).getBoundingClientRect();
          return {
            xPercent: ((r.left + r.width * fx - c.left) / c.width) * 100,
            yPercent: ((r.top + r.height * fy - c.top) / c.height) * 100,
          };
        };
        const logo = at(".lp-site-logo", 0.55, 0.5);
        const ctaStart = at(".lp-site-cta", -0.12, -0.35);
        const ctaEnd = at(".lp-site-cta", 1.1, 1.35);
        const post1 = at(".lp-pop-1 .lp-pop-post");
        const post2 = at(".lp-pop-2 .lp-pop-post");
        const resolve = at(".lp-thread .lp-thread-resolve");

        const typed1 = q(".lp-pop-1 .lp-pop-text")[0];
        const typed2 = q(".lp-pop-2 .lp-pop-text")[0];
        const type = (el: Element, text: string, duration: number) => {
          const o = { n: 0 };
          return gsap.to(o, {
            n: text.length,
            duration,
            ease: "none",
            onUpdate: () => {
              el.textContent = text.slice(0, Math.round(o.n));
            },
          });
        };
        const clearTyping = () => {
          typed1.textContent = "";
          typed2.textContent = "";
        };

        const popIn = { autoAlpha: 1, scale: 1, y: 0, duration: 0.35, ease: "back.out(1.6)" };
        const popOut = { autoAlpha: 0, scale: 0.96, y: 6, duration: 0.25, ease: "power2.in" };

        gsap.set(q(".lp-film-pin"), { scale: 0, transformOrigin: "0% 100%" });
        gsap.set(q(".lp-pop, .lp-thread"), { autoAlpha: 0, scale: 0.96, y: 6, transformOrigin: "0% 0%" });
        gsap.set(q(".lp-region"), { scale: 0, autoAlpha: 1, transformOrigin: "0% 0%" });
        gsap.set(q(".lp-rail-item"), { autoAlpha: 0, x: 14 });
        gsap.set(q(".lp-rail-reply, .lp-rail-resolved, .lp-thread-reply, .lp-thread-done"), { autoAlpha: 0 });
        gsap.set(q(".lp-thread-typing"), { autoAlpha: 1 });
        gsap.set(q(".lp-film-pin-1 .lp-pin-check"), { autoAlpha: 0 });
        // x/y zeroed so GSAP doesn't read the CSS starting offset as pixels
        // and then add its percentage on top.
        gsap.set(q(".lp-cursor-track"), { x: 0, y: 0, xPercent: 78, yPercent: 108 });
        clearTyping();

        const tl = gsap.timeline({
          repeat: -1,
          repeatDelay: 0.6,
          paused: true,
          defaults: { ease: "power2.inOut" },
          onRepeat: clearTyping,
        });
        const cursor = q(".lp-cursor-track");
        const arrow = q(".lp-cursor");
        const click = () =>
          gsap.timeline().to(arrow, { scale: 0.82, duration: 0.09 }).to(arrow, { scale: 1, duration: 0.16 });

        tl.to(cursor, { ...logo, duration: 1.1 }, 0.3)
          .add(click(), ">")
          .to(q(".lp-film-pin-1"), { scale: 1, duration: 0.5, ease: "back.out(2.4)" }, "<+0.05")
          .to(q(".lp-pop-1"), popIn, "<+0.2")
          .add(type(typed1, FIRST, 1.3), "<+0.25")
          .to(cursor, { ...post1, duration: 0.7 }, "<+0.4")
          .add(click(), ">+0.15")
          .to(q(".lp-pop-1"), popOut, ">+0.05")
          .to(q(".lp-rail-item-1"), { autoAlpha: 1, x: 0, duration: 0.45, ease: "power3.out" }, "<+0.1")

          // Drag a box over the button: comment on an area, not a point.
          .to(cursor, { ...ctaStart, duration: 0.9 }, ">+0.3")
          .add(click(), ">")
          .to(cursor, { ...ctaEnd, duration: 0.8, ease: "power1.inOut" }, ">")
          .to(q(".lp-region"), { scale: 1, duration: 0.8, ease: "power1.inOut" }, "<")
          .to(q(".lp-film-pin-2"), { scale: 1, duration: 0.5, ease: "back.out(2.4)" }, ">")
          .to(q(".lp-pop-2"), popIn, "<+0.15")
          .add(type(typed2, SECOND, 1.3), "<+0.25")
          .to(cursor, { ...post2, duration: 0.7 }, "<+0.3")
          .add(click(), ">+0.15")
          .to(q(".lp-pop-2"), popOut, ">+0.05")
          .to(q(".lp-rail-item-2"), { autoAlpha: 1, x: 0, duration: 0.45, ease: "power3.out" }, "<+0.1")

          // The designer replies on the first pin.
          .to(q(".lp-thread"), popIn, ">+0.4")
          .to(q(".lp-thread-typing"), { autoAlpha: 0, duration: 0.2 }, ">+1")
          .to(q(".lp-thread-reply"), { autoAlpha: 1, duration: 0.3 }, "<")
          .to(q(".lp-rail-item-1 .lp-rail-reply"), { autoAlpha: 1, duration: 0.3 }, "<")

          // Resolve it: the pin turns green.
          .to(cursor, { ...resolve, duration: 0.8 }, ">+0.3")
          .add(click(), ">")
          .to(q(".lp-thread-resolve"), { backgroundColor: "#2f9e62", color: "#ffffff", duration: 0.2 }, "<+0.05")
          .to(
            q(".lp-film-pin-1 .lp-pin, .lp-rail-item-1 .lp-pin"),
            { backgroundColor: "#2f9e62", color: "#ffffff", duration: 0.25 },
            "<",
          )
          .to(q(".lp-film-pin-1 .lp-pin-num"), { autoAlpha: 0, duration: 0.15 }, "<")
          .to(q(".lp-film-pin-1 .lp-pin-check"), { autoAlpha: 1, duration: 0.2 }, "<+0.1")
          .fromTo(
            q(".lp-film-pin-1 .lp-pin"),
            { scale: 1 },
            { scale: 1.25, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out" },
            "<",
          )
          .to(q(".lp-thread-done"), { autoAlpha: 1, duration: 0.25 }, "<+0.2")
          .to(q(".lp-rail-item-1 .lp-rail-resolved"), { autoAlpha: 1, duration: 0.25 }, "<")
          .to(q(".lp-rail-item-1"), { opacity: 0.6, duration: 0.3 }, "<")
          .addLabel("still", ">+0.2")
          .to(q(".lp-thread"), popOut, ">+1.3")
          .to(cursor, { xPercent: 84, yPercent: 110, duration: 0.9 }, "<")

          // Clear the stage so the loop restarts from an empty page.
          .to(
            q(".lp-film-pin, .lp-region, .lp-rail-item"),
            { autoAlpha: 0, duration: 0.45, ease: "power1.in" },
            ">+0.6",
          );

        tlRef.current = tl;

        if (!motion) {
          // Reduced motion: one composed frame, nothing moves.
          tl.seek("still", false);
          gsap.set(q(".lp-thread"), { autoAlpha: 1, scale: 1, y: 0 });
          gsap.set(q(".lp-cursor-track"), { autoAlpha: 0 });
          return;
        }

        // Only play while on screen, and never against the visitor's wishes.
        ScrollTrigger.create({
          trigger: root.current,
          start: "top bottom",
          end: "bottom top",
          onToggle: (self) => {
            if (self.isActive && !userPaused.current) tl.play();
            else tl.pause();
          },
        });

        // The film grows into place as it scrolls up.
        gsap.fromTo(
          q(".lp-film"),
          { scale: 0.88 },
          {
            scale: 1,
            ease: "none",
            scrollTrigger: { trigger: root.current, start: "top 95%", end: "top 30%", scrub: true },
          },
        );
      };

      const mm = gsap.matchMedia();
      // Rebuilt when the layout switches between wide and narrow, because the
      // cursor's targets move.
      mm.add(
        { motion: MOTION_OK, narrow: "(max-width: 759px)" },
        (ctx) => {
          const { motion } = ctx.conditions as { motion: boolean; narrow: boolean };
          let alive = true;
          // The cursor aims at measured positions, so wait for the display font
          // to load and the page to settle into its final metrics.
          document.fonts.ready.then(() => {
            if (alive) ctx.add(() => build(motion));
          });
          return () => {
            alive = false;
            tlRef.current = null;
          };
        },
        root,
      );
    },
    { scope: root },
  );

  useEffect(() => () => window.clearTimeout(resumeTimer.current), []);

  const resume = useCallback(() => {
    window.clearTimeout(resumeTimer.current);
    userPaused.current = false;
    setPaused(false);
    setVisitor(null);
    tlRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    userPaused.current = true;
    setPaused(true);
    tlRef.current?.pause();
  }, []);

  // Drop your own pin: pauses the film, then picks back up on its own.
  const onCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("a, button")) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setVisitor({ x: Math.min(Math.max(x, 3), 97), y: Math.min(Math.max(y, 4), 96) });
    pause();
    window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(resume, 7000);
  };

  return (
    <div ref={root} className="lp-film-wrap lp-container">
      <div className="lp-film">
        <p className="sr-only">
          A short looping demo: a client pins a comment on a website logo, drags a
          box around a button to comment on it, a designer replies, and the first
          comment is resolved and its pin turns green. Click the page to drop your
          own pin.
        </p>

        <div className="lp-film-chrome" aria-hidden>
          <span className="lp-film-dots">
            <i />
            <i />
            <i />
          </span>
          <span className="lp-film-url lp-tnum">markitup.apexure.com/s/fernleaf-home</span>
          <span className="lp-film-people">
            <Avatar n={3} />
            <Avatar n={7} />
            <span className="lp-film-share">Share</span>
          </span>
        </div>

        <div className="lp-film-body">
          <div className="lp-film-canvas" onClick={onCanvasClick}>
            <div className="lp-site" aria-hidden>
              <div className="lp-site-nav">
                <div className="lp-site-logo">
                  <span className="lp-site-wordmark lp-serif">fernleaf</span>
                  <span className="lp-film-pin lp-film-pin-1">
                    <span className="lp-pin">
                      <span className="lp-pin-num">1</span>
                      <span className="lp-pin-check">
                        <CheckGlyph />
                      </span>
                    </span>
                  </span>
                  <div className="lp-pop lp-pop-1">
                    <div className="lp-pop-head">
                      <Avatar n={3} />
                      <b>Priya</b>
                      <span>Client</span>
                    </div>
                    <p className="lp-pop-body">
                      <span className="lp-pop-text" />
                      <span className="lp-caret" />
                    </p>
                    <div className="lp-pop-foot">
                      <span className="lp-pop-post">Post</span>
                    </div>
                  </div>
                  <div className="lp-thread">
                    <div className="lp-pop-head">
                      <Avatar n={3} />
                      <b>Priya</b>
                      <span>Client</span>
                    </div>
                    <p className="lp-thread-text">{FIRST}</p>
                    <div className="lp-thread-rule" />
                    <div className="lp-pop-head">
                      <Avatar n={12} />
                      <b>Sam</b>
                      <span>Designer</span>
                    </div>
                    <p className="lp-thread-text lp-thread-slot">
                      <span className="lp-thread-typing">
                        <i />
                        <i />
                        <i />
                      </span>
                      <span className="lp-thread-reply">Done, it’s bigger in v2.</span>
                    </p>
                    <div className="lp-pop-foot">
                      <span className="lp-thread-done">Resolved</span>
                      <span className="lp-thread-resolve">
                        <CheckGlyph />
                      </span>
                    </div>
                  </div>
                </div>
                <span className="lp-site-links">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="lp-site-shop">Shop</span>
              </div>

              <div className="lp-site-hero">
                <div>
                  <p className="lp-site-h lp-serif">
                    Slow mornings, <em>better coffee.</em>
                  </p>
                  <span className="lp-site-line" style={{ width: "88%" }} />
                  <span className="lp-site-line" style={{ width: "64%" }} />
                  <div className="lp-site-cta">
                    Learn more
                    <span className="lp-region" />
                    <span className="lp-film-pin lp-film-pin-2">
                      <span className="lp-pin">
                        <span className="lp-pin-num">2</span>
                      </span>
                    </span>
                    <div className="lp-pop lp-pop-2">
                      <div className="lp-pop-head">
                        <Avatar n={3} />
                        <b>Priya</b>
                        <span>Client</span>
                      </div>
                      <p className="lp-pop-body">
                        <span className="lp-pop-text" />
                        <span className="lp-caret" />
                      </p>
                      <div className="lp-pop-foot">
                        <span className="lp-pop-post">Post</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="lp-site-img">
                  <span className="lp-site-sun" />
                  <span className="lp-site-cup" />
                  <span className="lp-site-leaf" />
                </div>
              </div>

              <div className="lp-site-row">
                <span />
                <span />
                <span />
              </div>
            </div>

            <div className="lp-cursor-track" aria-hidden>
              <svg className="lp-cursor" viewBox="0 0 24 24">
                <path d="M4 2.5l15.5 9-6.8 1.6-3.4 6.4z" fill="#1c1c17" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </div>

            {visitor && (
              <div
                className="lp-visitor"
                style={{ left: `${visitor.x}%`, top: `${visitor.y}%` }}
                data-flip={visitor.x > 60 || undefined}
                data-up={visitor.y > 62 || undefined}
              >
                <span className="lp-pin lp-visitor-pin">3</span>
                <div className="lp-visitor-pop" role="status">
                  <p>That’s all it takes. Your clients will do exactly this.</p>
                  <Link href="/signup" className="lp-visitor-link">
                    Start free
                  </Link>
                </div>
              </div>
            )}
          </div>

          <aside className="lp-film-rail" aria-hidden>
            <div className="lp-rail-head">
              <b>Comments</b>
              <span className="lp-rail-tabs">
                <span data-on>Open</span>
                <span>Resolved</span>
              </span>
            </div>
            <div className="lp-rail-item lp-rail-item-1">
              <div className="lp-rail-top">
                <span className="lp-pin">1</span>
                <Avatar n={3} />
                <b>Priya</b>
                <span className="lp-tnum">now</span>
              </div>
              <p>{FIRST}</p>
              <div className="lp-rail-meta">
                <span className="lp-rail-reply">
                  <Avatar n={12} /> 1 reply
                </span>
                <span className="lp-rail-resolved">
                  <CheckGlyph /> Resolved
                </span>
              </div>
            </div>
            <div className="lp-rail-item lp-rail-item-2">
              <div className="lp-rail-top">
                <span className="lp-pin">2</span>
                <Avatar n={3} />
                <b>Priya</b>
                <span className="lp-tnum">now</span>
              </div>
              <p>{SECOND}</p>
            </div>
            <div className="lp-rail-empty">
              <span />
              <span />
            </div>
          </aside>
        </div>

        <button
          type="button"
          className="lp-film-toggle"
          aria-pressed={paused}
          aria-label={paused ? "Play the demo" : "Pause the demo"}
          onClick={paused ? resume : pause}
        >
          {paused ? (
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <path d="M5 3.5v9l7.5-4.5z" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <path d="M5 3.5v9M11 3.5v9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
