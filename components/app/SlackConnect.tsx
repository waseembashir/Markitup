"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSlackWebhook, disconnectSlack, sendTestSlack } from "@/app/app/slack-actions";
import { useToast } from "@/components/ui/toast";

export function SlackConnect({ connected }: { connected: boolean }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function connect() {
    if (!url.trim()) return;
    setError(null);
    start(async () => {
      const r = await setSlackWebhook(url);
      if (r?.error) setError(r.error);
      else { setUrl(""); toast.success("Slack connected"); router.refresh(); }
    });
  }
  function disconnect() {
    start(async () => { await disconnectSlack(); toast.success("Slack disconnected"); router.refresh(); });
  }
  function test() {
    start(async () => {
      const r = await sendTestSlack();
      if (r?.error) toast.error(r.error);
      else toast.success("Test message sent to Slack");
    });
  }

  return (
    <div className="card max-w-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-canvas ring-1 ring-border">
            <SlackLogo />
          </span>
          <div>
            <h3 className="font-semibold text-ink">Slack</h3>
            <p className="text-sm text-muted">Get a message in your channel whenever a client comments.</p>
          </div>
        </div>
        {connected && (
          <span className="chip" style={{ background: "var(--success-soft)", color: "var(--success)" }}>Connected</span>
        )}
      </div>

      <div className="mt-4">
        <label htmlFor="slack-webhook" className="field-label">Incoming webhook URL</label>
        <div className="flex flex-wrap gap-2">
          <input
            id="slack-webhook"
            type="password"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={connected ? "Paste a new webhook to replace…" : "https://hooks.slack.com/services/…"}
            className="field min-w-0 flex-1"
          />
          <button onClick={connect} disabled={pending || !url.trim()} className="btn-primary">
            {connected ? "Update" : "Connect"}
          </button>
          {connected && (
            <>
              <button onClick={test} disabled={pending} className="btn-secondary">Send test</button>
              <button onClick={disconnect} disabled={pending} className="btn-secondary">Disconnect</button>
            </>
          )}
        </div>
        {error && <p className="mt-2 text-sm font-medium" style={{ color: "var(--destructive)" }}>{error}</p>}
      </div>
    </div>
  );
}

function SlackLogo() {
  return (
    <svg viewBox="0 0 122.8 122.8" width="20" height="20" aria-hidden>
      <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9z" fill="#E01E5A" />
      <path d="M32.3 77.6c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#E01E5A" />
      <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2z" fill="#36C5F0" />
      <path d="M45.2 32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36C5F0" />
      <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2z" fill="#2EB67D" />
      <path d="M90.5 45.2c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2EB67D" />
      <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9z" fill="#ECB22E" />
      <path d="M77.6 90.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ECB22E" />
    </svg>
  );
}
