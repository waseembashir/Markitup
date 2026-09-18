"use client";

import { useState, useTransition } from "react";
import { fillTemplate, REMINDER_PLACEHOLDERS, type ReminderSettings } from "@/lib/reminders";
import { saveReminderSettings, sendTestReminder, type ScheduleRow, type EmailSample } from "@/app/app/reminder-actions";
import { useToast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/format";

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50"
      style={{ background: on ? "var(--color-brand)" : "var(--color-border-strong)" }}
    >
      <span
        className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(20px)" : "none" }}
      />
    </button>
  );
}

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t px-4 py-4 first:border-t-0">
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{title}</div>
        <div className="mt-0.5 text-xs text-muted">{desc}</div>
      </div>
      {children}
    </div>
  );
}

export function RemindersSettings({ initial, schedules, sample }: { initial: ReminderSettings; schedules: ScheduleRow[]; sample: EmailSample }) {
  const [s, setS] = useState<ReminderSettings>(initial);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();
  const toast = useToast();
  const set = <K extends keyof ReminderSettings>(k: K, v: ReminderSettings[K]) => setS((p) => ({ ...p, [k]: v }));

  function save() {
    startSave(async () => {
      const res = await saveReminderSettings(s);
      if (res?.error) toast.error(res.error);
      else toast.success("Reminder settings saved");
    });
  }
  function test() {
    startTest(async () => {
      const res = await sendTestReminder(s);
      if ("error" in res && res.error) toast.error(res.error);
      else toast.success("Test reminder sent", { description: `Sent to ${"sentTo" in res ? res.sentTo : "you"}` });
    });
  }
  function insertVar(name: string) {
    set("message", `${s.message} {{${name}}}`.replace(/\s+\{\{/g, " {{"));
  }

  return (
    <div className="space-y-6">
      {/* master status */}
      <div className="flex items-center justify-between rounded-xl border bg-surface px-4 py-4">
        <div>
          <div className="text-sm font-semibold text-ink">Send reminders</div>
          <div className="mt-0.5 text-xs text-muted">Automatically follow up with clients who haven&apos;t left feedback yet.</div>
        </div>
        <Toggle on={s.enabled} onChange={(v) => set("enabled", v)} />
      </div>

      {/* template editor + live preview */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border bg-surface p-4">
          <p className="mb-3 text-xs font-semibold tracking-wider text-faint uppercase">Reminder email</p>
          <label className="field-label">Subject</label>
          <input className="field" value={s.subject} onChange={(e) => set("subject", e.target.value)} />
          <label className="field-label mt-3">Message</label>
          <textarea className="field field-textarea min-h-28" value={s.message} onChange={(e) => set("message", e.target.value)} />
          <label className="field-label mt-3">Button label</label>
          <input className="field" value={s.button_label} onChange={(e) => set("button_label", e.target.value)} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-faint">Insert:</span>
            {REMINDER_PLACEHOLDERS.map((p) => (
              <button key={p} type="button" onClick={() => insertVar(p)} className="rounded-md bg-brand-soft px-2 py-0.5 font-mono text-[0.6875rem] font-semibold text-brand-ink transition-colors hover:brightness-95">
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* live preview */}
        <div className="rounded-xl border bg-surface p-4">
          <p className="mb-3 text-xs font-semibold tracking-wider text-faint uppercase">Live preview</p>
          <div className="rounded-lg border bg-canvas p-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[color:var(--color-border-strong)]" />
              <span className="h-2 w-2 rounded-full bg-[color:var(--color-border-strong)]" />
              <span className="h-2 w-2 rounded-full bg-[color:var(--color-border-strong)]" />
            </div>
            <p className="text-sm font-bold text-ink">{fillTemplate(s.subject, sample) || "Subject…"}</p>
            <p className="mt-0.5 text-xs text-faint">From MarkItUp · to client@email.com</p>
            <p className="mt-3 text-sm whitespace-pre-line text-muted">{fillTemplate(s.message, sample) || "Your message…"}</p>
            <span className="mt-3 inline-block rounded-md px-4 py-2 text-sm font-semibold text-[color:var(--primary-foreground)]" style={{ background: "var(--color-brand)" }}>
              {s.button_label || "Leave feedback"}
            </span>
          </div>
        </div>
      </div>

      {/* cadence + conditions */}
      <div className="overflow-hidden rounded-xl border bg-surface">
        <Row title="Days between reminders" desc="How long to wait before sending the next one.">
          <div className="flex items-center rounded-md border">
            <button type="button" onClick={() => set("days_between", Math.max(1, s.days_between - 1))} className="grid h-8 w-8 place-items-center text-muted hover:text-ink">−</button>
            <span className="w-8 text-center font-mono text-sm tabular-nums">{s.days_between}</span>
            <button type="button" onClick={() => set("days_between", Math.min(30, s.days_between + 1))} className="grid h-8 w-8 place-items-center text-muted hover:text-ink">+</button>
          </div>
        </Row>
        <Row title="Number of reminders" desc="How many follow-ups to send before stopping.">
          <div className="flex items-center rounded-md border">
            <button type="button" onClick={() => set("max_count", Math.max(1, s.max_count - 1))} className="grid h-8 w-8 place-items-center text-muted hover:text-ink">−</button>
            <span className="w-8 text-center font-mono text-sm tabular-nums">{s.max_count}</span>
            <button type="button" onClick={() => set("max_count", Math.min(10, s.max_count + 1))} className="grid h-8 w-8 place-items-center text-muted hover:text-ink">+</button>
          </div>
        </Row>
        <Row title="Stop when the client leaves feedback" desc="Any comment on the file cancels its remaining reminders.">
          <Toggle on={s.stop_on_feedback} onChange={(v) => set("stop_on_feedback", v)} />
        </Row>
        <Row title="Weekdays only" desc="Never send on Saturdays or Sundays.">
          <Toggle on={s.weekdays_only} onChange={(v) => set("weekdays_only", v)} />
        </Row>
        <Row title="CC me on each reminder" desc="Get a copy of every reminder as it goes out.">
          <Toggle on={s.cc_me} onChange={(v) => set("cc_me", v)} />
        </Row>
        <Row title="Notify me when a client never responds" desc="Email you after the final reminder with no feedback.">
          <Toggle on={s.notify_never} onChange={(v) => set("notify_never", v)} />
        </Row>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save changes"}</button>
        <button onClick={test} disabled={testing} className="btn-secondary">{testing ? "Sending…" : "Send test to me"}</button>
      </div>

      {/* scheduled list */}
      <div>
        <h3 className="mb-2 text-xs font-semibold tracking-wider text-faint uppercase">Scheduled reminders</h3>
        {schedules.length === 0 ? (
          <div className="rounded-xl border bg-surface px-4 py-8 text-center text-sm text-faint">
            No reminders scheduled yet. Use <span className="font-semibold text-muted">Send to client</span> on a file to start one.
          </div>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-surface">
            {schedules.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink">{r.recipientName || r.recipientEmail}</div>
                  <div className="truncate text-xs text-faint">
                    {r.mockupName ?? "file"} · {r.sentCount} sent
                    {r.status === "active" && ` · next ${timeAgo(r.nextDueAt)}`}
                  </div>
                </div>
                <span className="chip capitalize" style={statusStyle(r.status)}>{r.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function statusStyle(status: string): React.CSSProperties {
  if (status === "responded") return { background: "var(--color-success-soft)", color: "var(--color-success)" };
  if (status === "done") return { background: "var(--color-brand-soft)", color: "var(--color-brand-ink)" };
  if (status === "stopped") return { background: "var(--color-danger-soft)", color: "var(--color-danger)" };
  return { background: "var(--color-canvas)", color: "var(--color-muted)" };
}
