"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { gsap, MOTION_OK, useGSAP } from "./gsap";
import studio from "./images/cta-studio.png";

/**
 * The closing call to action, over a photo of someone heads-down in a busy
 * studio. The heading sits top left, the ask and the buttons bottom right, so
 * the photo stays in full view between them. The photo pushes in as it
 * arrives and shifts a little with the pointer, like a camera following you.
 */
export function FinalCta() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(MOTION_OK, () => {
        // A slow push-in while the section scrolls into place.
        gsap.fromTo(
          ".lp-cta-photo",
          { scale: 1.16 },
          {
            scale: 1,
            ease: "none",
            scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom bottom", scrub: true },
          },
        );

        // The heading rises in, then the ask and the buttons.
        // Explicit start and end values: the resting CSS is the finished state.
        gsap
          .timeline({ scrollTrigger: { trigger: root.current, start: "top 55%", toggleActions: "play none none none" } })
          .fromTo(".lp-cta-head > *", { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "power3.out", stagger: 0.1 })
          .fromTo(".lp-cta-foot > *", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", stagger: 0.1 }, "-=0.5");
      });

      // The pointer nudges the photo.
      mm.add(`${MOTION_OK} and (pointer: fine)`, () => {
        const frame = root.current!.querySelector<HTMLElement>(".lp-cta-frame")!;
        const px = gsap.quickTo(".lp-cta-parallax", "x", { duration: 1.1, ease: "power3.out" });
        const py = gsap.quickTo(".lp-cta-parallax", "y", { duration: 1.1, ease: "power3.out" });
        const move = (e: PointerEvent) => {
          const r = frame.getBoundingClientRect();
          px((0.5 - (e.clientX - r.left) / r.width) * 26);
          py((0.5 - (e.clientY - r.top) / r.height) * 18);
        };
        const leave = () => {
          px(0);
          py(0);
        };
        frame.addEventListener("pointermove", move);
        frame.addEventListener("pointerleave", leave);
        return () => {
          frame.removeEventListener("pointermove", move);
          frame.removeEventListener("pointerleave", leave);
        };
      });

      // The main button leans toward the pointer.
      mm.add(`${MOTION_OK} and (pointer: fine)`, () => {
        const wrap = root.current!.querySelector<HTMLElement>(".lp-magnet")!;
        const btn = wrap.firstElementChild as HTMLElement;
        const x = gsap.quickTo(btn, "x", { duration: 0.5, ease: "power3.out" });
        const y = gsap.quickTo(btn, "y", { duration: 0.5, ease: "power3.out" });
        const move = (e: PointerEvent) => {
          const r = wrap.getBoundingClientRect();
          x((e.clientX - (r.left + r.width / 2)) * 0.28);
          y((e.clientY - (r.top + r.height / 2)) * 0.4);
        };
        const leave = () => {
          x(0);
          y(0);
        };
        wrap.addEventListener("pointermove", move);
        wrap.addEventListener("pointerleave", leave);
        return () => {
          wrap.removeEventListener("pointermove", move);
          wrap.removeEventListener("pointerleave", leave);
        };
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="lp-cta lp-on-dark" aria-labelledby="lp-cta-title">
      <div className="lp-cta-frame">
        <div className="lp-cta-parallax" aria-hidden>
          <div className="lp-cta-photo">
            <Image src={studio} alt="" fill sizes="(max-width: 1440px) 110vw, 1600px" placeholder="blur" className="lp-cta-img" />
          </div>
        </div>
        <div className="lp-cta-shade" aria-hidden />

        <div className="lp-cta-head">
          <h2 id="lp-cta-title" className="lp-serif lp-cta-title">
            Your next round of feedback <em>starts here.</em>
          </h2>
        </div>

        <div className="lp-cta-foot">
          <p className="lp-lede">
            Set up a workspace in a minute. Your clients won’t have to set up
            anything at all.
          </p>
          <div className="lp-cta-actions">
            <span className="lp-magnet">
              <Link href="/signup" className="lp-btn lp-btn-primary">
                Start free
                <svg className="lp-arrow" width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                  <path d="M3 8h9.5M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </span>
            <Link href="/login" className="lp-btn lp-btn-ghost">
              Log in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
