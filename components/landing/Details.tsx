"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, MOTION_OK, useGSAP } from "./gsap";
import { Avatar } from "./Avatar";

const Check = () => (
  <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden>
    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Cursor = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden>
    <path d="M4 2.5l15.5 9-6.8 1.6-3.4 6.4z" fill="#1c1c17" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

/**
 * Steps a card through its states on its own while it is on screen, and
 * hands control to the pointer while someone is on it. Reduced motion gets
 * the first state and no loop.
 */
function useCycle(steps: number, every: number, ref: React.RefObject<HTMLElement | null>) {
  const [step, setStep] = useState(0);
  const hovering = useRef(false);
  const onScreen = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia(MOTION_OK).matches) return;

    const io = new IntersectionObserver(([e]) => (onScreen.current = e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    const enter = () => (hovering.current = true);
    const leave = () => (hovering.current = false);
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    const id = window.setInterval(() => {
      if (onScreen.current && !hovering.current) setStep((n) => (n + 1) % steps);
    }, every);

    return () => {
      io.disconnect();
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
      window.clearInterval(id);
    };
  }, [steps, every, ref]);

  return [step, setStep] as const;
}

/** The same page, offered as a desktop layout or a phone one. */
function DeviceArt() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useCycle(2, 3600, ref);
  const mobile = step === 1;

  return (
    <div ref={ref} className="lp-dv-art lp-dv-devices" data-view={mobile ? "mobile" : "desktop"}>
      <div className="lp-dv-switch" role="group" aria-label="View">
        {["Desktop", "Mobile"].map((label, i) => (
          <button key={label} type="button" data-on={step === i || undefined} onPointerEnter={() => setStep(i)} onFocus={() => setStep(i)} onClick={() => setStep(i)}>
            {label}
          </button>
        ))}
      </div>

      <div className="lp-dv-stage" aria-hidden>
        <div className="lp-dv-window">
          <span className="lp-dv-chrome">
            <i />
            <i />
            <i />
          </span>
          <div className="lp-dv-page">
            <span className="lp-dv-logo lp-serif">fernleaf</span>
            <span className="lp-dv-h lp-serif">Slow mornings</span>
            <span className="lp-dv-line" />
            <span className="lp-dv-line lp-dv-line-short" />
            <span className="lp-dv-img" />
            <span className="lp-dv-row-blocks">
              <i />
              <i />
              <i />
            </span>
            <span className="lp-pin lp-dv-pin lp-dv-pin-a">1</span>
            <span className="lp-pin lp-dv-pin lp-dv-pin-b">2</span>
          </div>
        </div>
        <span className="lp-dv-caption">{mobile ? "Clients on a phone see this" : "Clients on a laptop see this"}</span>
      </div>
    </div>
  );
}

/** Copy the link, and people are in — no account anywhere. */
function ShareArt() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useCycle(3, 2600, ref);

  return (
    <div ref={ref} className="lp-dv-art lp-dv-share" data-step={step}>
      <p className="lp-dv-share-title">Share “Fernleaf home”</p>

      <span className="lp-share-link">
        <span className="lp-tnum">markitup.apexure.com/s/fernleaf</span>
        <button type="button" className="lp-share-copy" onPointerEnter={() => setStep(1)} onFocus={() => setStep(1)} onClick={() => setStep(1)}>
          <span className="lp-dv-copy-idle">Copy</span>
          <span className="lp-dv-copy-done">
            <Check /> Copied
          </span>
        </button>
      </span>

      <span className="lp-dv-row">
        Anyone with the link can comment
        <span className="lp-toggle" data-on />
      </span>

      <span className="lp-dv-joined" aria-hidden>
        <Avatar n={3} />
        <Avatar n={22} />
        <Avatar n={7} />
        <b>3 commenting as guests</b>
      </span>

      <span className="lp-dv-note" aria-hidden>
        <Check /> No account, no password, nothing to install
      </span>
    </div>
  );
}

