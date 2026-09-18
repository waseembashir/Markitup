"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { gsap, MOTION_OK, useGSAP } from "./gsap";
import { Mark } from "./icons";

// Apexure's real, public contact points (taken from apexure.com).
const EMAIL = "info@apexure.com";
const SOCIALS = [
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/apexure/",
    d: "M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45Z",
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/apexure/",
    d: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4ZM17.3 5.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4ZM12 2.8c2.5 0 2.8 0 3.8.06 2.6.12 3.8 1.35 3.94 3.94.05 1 .06 1.3.06 3.8v2.8c0 2.5 0 2.8-.06 3.8-.12 2.58-1.34 3.82-3.94 3.94-1 .05-1.3.06-3.8.06h-.02c-2.48 0-2.78 0-3.78-.06-2.6-.12-3.82-1.36-3.94-3.94C2.2 16.1 2.2 15.8 2.2 13.3v-2.6c0-2.5 0-2.8.06-3.8.12-2.6 1.35-3.82 3.94-3.94 1-.05 1.3-.06 3.8-.06Z",
  },
  {
    name: "X",
    href: "https://twitter.com/apexure",
    d: "M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z",
  },
];

const PRODUCT_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#versions", label: "Versions" },
  { href: "#faq", label: "FAQ" },
];

const FORMATS = ["PNG & JPG", "Live HTML", "Figma frames", "Desktop & mobile", "Slack", "Email"];

// Pins already stuck on the wordmark, in percent of its box.
const STUCK = [
  { n: "1", x: 16, y: 20 },
  { n: "2", x: 44, y: 36 },
  { n: "✓", x: 87, y: 20, resolved: true },
];
const QUIPS = ["Looks great", "Ship it", "Love this", "Bigger?", "Perfect", "One more pass?", "Approved"];

type Dropped = { id: number; x: number; y: number; n: number; quip: string };

/**
 * `base` prefixes the in-page anchors, so the footer also works on pages
 * other than the landing page ("/" there, "" here).
 */
export function Footer({ base = "" }: { base?: string }) {
  const root = useRef<HTMLElement>(null);
  const [dropped, setDropped] = useState<Dropped[]>([]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        // Explicit start and end values, on an inner span with no CSS
        // transition: the outer span's hover transition would otherwise be
        // read mid-flight as the letters' resting place.
        gsap.fromTo(
          ".lp-wm-rise",
          { yPercent: 70, opacity: 0 },
          {
            yPercent: 0,
            opacity: 1,
            duration: 1.1,
            ease: "power4.out",
            stagger: 0.07,
            scrollTrigger: { trigger: ".lp-wordmark", start: "top 95%", toggleActions: "play none none none" },
          },
        );
        gsap.from(".lp-wordmark .lp-wm-pin", {
          scale: 0,
          duration: 0.6,
          ease: "back.out(2.4)",
          stagger: 0.15,
          delay: 0.7,
          transformOrigin: "0% 100%",
          scrollTrigger: { trigger: ".lp-wordmark", start: "top 95%", toggleActions: "play none none none" },
        });
      });
    },
    { scope: root },
  );

  // Visitors can pin the wordmark too. Keeps the last few pins.
  const drop = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setDropped((list) => {
      const n = (list.at(-1)?.n ?? 3) + 1;
      const next = { id: Date.now(), x, y, n, quip: QUIPS[n % QUIPS.length] };
      return [...list, next].slice(-6);
    });
  };

  const href = (h: string) => (h.startsWith("#") ? base + h : h);

  return (
    <footer ref={root} className="lp-footer">
      <div className="lp-container">
        <div className="lp-footer-top">
          <div className="lp-footer-brand">
            <a href={href("#top")} className="inline-flex items-center gap-2.5" aria-label="MarkItUp, back to top">
              <Mark className="h-8 w-7" />
              <span className="text-xl font-bold tracking-tight">MarkItUp</span>
            </a>
            <p>
              Visual feedback for agencies and their clients. Pin it, talk it
              through, ship it. Made by Apexure.
            </p>
            <ul className="lp-socials" aria-label="Apexure on social media">
              {SOCIALS.map((s) => (
                <li key={s.name}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={`Apexure on ${s.name}`}>
                    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
                      <path d={s.d} fill="currentColor" />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="lp-footer-hello">
            <p className="lp-eyebrow">Got a question?</p>
            <a href={`mailto:${EMAIL}`} className="lp-serif lp-footer-mail">
              {EMAIL}
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M6 18 18 6M8 6h10v10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </div>

        <div className="lp-footer-cols">
          <nav aria-label="Product">
            <p className="lp-eyebrow">Product</p>
            <ul>
              {PRODUCT_LINKS.map((l) => (
                <li key={l.href}>
                  <a href={href(l.href)}>{l.label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Get started">
            <p className="lp-eyebrow">Get started</p>
            <ul>
              <li>
                <Link href="/signup">Start free</Link>
              </li>
              <li>
                <Link href="/login">Log in</Link>
              </li>
              <li>
                <Link href="/forgot-password">Forgot password</Link>
              </li>
            </ul>
          </nav>
          <div>
            <p className="lp-eyebrow">Works with</p>
            <ul className="lp-footer-chips">
              {FORMATS.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
          <nav aria-label="Apexure">
            <p className="lp-eyebrow">Apexure</p>
            <ul>
              <li>
                <a href="https://www.apexure.com/" target="_blank" rel="noopener noreferrer">
                  apexure.com ↗
                </a>
              </li>
              <li>
                <a href="https://www.apexure.com/contact-us/" target="_blank" rel="noopener noreferrer">
                  Contact ↗
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="lp-footer-bar">
          <p>© 2026 Apexure. All rights reserved.</p>
          <nav className="lp-footer-legal" aria-label="Legal">
            <a href="https://www.apexure.com/privacy/" target="_blank" rel="noopener noreferrer">
              Privacy policy
            </a>
            <Link href="/terms">Terms and conditions</Link>
          </nav>
        </div>
      </div>

      {/* The sign-off: a giant wordmark, pinned like a design under review. */}
      <div className="lp-wordmark" onClick={drop} role="img" aria-label="MarkItUp">
        <span className="lp-serif lp-wm-text" aria-hidden>
          {"MarkIt".split("").map((c, i) => (
            <span key={i} className="lp-wm-letter">
              <span className="lp-wm-rise">{c}</span>
            </span>
          ))}
          <em>
            {"Up".split("").map((c, i) => (
              <span key={i} className="lp-wm-letter">
                <span className="lp-wm-rise">{c}</span>
              </span>
            ))}
          </em>
        </span>
        {STUCK.map((p) => (
          <span
            key={p.n}
            className="lp-pin lp-wm-pin"
            data-resolved={p.resolved || undefined}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            aria-hidden
          >
            {p.n}
          </span>
        ))}
        {dropped.map((p, i) => (
          <span key={p.id} className="lp-wm-dropped" style={{ left: `${p.x}%`, top: `${p.y}%` }} aria-hidden>
            <span className="lp-pin">{p.n}</span>
            {i === dropped.length - 1 && <span className="lp-wm-quip">{p.quip}</span>}
          </span>
        ))}
        <span className="lp-wm-hint" aria-hidden>
          Click anywhere to leave a pin
        </span>
      </div>
    </footer>
  );
}
