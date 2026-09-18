"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, ScrollTrigger, useGSAP } from "./gsap";
import { Avatar } from "./Avatar";
import { burstFrom } from "./confetti";
import { Mark } from "./icons";

// Where each piece sits in the pile before it drops into the folder: an offset
// (px at a 15px frame font) and a turn, so it reads as a heap, not a stack.
const PILE = [
  { x: -46, y: -34, r: -9 },
  { x: 38, y: -48, r: 7 },
  { x: 10, y: 6, r: -3 },
  { x: 64, y: 22, r: 11 },
  { x: -70, y: 30, r: 6 },
  { x: -18, y: 58, r: -12 },
  { x: 52, y: 64, r: 4 },
];

// How far each piece drifts while the mess scrolls in (px at a 15px frame
// font), in piece order. The top row (screenshot, chat, sticky note) drifts
// down, away from the caption above it.
const DRIFT = [20, 24, -22, 18, -24, -20, -18];

// How far above the folder the pile gathers (px at a 15px frame font).
const LIFT = 180;

// The order the pieces drop into the folder, small scraps first, the
// screenshot last, and where each one settles inside it.
const SWALLOW = [6, 5, 3, 1, 4, 2, 0];
const DROP = [
  { x: -60, r: -8 },
  { x: 48, r: 7 },
  { x: -22, r: -4 },
  { x: 66, r: 10 },
  { x: -48, r: 5 },
  { x: 14, r: -6 },
  { x: 0, r: 2 },
];

