"use client";

import { useState } from "react";

export type SettingsSection = {
  key: string;
  label: string;
  icon: React.ReactNode;
  content: React.ReactNode;
};

export function SettingsShell({ sections }: { sections: SettingsSection[] }) {
  const [active, setActive] = useState(sections[0]?.key);

  return (
    <div className="grid gap-8 lg:grid-cols-[210px_1fr]">
      <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {sections.map((s) => {
          const on = s.key === active;
          return (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className="group flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors"
              style={
                on
                  ? { background: "var(--color-brand-soft)", color: "var(--color-brand-ink)", fontWeight: 600 }
                  : { color: "var(--color-muted)" }
              }
            >
              {/* Ink, not brand: the lime icon on the lime-tinted pill was barely visible. */}
              <span className={`transition-colors group-hover:text-ink ${on ? "text-ink" : "text-faint"}`}>{s.icon}</span>
              {s.label}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0">
        {sections.map((s) => (
          <div key={s.key} hidden={s.key !== active}>
            {s.content}
          </div>
        ))}
      </div>
    </div>
  );
}
