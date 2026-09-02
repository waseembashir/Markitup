"use client";

import { RichCommentInput, type PendingAttachment } from "@/components/viewer/RichCommentInput";

export function PinComposer({
  xPct,
  yPct,
  projectId,
  onCancel,
  onSubmit,
  pending,
  error,
  author,
  innerRef,
}: {
  xPct: number;
  yPct: number;
  projectId: string;
  onCancel: () => void;
  onSubmit: (body: string, attachments: PendingAttachment[]) => void;
  pending: boolean;
  error?: string | null;
  author?: { name: string; email: string };
  // Lets the viewer keep the popup inside the canvas — see clampPopup there.
  innerRef?: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={innerRef}
      className="pointer-events-auto absolute z-50 w-80 rounded-xl border bg-surface p-3 shadow-xl"
      style={{ left: `${xPct}%`, top: `${yPct}%`, transform: "translateX(-50%)", marginTop: "14px" }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <RichCommentInput
        projectId={projectId}
        placeholder="Add comment here…"
        pending={pending}
        author={author}
        onCancel={onCancel}
        onSubmit={(html, attachments) => onSubmit(html, attachments)}
      />
      {error && (
        <p className="mt-2 text-sm font-medium" style={{ color: "var(--color-danger)" }} role="alert">{error}</p>
      )}
    </div>
  );
}
