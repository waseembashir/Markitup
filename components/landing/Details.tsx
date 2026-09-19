"use client";

import { useRef } from "react";
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

/** The same page, offered as a desktop layout or a phone one. */
function DeviceArt() {
  return (
    <div className="lp-dv-art lp-dv-devices" aria-hidden>
      <div className="lp-dv-switch">
        <b data-on>Desktop</b>
        <b>Mobile</b>
      </div>
      <div className="lp-dv-frames">
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
            <span className="lp-pin lp-dv-pin">1</span>
          </div>
        </div>
        <div className="lp-dv-phone">
          <span className="lp-dv-notch" />
          <div className="lp-dv-page">
            <span className="lp-dv-logo lp-serif">fernleaf</span>
            <span className="lp-dv-img lp-dv-img-tall" />
            <span className="lp-dv-line" />
            <span className="lp-pin lp-dv-pin lp-dv-pin-phone">2</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The share panel a client never has to sign in past. */
function ShareArt() {
  return (
    <div className="lp-dv-art lp-dv-share" aria-hidden>
      <p className="lp-dv-share-title">Share “Fernleaf home”</p>
      <span className="lp-share-link">
        <span className="lp-tnum">markitup.apexure.com/s/fernleaf</span>
        <span className="lp-share-copy">
          <Check /> Copied
        </span>
      </span>
      <span className="lp-dv-row">
        Anyone with the link can comment
        <span className="lp-toggle" data-on />
      </span>
      <span className="lp-dv-guests">
        <Avatar n={3} />
        <Avatar n={22} />
        <Avatar n={7} />
        <b>+4 commenting</b>
        <span className="lp-dv-chip">
          <Check /> No account needed
        </span>
      </span>
    </div>
  );
}

/** What you can put in: flat images, live pages, Figma frames. */
function FormatsArt() {
  return (
    <div className="lp-dv-art lp-dv-formats" aria-hidden>
      <span className="lp-dv-chips">
        <b>PNG</b>
        <b data-on>Live HTML</b>
        <b>Figma</b>
      </span>
      <div className="lp-dv-window">
        <span className="lp-dv-chrome">
          <i />
          <i />
          <i />
          <em className="lp-tnum">fernleaf.co</em>
        </span>
        <div className="lp-dv-page">
          <span className="lp-dv-logo lp-serif">fernleaf</span>
          <span className="lp-dv-nav-pill">Shop</span>
          <span className="lp-dv-h lp-serif">Slow mornings</span>
          <span className="lp-dv-cta">Learn more</span>
          <span className="lp-dv-hover" />
          <Cursor className="lp-dv-cursor" />
          <span className="lp-pin lp-dv-pin lp-dv-pin-live">3</span>
        </div>
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
 * a review easy for the client. Each row rises in as it scrolls up, the art
 * from the side it sits on.
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
