"use client";

import { useState } from "react";
import { setMockupDevices, type Device } from "@/app/app/projects/[projectId]/actions";
import { useToast } from "@/components/ui/toast";

const OPTIONS: { devices: Device[]; label: string; short: string }[] = [
  { devices: ["desktop", "mobile"], label: "Desktop & mobile", short: "Both" },
  { devices: ["desktop"], label: "Desktop only", short: "Desktop" },
  { devices: ["mobile"], label: "Mobile only", short: "Mobile" },
];

const same = (a: readonly Device[], b: readonly Device[]) =>
  a.length === b.length && a.every((d) => b.includes(d));

// The team's control over which views a client is offered. The team itself
// always keeps both, so a mobile layout can be checked before it is released —
// this changes only what clients see, and says so.
export function ClientViewsMenu({
  mockupId,
  devices,
  onChange,
}: {
  mockupId: string;
  devices: Device[];
  onChange: (next: Device[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const current = OPTIONS.find((o) => same(o.devices, devices)) ?? OPTIONS[0];

  async function choose(next: Device[]) {
    setOpen(false);
    if (same(next, devices)) return;
    const previous = devices;
    onChange(next); // optimistic: the toggle updates at once
    setSaving(true);
    const res = await setMockupDevices(mockupId, next);
    setSaving(false);
    if (res.error) {
      onChange(previous);
      toast.error(res.error);
      return;
    }
    toast.success(`Clients now see: ${OPTIONS.find((o) => same(o.devices, next))?.label ?? "both views"}`);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        title="Which views clients are offered"
        className="flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold text-muted transition-colors hover:text-ink disabled:opacity-60"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" />
        </svg>
        Clients: {current.short}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-lg border bg-surface-2 p-1 shadow-lg">
            <p className="px-3 pt-2 pb-1 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">
              Views clients see
            </p>
            {OPTIONS.map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => choose(o.devices)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[color:var(--accent)]"
                style={o === current ? { color: "var(--color-ink)", fontWeight: 700 } : { color: "var(--foreground)" }}
              >
                {o.label}
                {o === current && (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
            <p className="px-3 pt-1 pb-2 text-xs text-faint">Your team always sees both.</p>
          </div>
        </>
      )}
    </div>
  );
}
