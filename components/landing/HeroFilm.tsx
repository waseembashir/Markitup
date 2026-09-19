"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { gsap, MOTION_OK, ScrollTrigger, useGSAP } from "./gsap";
import { Avatar } from "./Avatar";
import { burstFrom } from "./confetti";

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
      const build = (motion: boolean, narrow: boolean) => {
        const q = gsap.utils.selector(root);
        const film = q(".lp-film")[0] as HTMLElement;
        const site = q(".lp-site")[0] as HTMLElement;

        // Where a point of an element sits inside the film, in percent. The
        // cursor track is film-sized, so its xPercent/yPercent are exactly
        // these numbers.
        const at = (sel: string, fx = 0.5, fy = 0.5) => {
          const c = film.getBoundingClientRect();
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
        const shareBtn = at(".lp-film-share");
        const copyBtn = at(".lp-share-pop-copy");
        const viewMobile = at(".lp-view-m");
        const viewDesktop = at(".lp-view-d");
        const railResolve = narrow ? null : at(".lp-rail-resolve");
        const viewD = q(".lp-view-d")[0] as HTMLElement;
        const viewM = q(".lp-view-m")[0] as HTMLElement;
        const tabOpen = q(".lp-tab-open")[0] as HTMLElement;
        const tabDone = q(".lp-tab-done")[0] as HTMLElement;
        const on = (el: HTMLElement, yes: boolean) => (yes ? el.setAttribute("data-on", "") : el.removeAttribute("data-on"));
        // Everything the loop changes by attribute rather than by tween, put
        // back at the top of every pass.
        const reset = () => {
          site.removeAttribute("data-view");
          on(viewD, true);
          on(viewM, false);
          on(tabOpen, true);
          on(tabDone, false);
        };

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
        gsap.set(q(".lp-share-pop"), { autoAlpha: 0, y: 8, scale: 0.97, transformOrigin: "100% 0%" });
        gsap.set(q(".lp-copy-done, .lp-cta-v2, .lp-film-ver, .lp-rail-resolved-2, .lp-rail-all"), { autoAlpha: 0 });
        gsap.set(q(".lp-film-toast"), { autoAlpha: 0, y: -8 });
        gsap.set(q(".lp-guest-chip"), { autoAlpha: 0, y: -6 });
        gsap.set(q(".lp-film-guest"), { opacity: 0 });
        gsap.set(q(".lp-film-split"), { autoAlpha: 0, "--x": "100%" });
        // x/y zeroed so GSAP doesn't read the CSS starting offset as pixels
        // and then add its percentage on top.
        gsap.set(q(".lp-cursor-track"), { x: 0, y: 0, xPercent: 78, yPercent: 108 });
        clearTyping();

        // The ring around the play button, counted in 1000ths so GSAP's
        // pixel rounding can't flatten it (see Ribbon.tsx).
        const ring = q(".lp-film-ring-fill")[0] as unknown as SVGCircleElement | undefined;
        const tl = gsap.timeline({
          repeat: -1,
          repeatDelay: 0.6,
          paused: true,
          defaults: { ease: "power2.inOut" },
          onRepeat: clearTyping,
          onUpdate: () => {
            if (ring) ring.style.strokeDashoffset = String(1000 * (1 - tl.progress()));
          },
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
          .to(q(".lp-thread"), popIn, ">+1.2")
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

          // The team hears about it where they already are.
          .to(q(".lp-toast-slack"), { autoAlpha: 1, y: 0, duration: 0.4, ease: "back.out(1.6)" }, ">+0.4")
          .to(q(".lp-toast-slack"), { autoAlpha: 0, y: -8, duration: 0.3 }, ">+2.4")
          .to(q(".lp-thread"), popOut, ">+0.4")

          // Send the link: copy it, and pick what clients are offered.
          .to(cursor, { ...shareBtn, duration: 1 }, ">+0.3")
          .add(click(), ">")
          .to(q(".lp-share-pop"), { autoAlpha: 1, y: 0, scale: 1, duration: 0.35, ease: "back.out(1.6)" }, "<+0.1")
          .to(cursor, { ...copyBtn, duration: 0.7 }, ">+0.6")
          .add(click(), ">")
          .to(q(".lp-copy-idle"), { autoAlpha: 0, duration: 0.15 }, "<+0.05")
          .to(q(".lp-copy-done"), { autoAlpha: 1, duration: 0.2 }, "<")
          .to(q(".lp-share-pop"), { autoAlpha: 0, y: 6, duration: 0.3 }, ">+3.4")

          // Someone opens that link, with no account at all.
          .fromTo(
            q(".lp-film-guest"),
            { opacity: 0, scale: 0.4 },
            { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2.2)", transformOrigin: "50% 50%" },
            ">+0.4",
          )
          .to(q(".lp-guest-chip"), { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" }, "<+0.1")
          .to(q(".lp-guest-chip"), { autoAlpha: 0, duration: 0.3 }, ">+2.6");

        // The same page as a client on a phone gets it. No room for the
        // switch on a narrow screen, so that pass skips this.
        if (!narrow) {
          tl.to(cursor, { ...viewMobile, duration: 0.8 }, ">+0.4")
            .add(click(), ">")
            .call(
              () => {
                site.setAttribute("data-view", "mobile");
                on(viewM, true);
                on(viewD, false);
              },
              [],
              "<+0.05",
            )
            .to({}, { duration: 3.4 })
            .to(cursor, { ...viewDesktop, duration: 0.6 }, ">")
            .add(click(), ">")
            .call(
              () => {
                site.removeAttribute("data-view");
                on(viewD, true);
                on(viewM, false);
              },
              [],
              "<+0.05",
            )
            .to({}, { duration: 0.8 });
        }

        // Nobody has to chase the client.
        tl.to(q(".lp-toast-remind"), { autoAlpha: 1, y: 0, duration: 0.4, ease: "back.out(1.6)" }, ">+0.6")
          .to(q(".lp-toast-remind"), { autoAlpha: 0, y: -8, duration: 0.3 }, ">+2.4");

        // A new version lands, with every comment carried across.
        tl.to(q(".lp-film-toast"), { autoAlpha: 1, y: 0, duration: 0.4, ease: "back.out(1.6)" }, ">+0.6")
          .to(q(".lp-cta-v1"), { autoAlpha: 0, duration: 0.3 }, "<+0.35")
          .to(q(".lp-cta-v2"), { autoAlpha: 1, duration: 0.3 }, "<")
          .to(q(".lp-site-img"), { backgroundColor: "#e3915f", duration: 0.5 }, "<")
          .to(q(".lp-film-ver"), { autoAlpha: 1, duration: 0.3 }, "<")
          .to(q(".lp-film-toast"), { autoAlpha: 0, y: -8, duration: 0.3 }, ">+2")

          // Compare it against v1.
          .set(q(".lp-film-split"), { autoAlpha: 1, "--x": "100%" }, ">+0.2")
          .to(q(".lp-film-split"), { "--x": "38%", duration: 1.2, ease: "power2.inOut" })
          .to({}, { duration: 2.6 })
          .to(q(".lp-film-split"), { "--x": "100%", duration: 0.9, ease: "power2.inOut" })
          .set(q(".lp-film-split"), { autoAlpha: 0 });

        // Tick the second comment off, and the file is done.
        if (railResolve) {
          tl.to(cursor, { ...railResolve, duration: 0.9 }, ">+0.3")
            .add(click(), ">")
            .to(q(".lp-rail-resolve"), { autoAlpha: 0, duration: 0.2 }, "<+0.05")
            .to(q(".lp-rail-resolved-2"), { autoAlpha: 1, duration: 0.25 }, "<+0.1")
            .to(
              q(".lp-film-pin-2 .lp-pin, .lp-rail-item-2 .lp-pin"),
              { backgroundColor: "#2f9e62", color: "#ffffff", duration: 0.25 },
              "<",
            )
            .call(() => burstFrom(q(".lp-film-pin-2")[0], 36), [], "<")
            .fromTo(
              q(".lp-film-pin-2 .lp-pin"),
              { scale: 1 },
              { scale: 1.25, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out" },
              "<",
            )
            .to(q(".lp-rail-item-2"), { opacity: 0.6, duration: 0.3 }, "<+0.2")
            .call(
              () => {
                on(tabOpen, false);
                on(tabDone, true);
              },
              [],
              "<",
            )
            .to(q(".lp-rail-all"), { autoAlpha: 1, duration: 0.3 }, "<+0.2");
        }

        tl.to(cursor, { xPercent: 84, yPercent: 110, duration: 0.9 }, ">+3.6")
          .to(q(".lp-film-guest"), { opacity: 0, duration: 0.4 }, "<")

          // Clear the stage so the loop restarts from an empty page.
          .to(
            q(".lp-film-pin, .lp-region, .lp-rail-item, .lp-rail-all"),
            { autoAlpha: 0, duration: 0.45, ease: "power1.in" },
            ">+0.6",
          )
          // Attribute changes aren't tweens, so put them back by hand.
          .call(reset, [], 0);

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
          const { motion, narrow } = ctx.conditions as { motion: boolean; narrow: boolean };
          let alive = true;
          // The cursor aims at measured positions, so wait for the display font
          // to load and the page to settle into its final metrics.
          document.fonts.ready.then(() => {
            if (alive) ctx.add(() => build(motion, narrow));
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
          <span className="lp-film-url lp-tnum">
            markitup.apexure.com/s/fernleaf-home
            <em className="lp-film-ver lp-tnum">v2</em>
          </span>
          <span className="lp-film-views">
            <b className="lp-view-d" data-on>
              Desktop
            </b>
            <b className="lp-view-m">Mobile</b>
          </span>
          <span className="lp-film-people">
            <Avatar n={3} />
            <Avatar n={7} />
            <span className="lp-film-guest">
              <Avatar n={22} />
            </span>
            <span className="lp-film-share">Share</span>
          </span>
        </div>

        <span className="lp-guest-chip" aria-hidden>
          Jess opened the link · guest
        </span>

        {/* the share panel the cursor opens later in the loop */}
        <div className="lp-share-pop" aria-hidden>
          <p className="lp-share-pop-title">Share “Fernleaf home”</p>
          <span className="lp-share-pop-link">
            <span className="lp-tnum">markitup.apexure.com/s/fernleaf</span>
            <span className="lp-share-pop-copy">
              <span className="lp-copy-idle">Copy</span>
              <span className="lp-copy-done">
                <CheckGlyph /> Copied
              </span>
            </span>
          </span>
          <span className="lp-share-pop-row">
            Anyone with the link can comment
            <span className="lp-toggle-mini" data-on />
          </span>
          <span className="lp-share-pop-row">
            Clients see
            <span className="lp-seg">
              <b>Desktop</b>
              <b>Mobile</b>
              <b data-on>Both</b>
            </span>
          </span>
          <span className="lp-share-pop-foot">Guests comment without an account.</span>
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
                      <b>Emma</b>
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
                      <b>Emma</b>
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
                    {/* the label the client asked for, swapped in with v2 */}
                    <span className="lp-cta-label">
                      <span className="lp-cta-v1">Learn more</span>
                      <span className="lp-cta-v2">Start trial</span>
                    </span>
                    <span className="lp-region" />
                    <span className="lp-film-pin lp-film-pin-2">
                      <span className="lp-pin">
                        <span className="lp-pin-num">2</span>
                      </span>
                    </span>
                    <div className="lp-pop lp-pop-2">
                      <div className="lp-pop-head">
                        <Avatar n={3} />
                        <b>Emma</b>
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

            {/* v2 lands, and the two versions side by side */}
            <div className="lp-film-toast" aria-hidden>
              <span className="lp-toast-dot" />
              v2 uploaded · every comment came along
            </div>
            <div className="lp-film-toast lp-toast-slack" aria-hidden>
              <span className="lp-toast-dot" />
              Posted to #fernleaf in Slack
            </div>
            <div className="lp-film-toast lp-toast-remind" aria-hidden>
              <span className="lp-toast-dot" />
              Reminder emailed to Emma
            </div>
            <div className="lp-film-split" aria-hidden>
              <span className="lp-split-line" />
              <b className="lp-split-v1">v1</b>
              <b className="lp-split-v2">v2</b>
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
                <span className="lp-tab-open" data-on>
                  Open
                </span>
                <span className="lp-tab-done">Resolved</span>
              </span>
            </div>
            <span className="lp-rail-all">
              <CheckGlyph /> All 2 resolved
            </span>
            <div className="lp-rail-item lp-rail-item-1">
              <div className="lp-rail-top">
                <span className="lp-pin">1</span>
                <Avatar n={3} />
                <b>Emma</b>
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
                <b>Emma</b>
                <span className="lp-tnum">now</span>
              </div>
              <p>{SECOND}</p>
              <div className="lp-rail-meta">
                <span className="lp-rail-resolve">
                  <CheckGlyph /> Resolve
                </span>
                <span className="lp-rail-resolved lp-rail-resolved-2">
                  <CheckGlyph /> Resolved
                </span>
              </div>
            </div>
            <div className="lp-rail-empty">
              <span />
              <span />
            </div>
          </aside>
        </div>

        {/* over the whole frame, so the cursor can reach the toolbar and the
            comments rail, not just the page */}
        <div className="lp-cursor-track" aria-hidden>
          <svg className="lp-cursor" viewBox="0 0 24 24">
            <path d="M4 2.5l15.5 9-6.8 1.6-3.4 6.4z" fill="#1c1c17" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </div>

        <button
          type="button"
          className="lp-film-toggle"
          aria-pressed={paused}
          aria-label={paused ? "Play the demo" : "Pause the demo"}
          onClick={paused ? resume : pause}
        >
          {/* how far through the loop it is */}
          <svg className="lp-film-ring" viewBox="0 0 40 40" aria-hidden>
            <circle className="lp-film-ring-track" cx="20" cy="20" r="18" />
            <circle className="lp-film-ring-fill" cx="20" cy="20" r="18" pathLength={1000} />
          </svg>
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
