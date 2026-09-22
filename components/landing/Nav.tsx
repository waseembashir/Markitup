"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NAV_LINKS } from "./content";
import { Mark } from "./icons";
import { holdScroll } from "./SmoothScroll";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The menu covers the page, so the page underneath stays put while it is
  // open — and Escape closes it, as a dialog would.
  useEffect(() => {
    holdScroll(open);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // A menu open on a phone has no business staying open on a wide screen.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 821px)");
    const close = () => mq.matches && setOpen(false);
    mq.addEventListener("change", close);
    return () => mq.removeEventListener("change", close);
  }, []);

  useEffect(() => () => holdScroll(false), []);

  return (
    <>
      <header className="lp-nav" data-scrolled={scrolled} data-menu={open || undefined}>
        <a href="#top" className="flex items-center gap-2" aria-label="MarkItUp, back to top" onClick={() => setOpen(false)}>
          <Mark className="h-7 w-6" />
          <span className="text-[1.0625rem] font-bold tracking-tight">MarkItUp</span>
        </a>
        <nav className="lp-nav-links" aria-label="Page sections">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="lp-nav-right flex items-center gap-1">
          <Link href="/login" className="lp-nav-login">
            Log in
          </Link>
          <Link href="/signup" className="lp-btn lp-btn-primary lp-btn-sm">
            Start free
          </Link>
          <button
            type="button"
            className="lp-burger"
            aria-expanded={open}
            aria-controls="lp-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
          </button>
        </div>
      </header>

      {/* Full screen on phones: the sections, then the two ways in. */}
      <div id="lp-menu" className="lp-menu" data-open={open || undefined} aria-hidden={!open}>
        <nav aria-label="Page sections">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="lp-menu-foot">
          <Link href="/login" className="lp-btn lp-btn-ghost" onClick={() => setOpen(false)}>
            Log in
          </Link>
          <Link href="/signup" className="lp-btn lp-btn-primary" onClick={() => setOpen(false)}>
            Start free
          </Link>
          <p>Clients never need an account.</p>
        </div>
      </div>
    </>
  );
}
