"use client";

import { useEffect, useState } from "react";

type Accent = { id: string; label: string; swatch: string };

const ACCENTS: Accent[] = [
  { id: "neutral", label: "Neutral", swatch: "#171717" },
  { id: "azure", label: "Azure", swatch: "#3056d3" },
  { id: "blue", label: "Blue", swatch: "#2563eb" },
  { id: "sky", label: "Sky", swatch: "#0ea5e9" },
  { id: "slate", label: "Slate", swatch: "#5b5bd6" },
  { id: "green", label: "Lime", swatch: "#c4f73c" },
  { id: "yellow", label: "Yellow", swatch: "#eab308" },
  { id: "orange", label: "Orange", swatch: "#f97316" },
  { id: "stone", label: "Stone", swatch: "#78716c" },
  { id: "rose", label: "Rose", swatch: "#e11d48" },
];

export function ThemeSettings() {
  const [dark, setDark] = useState(false);
  const [accent, setAccent] = useState("neutral");

  // One-time read of the theme the inline boot script already applied to <html>.
  // It has to happen after hydration — reading the DOM during render would make
  // the server and client markup disagree.
  useEffect(() => {
    const el = document.documentElement;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(el.classList.contains("dark"));
    setAccent(el.getAttribute("data-theme") || "neutral");
  }, []);

  function applyMode(next: boolean) {
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("ui-mode", next ? "dark" : "light");
    setDark(next);
  }
  function applyAccent(id: string) {
    const el = document.documentElement;
    if (id === "neutral") el.removeAttribute("data-theme");
    else el.setAttribute("data-theme", id);
    localStorage.setItem("ui-accent", id);
    setAccent(id);
  }

  return (
    <div className="card max-w-md p-5">
      <p className="mb-2 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">Mode</p>
      <div className="mb-5 inline-flex w-full max-w-xs rounded-md border bg-canvas p-0.5">
        {[
          { k: false, label: "Light" },
          { k: true, label: "Dark" },
        ].map((m) => (
          <button
            key={m.label}
            onClick={() => applyMode(m.k)}
            className="flex-1 rounded px-3 py-2 text-sm font-semibold transition-colors duration-150"
            style={dark === m.k ? { background: "var(--card)", color: "var(--foreground)", boxShadow: "var(--shadow-xs)" } : { color: "var(--muted-foreground)" }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <p className="mb-2 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">Accent</p>
      <div className="grid grid-cols-5 gap-2">
        {ACCENTS.map((a) => (
          <button
            key={a.id}
            onClick={() => applyAccent(a.id)}
            title={a.label}
            aria-label={a.label}
            className="grid h-9 place-items-center rounded-md transition-transform duration-150 hover:scale-105"
            style={{
              background: a.swatch,
              outline: accent === a.id ? "2px solid var(--foreground)" : "none",
              outlineOffset: "2px",
            }}
          >
            {accent === a.id && (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-white" aria-hidden>
                <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
