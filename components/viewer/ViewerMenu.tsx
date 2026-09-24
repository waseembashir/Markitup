"use client";

import { useEffect, useState } from "react";
import { ModalPortal } from "@/components/ui/ModalPortal";

/**
 * The phone viewer's menu: a hamburger in the top bar, and everything that
 * isn't the design or the two tab groups — zoom, fullscreen, the other files,
 * sharing — in a sheet behind it.
 */
export function ViewerMenu({ children }: { children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="File menu"
        aria-expanded={open}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-[color:var(--accent)] hover:text-ink md:hidden"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <ModalPortal>
          <div className="fixed inset-0 z-[200] flex flex-col" role="dialog" aria-modal="true" aria-label="File menu">
            <div className="fade-anim flex-1 bg-black/35" onClick={close} />
            <div className="flex max-h-[85vh] flex-col gap-5 overflow-y-auto rounded-t-2xl border-t bg-surface-2 p-4 pb-6 shadow-lg">
              {children(close)}
              <button type="button" className="btn-ghost btn-sm w-full justify-center" onClick={close}>
                Close
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}

/** A labelled group of controls inside the menu sheet. */
export function MenuGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">{label}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
