"use client";

import { useEffect, useRef, useState } from "react";
import { ModalPortal } from "@/components/ui/ModalPortal";

export function RenameDialog({
  open,
  label = "Rename",
  initial,
  pending = false,
  onSave,
  onClose,
}: {
  open: boolean;
  label?: string;
  initial: string;
  pending?: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);

  // Reset the field as the dialog opens, during render rather than in an effect,
  // so it never flashes the previous name.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setValue(initial);
  }

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => ref.current?.select(), 30);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const save = () => { if (value.trim()) onSave(value.trim()); };

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[300] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={label}>
      <div className="fade-anim absolute inset-0 bg-black/30" onClick={() => !pending && onClose()} />
      <div className="pop-anim relative z-10 w-full max-w-sm rounded-2xl border bg-surface-2 p-5 shadow-lg">
        <h2 className="text-base font-bold text-ink">{label}</h2>
        <input
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") onClose(); }}
          className="field mt-3"
          placeholder="Name"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} disabled={pending} className="btn-secondary btn-sm">Cancel</button>
          <button onClick={save} disabled={pending || !value.trim()} className="btn-primary btn-sm">{pending ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
