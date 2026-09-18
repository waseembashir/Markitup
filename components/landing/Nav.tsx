"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NAV_LINKS } from "./content";
import { Mark } from "./icons";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="lp-nav" data-scrolled={scrolled}>
      <a href="#top" className="flex items-center gap-2" aria-label="MarkItUp, back to top">
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
      </div>
    </header>
  );
}
