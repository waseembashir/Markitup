"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { gsap, MOTION_OK, useGSAP } from "./gsap";
import { PLANS } from "./content";

const Check = () => (
  <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden>
    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Three plans. On a wide screen they stand side by side and rise in as the
 * section arrives, with Pro raised. On a phone they stack like cards in a
 * hand, each tucked under the next: tap one to open its list.
 */
export function Pricing() {
  const root = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(1);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(gsap.utils.toArray<HTMLElement>(".lp-price-card", root.current), {
          y: 60,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.12,
          scrollTrigger: { trigger: ".lp-price-grid", start: "top 80%", toggleActions: "play none none none" },
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="pricing" className="lp-price" aria-labelledby="lp-price-title">
      <div className="lp-container">
        <div className="lp-price-head">
          <p className="lp-eyebrow">Pricing</p>
          <h2 id="lp-price-title" className="lp-serif lp-h2 mt-5">
            Simple plans, <em>no surprises.</em>
          </h2>
          <p className="lp-lede mt-6">Clients never pay, and never sign up. You only pay for the people doing the work.</p>
        </div>

        <div className="lp-price-grid">
          {PLANS.map((p, i) => (
            <article
              key={p.key}
              className="lp-price-card"
              data-tone={p.tone}
              data-open={open === i || undefined}
              onClick={() => setOpen(i)}
            >
              {p.popular && <span className="lp-price-flag">Most popular</span>}

              <button type="button" className="lp-price-top" aria-expanded={open === i} onClick={() => setOpen(i)}>
                <span className="lp-price-name">{p.name}</span>
                <span className="lp-price-amount lp-serif">
                  {p.price}
                  {p.per && <em>{p.per}</em>}
                </span>
                <span className="lp-price-note">{p.note}</span>
              </button>

              <div className="lp-price-body">
                <div>
                  <p className="lp-price-line">{p.line}</p>
                  <ul className="lp-price-list">
                    {p.features.map((f) => (
                      <li key={f}>
                        <span className="lp-price-tick">
                          <Check />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {p.cta.href.startsWith("mailto:") ? (
                <a className="lp-price-cta" href={p.cta.href}>
                  {p.cta.label}
                </a>
              ) : (
                <Link className="lp-price-cta" href={p.cta.href}>
                  {p.cta.label}
                </Link>
              )}
            </article>
          ))}
        </div>

        <p className="lp-price-foot">Prices in USD. Change or stop your plan whenever you like.</p>
      </div>
    </section>
  );
}
