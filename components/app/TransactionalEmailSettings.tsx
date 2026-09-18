"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { saveEmailTemplate, sendTestTemplate } from "@/app/app/email-actions";
import type { EmailSample } from "@/app/app/reminder-actions";
import {
  EMAIL_TEMPLATE_META,
  fillEmailTemplate,
  type EmailTemplate,
  type EmailTemplateKey,
} from "@/lib/email-templates";

type Templates = Record<EmailTemplateKey, EmailTemplate>;

export function TransactionalEmailSettings({ initial, canManage, sample }: { initial: Templates; canManage: boolean; sample: EmailSample }) {
  const [templates, setTemplates] = useState<Templates>(initial);
  const [active, setActive] = useState<EmailTemplateKey>("client_invite");
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();
  const toast = useToast();

  const meta = EMAIL_TEMPLATE_META.find((m) => m.key === active)!;
  const tpl = templates[active];
  const set = (patch: Partial<EmailTemplate>) => setTemplates((p) => ({ ...p, [active]: { ...p[active], ...patch } }));

  function save() {
    startSave(async () => {
      const res = await saveEmailTemplate(active, tpl);
      if (res?.error) toast.error(res.error);
      else toast.success(`${meta.label} email saved`);
    });
  }
  function test() {
    startTest(async () => {
      const res = await sendTestTemplate(active, tpl);
      if ("error" in res && res.error) toast.error(res.error);
      else toast.success("Test email sent", { description: `Sent to ${"sentTo" in res ? res.sentTo : "you"}` });
    });
  }
  function insertVar(name: string) {
    set({ message: `${tpl.message} {{${name}}}`.replace(/\s+\{\{/g, " {{") });
  }

  const previewSubject = fillEmailTemplate(tpl.subject, sample);
  const previewMessage = fillEmailTemplate(tpl.message, sample);

  return (
    <div className="space-y-5">
      {/* sub-tabs */}
      <div className="inline-flex rounded-md border bg-surface p-0.5">
        {EMAIL_TEMPLATE_META.map((m) => {
          const on = m.key === active;
          return (
            <button
              key={m.key}
              onClick={() => setActive(m.key)}
              className="rounded px-3 py-1 text-xs font-semibold transition-colors"
              style={on ? { background: "var(--color-brand)", color: "var(--primary-foreground)" } : { color: "var(--color-muted)" }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted">{meta.description}</p>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* editor */}
        <div className="rounded-xl border bg-surface p-4">
          <label className="field-label">Subject</label>
          <input className="field" value={tpl.subject} disabled={!canManage} onChange={(e) => set({ subject: e.target.value })} />
          <label className="field-label mt-3">Message</label>
          <textarea className="field field-textarea min-h-32" value={tpl.message} disabled={!canManage} onChange={(e) => set({ message: e.target.value })} />
          <label className="field-label mt-3">Button label</label>
          <input className="field" value={tpl.button_label} disabled={!canManage} onChange={(e) => set({ button_label: e.target.value })} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-faint">Insert:</span>
            {meta.placeholders.map((p) => (
              <button
                key={p}
                type="button"
                disabled={!canManage}
                onClick={() => insertVar(p)}
                className="rounded-md bg-brand-soft px-2 py-0.5 font-mono text-[0.6875rem] font-semibold text-brand-ink transition-colors hover:brightness-95 disabled:opacity-60"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* live preview */}
        <div className="rounded-xl border bg-surface p-4">
          <p className="mb-3 text-xs font-semibold tracking-wider text-faint uppercase">Live preview</p>
          <div className="rounded-lg border bg-canvas p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[color:var(--color-border-strong)]" />
              <span className="h-2 w-2 rounded-full bg-[color:var(--color-border-strong)]" />
              <span className="h-2 w-2 rounded-full bg-[color:var(--color-border-strong)]" />
            </div>
            <p className="text-sm font-bold text-ink">{previewSubject || "Subject…"}</p>
            <p className="mt-0.5 text-xs text-faint">From MarkItUp · to {meta.toLabel}</p>
            <div className="my-3 h-px bg-[color:var(--color-border)]" />
            <p className="text-sm font-semibold" style={{ color: "var(--color-brand-ink)" }}>MarkItUp</p>
            <p className="mt-2 text-sm whitespace-pre-line text-muted">{previewMessage || "Your message…"}</p>
            <span className="mt-3 inline-block rounded-md px-4 py-2 text-sm font-semibold text-[color:var(--primary-foreground)]" style={{ background: "var(--color-brand)" }}>
              {tpl.button_label || "Open MarkItUp"}
            </span>
            <p className="mt-4 text-xs text-faint">Sent with MarkItUp · visual feedback for your team</p>
          </div>
        </div>
      </div>

      {canManage ? (
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save changes"}</button>
          <button onClick={test} disabled={testing} className="btn-secondary">{testing ? "Sending…" : "Send test to me"}</button>
        </div>
      ) : (
        <p className="text-xs text-faint">Only admins can edit these templates.</p>
      )}
    </div>
  );
}
