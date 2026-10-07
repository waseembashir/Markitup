"use client";

import { useEffect, useRef } from "react";

/**
 * The search box used on the Projects page and the dashboard table.
 *
 * It filters what is already on screen rather than asking the server: the
 * workspace's projects are all loaded by the time the page renders, so the
 * results can keep up with the typing.
 */
export function SearchField({
  value,
  onChange,
  placeholder = "Search",
  label = "Search projects",
  className = "",
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  // "/" is where everyone's hand already goes. Not while they are typing
  // somewhere else, and not while a dialog has taken over the page.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      ref.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint"
      >
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onChange("");
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        className="field h-9 w-full pl-8"
      />
    </div>
  );
}
