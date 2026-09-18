"use client";

import { useEffect, useState } from "react";

// Light or dark only: the lime brand accent is fixed, so there is no colour to
// choose.
export function ThemeSettings() {
  const [dark, setDark] = useState(false);

  // One-time read of the mode the inline boot script already applied to <html>.
  // It has to happen after hydration — reading the DOM during render would make
  // the server and client markup disagree.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function applyMode(next: boolean) {
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("ui-mode", next ? "dark" : "light"); } catch {}
    setDark(next);
  }

  return (
    <div className="card max-w-md p-5">
      <p className="mb-2 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">Mode</p>
      <div className="inline-flex w-full max-w-xs rounded-md border bg-canvas p-0.5">
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
    </div>
  );
}