const Clip = () => (
  <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden>
    <path d="M10.5 4.5 5.8 9.2a1.4 1.4 0 0 0 2 2l5-5a2.8 2.8 0 0 0-4-4l-5.2 5.2a4.2 4.2 0 0 0 6 6L14 9" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
const Phone = () => (
  <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden>
    <path d="M5.2 2.5 3.4 3.2c-.8.3-1.2 1.2-.9 2 1.4 3.7 4.4 6.7 8.1 8.1.8.3 1.7-.1 2-.9l.7-1.8-2.6-1.5-1.2 1.2c-1.5-.7-2.8-2-3.5-3.5L7.2 5.6 5.2 2.5Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
  </svg>
);
const Check = () => (
  <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden>
    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** The client's page, the same on both sides of the story. */
function MiniSite({ children }: { children?: React.ReactNode }) {
  return (
    <div className="lp-ba-site">
      <div className="lp-ba-site-nav">
        <span className="lp-ba-site-logo lp-serif">fernleaf</span>
        <i />
        <i />
        <b>Shop</b>
      </div>
      <p className="lp-ba-site-h lp-serif">
        Slow mornings, <em>better coffee.</em>
      </p>
      <span className="lp-ba-site-line" />
      <span className="lp-ba-site-line" style={{ width: "60%" }} />
      <div className="lp-ba-site-img" />
      <div className="lp-ba-site-row">
        <i />
        <i />
        <i />
      </div>
      {children}
    </div>
  );
}

function Piece({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div className={`lp-clut ${className}`}>
      <div className="lp-clut-in">
        <div className="lp-clut-body">{children}</div>
      </div>
    </div>
  );
}

/**
 * Before and after as one scroll. The old way's clutter is scattered across
 * the screen in black and white; as you scroll it gathers into a pile, drops
 * piece by piece into a MarkItUp folder, and when the folder opens the app
 * comes up out of it in colour, where the same comment plays out: pin,
 * comment, reply, resolved.
 */
export function BeforeAfter() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      // Rebuilt when the frame turns portrait: phones drop the pieces straight
      // in, one at a time, with no pile on the way.
      mm.add({ motion: MOTION_OK, portrait: "(max-aspect-ratio: 1 / 1)" }, (ctx) => {
        const { motion, portrait } = ctx.conditions as { motion: boolean; portrait: boolean };
        if (!motion) return;
        const frame = root.current!.querySelector<HTMLElement>(".lp-ba-frame")!;
        const merge = frame.querySelector<HTMLElement>(".lp-ba-merge")!;
        const panel = frame.querySelector<HTMLElement>(".lp-ba-new")!;
        // the folder's back and front move together; the pieces fall between them
        const folder = gsap.utils.toArray<HTMLElement>(".lp-ba-folder-back, .lp-ba-folder-front", frame);
        const pieces = gsap.utils.toArray<HTMLElement>(".lp-clut", frame);
        const inner = pieces.map((p) => p.querySelector<HTMLElement>(".lp-clut-in")!);

        // How far each piece travels to reach the merge point. The outer
        // .lp-clut is never transformed, so its box is the resting layout;
        // re-measured whenever ScrollTrigger refreshes.
        const toMerge = (i: number, axis: "x" | "y") => {
          const m = merge.getBoundingClientRect();
          const r = pieces[i].getBoundingClientRect();
          return axis === "x"
            ? m.left + m.width / 2 - (r.left + r.width / 2)
            : m.top + m.height / 2 - (r.top + r.height / 2);
        };
        // The pile's spread follows the frame's type size, so it holds on phones.
        const k = () => parseFloat(getComputedStyle(frame).fontSize) / 15;

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: ".lp-ba-track",
            start: "top 75%",
            end: "bottom bottom",
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });

        // 1. The mess, drifting as it scrolls in, the scribble being drawn.
        tl.fromTo(
          inner,
          { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 },
          {
            y: (i: number) => DRIFT[i] * k(),
            rotation: (i: number) => (i % 2 ? 3 : -3),
            duration: 2.6,
            ease: "sine.inOut",
          },
          0,
        )
          .fromTo(".lp-scribble-draw", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.2, stagger: 0.3 }, 0.3)
          .fromTo(".lp-ba-cap-old", { opacity: 1, y: 0 }, { opacity: 0, y: -14, duration: 0.6 }, 4.4);

        if (portrait) {
          // 2. The folder rises in under the mess.
          tl.fromTo(folder, { y: () => 120 * k(), opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: "power3.out" }, 2.2);

          // 3. Each piece falls from where it sits into the folder, one at a
          //    time: it drifts across while gravity takes it down, so the path
          //    curves, and the folder gives a little as it lands.
          SWALLOW.forEach((i, j) => {
            const t = 2.9 + j * 0.55;
            tl.to(
              inner[i],
              {
                x: () => toMerge(i, "x") + DROP[j].x * k(),
                rotation: DROP[j].r,
                scale: 0.4,
                duration: 0.9,
                ease: "power1.out",
              },
              t,
            )
              .to(inner[i], { y: () => toMerge(i, "y"), duration: 0.9, ease: "power2.in" }, t)
              .to(folder, { scaleX: 1.02, scaleY: 0.95, duration: 0.05 }, t + 0.87)
              .to(folder, { scaleX: 1, scaleY: 1, duration: 0.16, ease: "back.out(3)" }, t + 0.92);
          });
        } else {
          // 2. Everything gathers into one messy pile above the folder,
          //    which rises into place below it.
          tl.to(
            inner,
            {
              x: (i: number) => toMerge(i, "x") + PILE[i].x * k(),
              y: (i: number) => toMerge(i, "y") + (PILE[i].y - LIFT) * k(),
              rotation: (i: number) => PILE[i].r,
              scale: 0.6,
              duration: 2.4,
              ease: "power2.inOut",
              stagger: { each: 0.08, from: "edges" },
            },
            2.8,
          ).fromTo(folder, { y: () => 120 * k(), opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: "power3.out" }, 3.6);

          // 3. One by one the pieces drop into the folder, and it gives a
          //    little each time one lands. They stay tucked in, their tops
          //    peeking out.
          SWALLOW.forEach((i, j) => {
            const t = 5.3 + j * 0.22;
            tl.to(
              inner[i],
              {
                x: () => toMerge(i, "x") + DROP[j].x * k(),
                y: () => toMerge(i, "y"),
                rotation: DROP[j].r,
                scale: 0.4,
                duration: 0.5,
                ease: "power2.in",
              },
              t,
            )
              .to(folder, { scaleX: 1.02, scaleY: 0.95, duration: 0.05 }, t + 0.47)
              .to(folder, { scaleX: 1, scaleY: 1, duration: 0.16, ease: "back.out(3)" }, t + 0.52);
          });
        }

        // 4. The folder opens, and the app comes up out of it in colour.
        const rise = () => merge.offsetTop - (panel.offsetTop + panel.offsetHeight / 2);
        tl.fromTo(".lp-ba-folder-logo", { scale: 1 }, { scale: 1.12, duration: 0.2, yoyo: true, repeat: 1 }, 7.2)
          .fromTo(".lp-ba-folder-front", { rotationX: 0, transformPerspective: 700 }, { rotationX: -64, duration: 0.7, ease: "power2.inOut" }, 7.6)
          .fromTo(".lp-ba-folder-glow", { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.7, ease: "power2.out" }, 7.7)
          .to(inner, { opacity: 0, duration: 0.4 }, 8)
          .fromTo(panel, { y: rise, scale: 0.14 }, { y: 0, scale: 1, duration: 1.4, ease: "power3.inOut" }, 8)
          .fromTo(panel, { opacity: 0 }, { opacity: 1, duration: 0.25 }, 8)
          .to(folder, { y: () => 60 * k(), opacity: 0, duration: 0.7, ease: "power2.in" }, 8.5)
          .to(".lp-ba-folder-glow", { opacity: 0, duration: 0.6 }, 8.6)
          .fromTo(".lp-ba-cap-new", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6 }, 9.2)

          // 5. The same comment, done properly.
          .fromTo(".lp-ba-cursor", { xPercent: 180, yPercent: 220, opacity: 0 }, { xPercent: 0, yPercent: 0, opacity: 1, duration: 0.8, ease: "power2.out" }, 10)
          .fromTo(".lp-ba-pin", { scale: 0 }, { scale: 1, duration: 0.4, ease: "back.out(2.4)" }, 10.8)
          .to(".lp-ba-cursor", { opacity: 0, duration: 0.3 }, 11)
          .fromTo(".lp-ba-msg-1", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, 11.1)
          .fromTo(".lp-ba-msg-2", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, 11.9)
          .fromTo(".lp-ba-pin", { backgroundColor: "#c5f04a", color: "#1f2a05" }, { backgroundColor: "#2f9e62", color: "#ffffff", duration: 0.3 }, 12.7)
          .call(
            () => {
              if (tl.scrollTrigger?.direction === 1) burstFrom(frame.querySelector(".lp-ba-pin"));
            },
            [],
            12.7,
          )
          .fromTo(".lp-ba-pin-num", { opacity: 1 }, { opacity: 0, duration: 0.15 }, 12.7)
          .fromTo(".lp-ba-pin-check", { opacity: 0 }, { opacity: 1, duration: 0.2 }, 12.8)
          .fromTo(".lp-ba-resolved", { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2)" }, 12.8)
          .fromTo(".lp-ba-rail-count", { opacity: 1 }, { opacity: 0.35, duration: 0.3 }, 12.8)
          // a beat to take it in before the section scrolls on
          .to({}, { duration: 1.4 });

        // On phones the thread is a card beside the pin; it opens with the
        // first comment rather than waiting empty.
        if (portrait) {
          tl.fromTo(".lp-ba-rail", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, 11);
        }

        // Fonts change the pieces' sizes; re-measure once they are in.
        document.fonts.ready.then(() => ScrollTrigger.refresh());
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="lp-ba" aria-labelledby="lp-ba-title">
      <div className="lp-container lp-ba-head">
        <p className="lp-eyebrow">Before and after</p>
        <h2 id="lp-ba-title" className="lp-serif lp-h2 mt-5">
          Same comment. <em>None of the chaos.</em>
        </h2>
      </div>

      <div className="lp-ba-track">
        <div className="lp-ba-frame">
          <p className="lp-ba-cap lp-ba-cap-old">
            <span className="lp-ba-dot" data-tone="old" />
            <span>
              <b>The old way.</b> Screenshots, scribbles, long emails and “which logo?”
            </span>
          </p>

          {/* the MarkItUp folder the mess drops into: its back and inner glow
              sit behind the pieces */}
          <span className="lp-ba-folder-back" aria-hidden>
            <svg className="lp-ba-folder-shape" viewBox="0 0 220 160" preserveAspectRatio="none">
              <path d="M14 4h62q9 0 14 7l7 9h107q12 0 12 12v114q0 10-10 10H14q-10 0-10-10V14Q4 4 14 4Z" />
            </svg>
          </span>
          <span className="lp-ba-folder-glow" aria-hidden />

          {/* the old way, scattered across the screen */}
          <div className="lp-ba-scatter" aria-hidden>
            <Piece className="lp-clut-shot">
              <MiniSite>
                <svg className="lp-scribble" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path
                    className="lp-scribble-draw"
                    pathLength={1}
                    d="M 2 11 C 3 3.5, 21 2, 24 8 C 27 14, 9 18, 3.5 14.5 C -0.5 12, 5 5.5, 13 5"
                  />
                  <path className="lp-scribble-draw" pathLength={1} d="M 43 4 C 37 4, 31 5, 26 9 M 26 9 L 29 12 M 26 9 L 28.4 4.6" />
                </svg>
                <span className="lp-scribble-note lp-serif">this one!!</span>
              </MiniSite>
            </Piece>

            <Piece className="lp-clut-chat">
              <b>Sam</b> which logo? there are two on that page…
            </Piece>

            <Piece className="lp-clut-mail">
              <p className="lp-mail-subject">Re: Re: Fwd: homepage v3 (final)</p>
              <p className="lp-mail-meta">Emma to you, Sam, Jess +3</p>
              <p className="lp-mail-body">
                Hi all, the logo at the top left, next to the menu? Could it be a bit
                bigger. I’ve circled it in the screenshot. Also see my email from
                Tuesday. Thanks!
              </p>
              <span className="lp-mail-attach">
                <Clip /> screenshot_2.png
              </span>
            </Piece>

            <Piece className="lp-clut-note">
              <span className="lp-serif">call Emma re: logo??</span>
            </Piece>

            <Piece className="lp-clut-sheet">
              <span className="lp-sheet-row lp-sheet-head">
                <b>#</b>
                <b>Feedback</b>
                <b>Status</b>
              </span>
              <span className="lp-sheet-row">
                <i>12</i>
                <i>logo bigger??</i>
                <i>???</i>
              </span>
              <span className="lp-sheet-row">
                <i>13</i>
                <i>which button</i>
                <i>open?</i>
              </span>
              <span className="lp-sheet-row">
                <i>14</i>
                <i>see email (Tue)</i>
                <i>no reply</i>
              </span>
            </Piece>

            <Piece className="lp-clut-file">
              <span className="lp-tnum">v3_final_FINAL_2.png</span>
            </Piece>

            <Piece className="lp-clut-call">
              <Phone /> Missed call from Emma (2)
            </Piece>
          </div>

          <p className="lp-ba-cap lp-ba-cap-new">
            <span className="lp-ba-dot" data-tone="new" />
            <span>
              <b>With MarkItUp.</b> Click the spot. Say it once. Tick it off.
            </span>
          </p>

          {/* the folder's front, in front of the pieces; the mouth marker is
              where they drop, measured and never transformed */}
          <div className="lp-ba-folder-front" aria-hidden>
            <svg className="lp-ba-folder-shape" viewBox="0 0 220 124" preserveAspectRatio="none">
              <path d="M11 4h198q9 0 8 9l-5 98q-1 9-10 9H18q-9 0-10-9L3 13q-1-9 8-9Z" />
            </svg>
            <span className="lp-ba-folder-logo">
              <Mark />
              MarkItUp
            </span>
          </div>
          <span className="lp-ba-merge" aria-hidden />

          {/* the new way, coming up out of the folder */}
          <div className="lp-ba-new" aria-hidden>
            <div className="lp-ba-app">
              <div className="lp-ba-chrome">
                <i />
                <i />
                <i />
                <span className="lp-tnum">markitup.apexure.com/s/fernleaf</span>
              </div>
              <div className="lp-ba-canvas">
                <MiniSite>
                  <span className="lp-pin lp-ba-pin">
                    <span className="lp-ba-pin-num">1</span>
                    <span className="lp-ba-pin-check">
                      <Check />
                    </span>
                  </span>
                  <span className="lp-ba-cursor">
                    <svg viewBox="0 0 24 24">
                      <path d="M4 2.5l15.5 9-6.8 1.6-3.4 6.4z" fill="#1c1c17" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
                    </svg>
                  </span>
                </MiniSite>
              </div>
            </div>

            <div className="lp-ba-rail">
              <p className="lp-ba-rail-head">
                <b>Comments</b>
                <span className="lp-ba-rail-count lp-tnum">1 open</span>
              </p>
              <div className="lp-ba-thread">
                <div className="lp-ba-msg lp-ba-msg-1">
                  <p className="lp-ba-who">
                    <span className="lp-pin">1</span>
                    <Avatar n={3} /> Emma <span>Client</span>
                  </p>
                  <p>A bit bigger?</p>
                </div>
                <div className="lp-ba-msg lp-ba-msg-2">
                  <p className="lp-ba-who">
                    <Avatar n={12} /> Sam <span>Designer</span>
                  </p>
                  <p>Done in v2.</p>
                </div>
                <span className="lp-ba-resolved">
                  <Check /> Resolved
                </span>
              </div>
              <p className="lp-ba-earlier-head">Earlier</p>
              <p className="lp-ba-earlier">
                <span className="lp-pin" data-resolved="true">
                  <Check />
                </span>
                Tighter hero spacing
              </p>
              <p className="lp-ba-earlier">
                <span className="lp-pin" data-resolved="true">
                  <Check />
                </span>
                Swap to the warmer photo
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