const FORMATS = ["PNG", "Live HTML", "Figma"] as const;

/** What you can put in: flat images, live pages, Figma frames. */
function FormatsArt() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useCycle(3, 3200, ref);

  return (
    <div ref={ref} className="lp-dv-art lp-dv-formats" data-step={step}>
      <span className="lp-dv-chips" role="group" aria-label="Format">
        {FORMATS.map((f, i) => (
          <button key={f} type="button" data-on={step === i || undefined} onPointerEnter={() => setStep(i)} onFocus={() => setStep(i)} onClick={() => setStep(i)}>
            {f}
          </button>
        ))}
      </span>

      <div className="lp-dv-stage" aria-hidden>
        <div className="lp-dv-window">
          <span className="lp-dv-chrome">
            <i />
            <i />
            <i />
            <em className="lp-tnum">{step === 2 ? "Figma · Home / Hero" : step === 1 ? "fernleaf.co" : "hero-v3.png"}</em>
          </span>
          <div className="lp-dv-page">
            <span className="lp-dv-logo lp-serif">fernleaf</span>
            <span className="lp-dv-nav-pill">Shop</span>
            <span className="lp-dv-h lp-serif">Slow mornings</span>
            <span className="lp-dv-line" />
            <span className="lp-dv-cta">Learn more</span>
            <span className="lp-dv-img" />
            <span className="lp-dv-hover" />
            <Cursor className="lp-dv-cursor" />
            <span className="lp-dv-frame-label lp-tnum">Hero / Desktop</span>
            <span className="lp-pin lp-dv-pin lp-dv-pin-live">3</span>
          </div>
        </div>
        <span className="lp-dv-caption">
          {step === 2 ? "Frames come straight from Figma" : step === 1 ? "Clients scroll and click the real page" : "Flat designs, pinned the same way"}
        </span>
      </div>
    </div>
  );
}

const ROWS = [
  {
    key: "devices",
    title: "Desktop or mobile, your call",
    body: "Choose which views a file offers: the desktop layout, the mobile one, or both. Clients open the view you picked, whatever they are on.",
    art: <DeviceArt />,
  },
  {
    key: "guest",
    title: "No login for clients",
    body: "Send the link and they are in. Clients comment as guests, so there is no account to create, no password to reset and nothing to install.",
    art: <ShareArt />,
  },
  {
    key: "formats",
    title: "Interactive mockups, not screenshots",
    body: "Share a live HTML page or a Figma frame as easily as an image. Clients scroll and click the real thing while they pin their comments.",
    art: <FormatsArt />,
  },
];

/**
 * Three half-and-half rows under the versions section: the choices that make
 * a review easy for the client. Each row rises in as it scrolls up, and its
 * square of product art plays by itself until you take it over.
 */
export function Details() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.utils.toArray<HTMLElement>(".lp-dv-row-item", root.current).forEach((row, i) => {
          const from = i % 2 ? 40 : -40;
          gsap
            .timeline({ scrollTrigger: { trigger: row, start: "top 82%", toggleActions: "play none none none" } })
            .from(row.querySelector(".lp-dv-copy"), { y: 24, opacity: 0, duration: 0.7, ease: "power3.out" })
            .from(row.querySelector(".lp-dv-art"), { x: from, opacity: 0, duration: 0.8, ease: "power3.out" }, "<0.1");
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="lp-dv" aria-labelledby="lp-dv-title">
      <div className="lp-container">
        <div className="lp-dv-head">
          <p className="lp-eyebrow">Made for clients</p>
          <h2 id="lp-dv-title" className="lp-serif lp-h2 mt-5">
            Less friction, <em>every step.</em>
          </h2>
        </div>

        <div className="lp-dv-rows">
          {ROWS.map((r) => (
            <div key={r.key} className="lp-dv-row-item">
              <div className="lp-dv-copy">
                <h3 className="lp-serif lp-h3">{r.title}</h3>
                <p>{r.body}</p>
              </div>
              {r.art}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
