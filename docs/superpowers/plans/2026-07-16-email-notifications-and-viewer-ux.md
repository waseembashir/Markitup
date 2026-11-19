# Email Notifications & Viewer UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two viewer UX improvements (hide sidebar in the mockup viewer, floating comment popup on pinning) and four email features (comment notifications, invite emails, welcome email, forgot-password flow) to the deployed MarkUp app.

**Architecture:** A new `lib/email/` module wraps Resend and is called inline (awaited, best-effort) from existing Server Actions after their DB writes succeed; email failure never breaks the action. Password reset uses Supabase's native `resetPasswordForEmail`. The two UI features are client-side changes in the app layout and the mockup viewer.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Supabase (`@supabase/ssr`), Resend, Vitest + Testing Library.

## Global Constraints

- Email sends are best-effort: wrapped in try/catch inside `lib/email`, return a boolean, and NEVER throw into a Server Action. The core action (comment insert, invite, signup) must succeed even if email fails.
- If `RESEND_API_KEY` is unset, `sendEmail` logs a warning and returns `{ ok: false }` — no error. This keeps local dev and the test/e2e environment working without secrets.
- No hard-coded email addresses or URLs in feature code. Use `EMAIL_FROM` (default `onboarding@resend.dev`) and `NEXT_PUBLIC_APP_URL` (default `https://review.apexure.com`).
- Emails are sent one recipient per message (no shared To/CC) so recipients never see each other.
- Follow existing patterns: Server Actions in `"use server"` files returning `{ error }` on failure; tests mock `@/lib/supabase/server` and `next/cache`/`next/navigation` as the existing tests do.
- All existing unit tests (17) must stay green. Run `npx vitest run` before every commit.

---

### Task 1: `lib/email` module (Resend wrapper + templates)

**Files:**
- Modify: `package.json` (add `resend` dependency)
- Create: `lib/email/client.ts`
- Create: `lib/email/send.ts`
- Create: `lib/email/templates.ts`
- Create: `lib/email/send.test.ts`
- Create: `lib/email/templates.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces:
  - `getResend(): Resend | null` (from `client.ts`)
  - `sendEmail(opts: { to: string; subject: string; html: string; text: string }): Promise<{ ok: boolean }>` (from `send.ts`)
  - `EMAIL_FROM: string` (from `send.ts`)
  - `commentNotification(opts: { recipientName: string; commenterName: string; mockupName: string; body: string; mockupId: string }): { subject: string; html: string; text: string }` (from `templates.ts`)
  - `invitation(opts: { inviterName: string; workspaceName: string; isNewUser: boolean }): { subject: string; html: string; text: string }` (from `templates.ts`)
  - `welcome(opts: { name: string }): { subject: string; html: string; text: string }` (from `templates.ts`)

- [ ] **Step 1: Install the Resend SDK**

Run: `npm install resend`
Expected: `resend` appears under `dependencies` in `package.json`.

- [ ] **Step 2: Create the Resend client factory**

Create `lib/email/client.ts`:

```ts
import { Resend } from "resend";

let cached: Resend | null = null;

// Returns a Resend client, or null when no API key is configured (local/dev/test).
// Callers must treat null as "email disabled", not an error.
export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cached) cached = new Resend(key);
  return cached;
}
```

- [ ] **Step 3: Write the failing test for `sendEmail`**

Create `lib/email/send.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();
vi.mock("./client", () => ({
  getResend: () => ({ emails: { send: sendMock } }),
}));

describe("sendEmail", () => {
  beforeEach(() => sendMock.mockReset());

  it("sends via Resend with the configured from address", async () => {
    sendMock.mockResolvedValue({ error: null });
    const { sendEmail, EMAIL_FROM } = await import("./send");
    const res = await sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi" });
    expect(res.ok).toBe(true);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: EMAIL_FROM, to: "a@b.com", subject: "Hi" }),
    );
  });

  it("never throws when Resend rejects", async () => {
    sendMock.mockRejectedValue(new Error("network"));
    const { sendEmail } = await import("./send");
    const res = await sendEmail({ to: "a@b.com", subject: "Hi", html: "x", text: "x" });
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run lib/email/send.test.ts`
Expected: FAIL — `Cannot find module './send'`.

- [ ] **Step 5: Implement `sendEmail`**

Create `lib/email/send.ts`:

```ts
import { getResend } from "./client";

export const EMAIL_FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";

// Best-effort send. Returns { ok } and never throws — email problems must not
// break the Server Action that triggered them.
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean }> {
  const resend = getResend();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set; skipping "${opts.subject}"`);
    return { ok: false };
  }
  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (error) {
      console.error("[email] send failed", error);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email] send threw", e);
    return { ok: false };
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run lib/email/send.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Write the failing test for templates**

Create `lib/email/templates.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { commentNotification, invitation, welcome } from "./templates";

describe("email templates", () => {
  it("commentNotification includes commenter, body and a link to the mockup", () => {
    const t = commentNotification({
      recipientName: "Ravi",
      commenterName: "Jane",
      mockupName: "Homepage",
      body: "Fix the header",
      mockupId: "m123",
    });
    expect(t.subject).toContain("Homepage");
    expect(t.html).toContain("Jane");
    expect(t.html).toContain("Fix the header");
    expect(t.html).toContain("/app/mockups/m123");
    expect(t.text).toContain("Fix the header");
  });

  it("invitation varies the link by new vs existing user", () => {
    const neu = invitation({ inviterName: "Ravi", workspaceName: "Apexure", isNewUser: true });
    const old = invitation({ inviterName: "Ravi", workspaceName: "Apexure", isNewUser: false });
    expect(neu.html).toContain("/signup");
    expect(old.html).toContain("/login");
    expect(neu.subject).toContain("Apexure");
  });

  it("welcome greets the user by name", () => {
    const t = welcome({ name: "Ravi" });
    expect(t.html).toContain("Ravi");
    expect(t.subject.toLowerCase()).toContain("welcome");
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npx vitest run lib/email/templates.test.ts`
Expected: FAIL — `Cannot find module './templates'`.

- [ ] **Step 9: Implement templates**

Create `lib/email/templates.ts`:

```ts
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://review.apexure.com";

function layout(heading: string, bodyHtml: string, cta?: { label: string; href: string }) {
  const button = cta
    ? `<a href="${cta.href}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px;margin-top:16px">${cta.label}</a>`
    : "";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827">
    <div style="font-weight:700;font-size:18px;margin-bottom:16px">MarkUp</div>
    <h1 style="font-size:18px;margin:0 0 12px">${heading}</h1>
    ${bodyHtml}
    ${button}
    <p style="color:#9ca3af;font-size:12px;margin-top:28px">Apexure · Visual review, done right.</p>
  </div>`;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function commentNotification(opts: {
  recipientName: string;
  commenterName: string;
  mockupName: string;
  body: string;
  mockupId: string;
}) {
  const href = `${APP_URL}/app/mockups/${opts.mockupId}`;
  const subject = `New comment on ${opts.mockupName}`;
  const html = layout(
    subject,
    `<p style="margin:0 0 8px"><strong>${esc(opts.commenterName)}</strong> commented:</p>
     <blockquote style="margin:0;padding:10px 14px;background:#f3f4f6;border-radius:8px;font-size:14px">${esc(opts.body)}</blockquote>`,
    { label: "View comment", href },
  );
  const text = `${opts.commenterName} commented on ${opts.mockupName}:\n\n${opts.body}\n\n${href}`;
  return { subject, html, text };
}

export function invitation(opts: {
  inviterName: string;
  workspaceName: string;
  isNewUser: boolean;
}) {
  const href = opts.isNewUser ? `${APP_URL}/signup` : `${APP_URL}/login`;
  const subject = `${opts.inviterName} invited you to ${opts.workspaceName}`;
  const html = layout(
    subject,
    `<p style="margin:0;font-size:14px"><strong>${esc(opts.inviterName)}</strong> invited you to collaborate in <strong>${esc(opts.workspaceName)}</strong> on MarkUp — upload mockups, drop pins, and review designs together.</p>`,
    { label: opts.isNewUser ? "Create your account" : "Open MarkUp", href },
  );
  const text = `${opts.inviterName} invited you to ${opts.workspaceName} on MarkUp.\n\n${href}`;
  return { subject, html, text };
}

export function welcome(opts: { name: string }) {
  const href = `${APP_URL}/app`;
  const subject = "Welcome to MarkUp";
  const html = layout(
    `Welcome, ${esc(opts.name)}!`,
    `<p style="margin:0;font-size:14px">Your workspace is ready. Create a project, upload a mockup, and share a link to start collecting pinned feedback.</p>`,
    { label: "Go to your workspace", href },
  );
  const text = `Welcome to MarkUp, ${opts.name}!\n\nGet started: ${href}`;
  return { subject, html, text };
}
```

- [ ] **Step 10: Run templates test to verify it passes**

Run: `npx vitest run lib/email/templates.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 11: Document the env vars**

Append to `.env.example`:

```bash

# Resend transactional email (Dashboard -> API Keys). If unset, emails are skipped (logged).
RESEND_API_KEY=
# Sender address. Use onboarding@resend.dev until a domain is verified in Resend.
EMAIL_FROM=onboarding@resend.dev
# Public base URL used to build links inside emails and the password-reset redirect.
NEXT_PUBLIC_APP_URL=https://review.apexure.com
```

- [ ] **Step 12: Run full suite and commit**

Run: `npx vitest run`
Expected: all pass.

```bash
git add package.json package-lock.json lib/email .env.example
git commit -m "feat(email): add lib/email Resend wrapper and templates"
```

---

### Task 2: Hide sidebar in the mockup viewer

**Files:**
- Create: `components/app/AppChrome.tsx`
- Create: `components/app/AppChrome.test.tsx`
- Modify: `app/app/layout.tsx`

**Interfaces:**
- Consumes: `AppSidebar` (existing) with props `{ workspaceName, userName, userEmail }`.
- Produces: `AppChrome` client component with props `{ workspaceName: string; userName: string; userEmail: string; children: React.ReactNode }`.

- [ ] **Step 1: Write the failing test**

Create `components/app/AppChrome.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const pathnameMock = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => pathnameMock() }));
vi.mock("./AppSidebar", () => ({
  AppSidebar: () => <nav data-testid="sidebar" />,
}));

import { AppChrome } from "./AppChrome";

describe("AppChrome", () => {
  it("shows the sidebar on normal app routes", () => {
    pathnameMock.mockReturnValue("/app");
    render(<AppChrome workspaceName="W" userName="U" userEmail="e"><div /></AppChrome>);
    expect(screen.queryByTestId("sidebar")).not.toBeNull();
  });

  it("hides the sidebar on the mockup viewer route", () => {
    pathnameMock.mockReturnValue("/app/mockups/abc");
    render(<AppChrome workspaceName="W" userName="U" userEmail="e"><div /></AppChrome>);
    expect(screen.queryByTestId("sidebar")).toBeNull();
    // a reveal toggle is available instead
    expect(screen.getByRole("button", { name: /menu|sidebar/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/app/AppChrome.test.tsx`
Expected: FAIL — `Cannot find module './AppChrome'`.

- [ ] **Step 3: Implement `AppChrome`**

Create `components/app/AppChrome.tsx`:

```tsx
"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "./AppSidebar";

export function AppChrome({
  workspaceName,
  userName,
  userEmail,
  children,
}: {
  workspaceName: string;
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isViewer = (pathname ?? "").startsWith("/app/mockups/");
  const [reveal, setReveal] = useState(false);
  const showSidebar = !isViewer || reveal;

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {showSidebar && (
        <AppSidebar workspaceName={workspaceName} userName={userName} userEmail={userEmail} />
      )}
      <div className="relative flex-1 overflow-y-auto">
        {isViewer && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? "Hide sidebar" : "Show sidebar menu"}
            className="absolute bottom-4 left-4 z-50 grid h-9 w-9 place-items-center rounded-full border bg-surface text-muted shadow-lg transition-colors hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/app/AppChrome.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire `AppChrome` into the layout**

In `app/app/layout.tsx`, replace the returned JSX (the `<div className="flex h-screen …">` block) and swap the import. New file body:

```tsx
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "./actions";
import { AppChrome } from "@/components/app/AppChrome";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const ws = await getCurrentWorkspace();

  const userName = (data.user.user_metadata?.name as string) || "";
  const userEmail = data.user.email ?? "";

  return (
    <AppChrome
      workspaceName={ws?.name ?? "MarkUp"}
      userName={userName}
      userEmail={userEmail}
    >
      {children}
    </AppChrome>
  );
}
```

- [ ] **Step 6: Verify build + full suite**

Run: `npm run build && npx vitest run`
Expected: build succeeds; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add components/app/AppChrome.tsx components/app/AppChrome.test.tsx app/app/layout.tsx
git commit -m "feat(viewer): hide workspace sidebar on the mockup viewer with a reveal toggle"
```

---

### Task 3: Floating comment popup when dropping a pin

**Files:**
- Create: `components/viewer/PinComposer.tsx`
- Modify: `components/viewer/MockupViewer.tsx` (pin-create flow + render)
- Modify: `components/viewer/MockupViewer.test.tsx` (keep green; add popup assertion)

**Interfaces:**
- Consumes: `createPin(mockupId, x, y)` and `addComment(mockupId, pinId, body)` from `@/app/app/mockups/[mockupId]/actions` (existing).
- Produces: `PinComposer` component with props `{ xPct: number; yPct: number; onCancel: () => void; onSubmit: (body: string) => void; pending: boolean }` where `xPct`/`yPct` are 0–100 positions within the image box.

- [ ] **Step 1: Implement `PinComposer` (presentational popup)**

Create `components/viewer/PinComposer.tsx`:

```tsx
"use client";

import { useState } from "react";

export function PinComposer({
  xPct,
  yPct,
  onCancel,
  onSubmit,
  pending,
}: {
  xPct: number;
  yPct: number;
  onCancel: () => void;
  onSubmit: (body: string) => void;
  pending: boolean;
}) {
  const [body, setBody] = useState("");
  return (
    <div
      className="absolute z-50 w-72 -translate-x-1/2 rounded-xl border bg-surface p-3 shadow-xl"
      style={{ left: `${xPct}%`, top: `${yPct}%`, marginTop: "14px" }}
      onClick={(e) => e.stopPropagation()}
    >
      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add comment here…"
        rows={3}
        className="field w-full resize-none text-sm"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && body.trim()) onSubmit(body.trim());
          if (e.key === "Escape") onCancel();
        }}
      />
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary btn-sm">Cancel</button>
        <button
          type="button"
          disabled={pending || !body.trim()}
          onClick={() => onSubmit(body.trim())}
          className="btn-primary btn-sm"
        >
          {pending ? "Saving…" : "Comment"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Change the viewer pin flow to open the popup instead of creating an empty pin**

In `components/viewer/MockupViewer.tsx`:

(a) Add the import near the other component imports:

```tsx
import { PinComposer } from "./PinComposer";
import { createPin, addComment } from "@/app/app/mockups/[mockupId]/actions";
```
(replace the existing `import { createPin } from "@/app/app/mockups/[mockupId]/actions";` line).

(b) Add draft state next to the other `useState` hooks (after the `zoomOpen` state):

```tsx
const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
const [savingPin, setSavingPin] = useState(false);
```

(c) Replace the whole `handleImageClick` function with a version that only records where the user clicked (no DB write yet):

```tsx
function handleImageClick(e: React.MouseEvent<HTMLImageElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  const { x, y } = toNormalized(e.clientX, e.clientY, rect);
  setActivePinId(null);
  setDraft({ x, y });
}

async function saveDraft(body: string) {
  if (!draft) return;
  setSavingPin(true);
  const res = await createPin(mockupId, draft.x, draft.y);
  if (res.id && res.number != null) {
    await addComment(mockupId, res.id, body);
    const pin: ViewerPin = {
      id: res.id,
      x: draft.x,
      y: draft.y,
      number: res.number,
      status: "active",
      comments: [
        {
          id: `tmp-${res.id}`,
          body,
          authorName: "You",
          parentCommentId: null,
          createdAt: new Date().toISOString(),
        },
      ],
    };
    setPins((p) => [...p, pin]);
  }
  setSavingPin(false);
  setDraft(null);
}
```

> Note: `new Date().toISOString()` runs in the browser here (client component), which is fine — this rule only blocks it in workflow scripts, not app code.

(d) Render the popup inside the image wrapper. Immediately after the `visiblePins.map(... PinMarker ...)` block (before the closing `</div>` of `<div className="relative shrink-0" …>`), add:

```tsx
{draft && (
  <PinComposer
    xPct={draft.x * 100}
    yPct={draft.y * 100}
    pending={savingPin}
    onCancel={() => setDraft(null)}
    onSubmit={saveDraft}
  />
)}
```

- [ ] **Step 3: Update the viewer test to assert the popup appears on click**

In `components/viewer/MockupViewer.test.tsx`, add a test that clicking the image shows the composer. Append inside the existing `describe`:

```tsx
it("opens a comment popup when the image is clicked", async () => {
  const { MockupViewer } = await import("./MockupViewer");
  const { render, screen, fireEvent } = await import("@testing-library/react");
  render(
    <MockupViewer
      mockupId="m1"
      imageUrl="http://x/y.png"
      imageName="y.png"
      initialPins={[]}
      siblings={[{ id: "m1" }]}
      members={[]}
    />,
  );
  const img = screen.getByAltText("mockup");
  fireEvent.load(img);
  fireEvent.click(img);
  expect(screen.getByPlaceholderText(/add comment here/i)).toBeTruthy();
});
```

> If the existing test file already imports `render`/`screen` at the top, reuse those imports instead of the inline `await import` and delete the local import line.

- [ ] **Step 4: Run the viewer test**

Run: `npx vitest run components/viewer/MockupViewer.test.tsx`
Expected: PASS (existing test + new popup test).

- [ ] **Step 5: Verify build + full suite**

Run: `npm run build && npx vitest run`
Expected: build succeeds; all pass.

- [ ] **Step 6: Commit**

```bash
git add components/viewer/PinComposer.tsx components/viewer/MockupViewer.tsx components/viewer/MockupViewer.test.tsx
git commit -m "feat(viewer): floating comment popup on pin drop; pin persists only on save"
```

---

### Task 4: Welcome email on signup

**Files:**
- Modify: `app/auth/actions.ts` (`signUp`)
- Create: `app/auth/welcome-email.test.ts`

**Interfaces:**
- Consumes: `sendEmail`, `welcome` from `@/lib/email/send` and `@/lib/email/templates`.

- [ ] **Step 1: Write the failing test**

Create `app/auth/welcome-email.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

const sendEmail = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/lib/email/send", () => ({ sendEmail, EMAIL_FROM: "x" }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { signUp: async () => ({ error: null }) },
  }),
}));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("REDIRECT"); } }));

describe("signUp welcome email", () => {
  it("attempts a welcome email after a successful signup", async () => {
    const { signUp } = await import("./actions");
    const fd = new FormData();
    fd.set("name", "Ravi");
    fd.set("email", "ravi@x.com");
    fd.set("password", "password123");
    await expect(signUp(fd)).rejects.toThrow("REDIRECT");
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: "ravi@x.com" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/auth/welcome-email.test.ts`
Expected: FAIL — `sendEmail` not called (0 times).

- [ ] **Step 3: Send the welcome email in `signUp`**

In `app/auth/actions.ts`, add imports at the top (after the existing imports):

```ts
import { sendEmail } from "@/lib/email/send";
import { welcome } from "@/lib/email/templates";
```

Then in `signUp`, replace the success tail so it sends before redirecting:

```ts
export async function signUp(formData: FormData) {
  const name = String(formData.get("name"));
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) return { error: error.message };

  // Best-effort welcome email; never blocks or fails the signup.
  try {
    const tpl = welcome({ name: name || email });
    await sendEmail({ to: email, ...tpl });
  } catch (e) {
    console.error("[signup] welcome email failed", e);
  }

  redirect(safeNext(formData));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/auth/welcome-email.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full suite and commit**

Run: `npx vitest run`
Expected: all pass (existing `app/auth/actions.test.ts` still green).

```bash
git add app/auth/actions.ts app/auth/welcome-email.test.ts
git commit -m "feat(auth): send welcome email after signup"
```

---

### Task 5: Comment notification email

**Files:**
- Modify: `app/app/mockups/[mockupId]/actions.ts` (`addComment`)
- Create: `app/app/mockups/comment-notify.test.ts`

**Interfaces:**
- Consumes: `sendEmail` (`@/lib/email/send`), `commentNotification` (`@/lib/email/templates`).
- Recipient lookup uses `workspace_members` and `project_members` joined to `profiles(id, name, email)`, matching the pattern already in `app/app/mockups/[mockupId]/page.tsx`.

- [ ] **Step 1: Write the failing test**

Create `app/app/mockups/comment-notify.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendEmail = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/lib/email/send", () => ({ sendEmail, EMAIL_FROM: "x" }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// Supabase mock: author is u1; workspace has u1 (author) + u2; project has u3.
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", user_metadata: { name: "Author" }, email: "author@x.com" } } }) },
    from: (table: string) => {
      if (table === "comments") return { insert: async () => ({ error: null }) };
      if (table === "mockups") return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { name: "Homepage", project_id: "p1", projects: { workspace_id: "w1" } } }) }) }),
      };
      if (table === "workspace_members") return {
        select: () => ({ eq: async () => ({ data: [
          { profiles: { id: "u1", name: "Author", email: "author@x.com" } },
          { profiles: { id: "u2", name: "Teammate", email: "team@x.com" } },
        ] }) }),
      };
      if (table === "project_members") return {
        select: () => ({ eq: async () => ({ data: [
          { profiles: { id: "u3", name: "Client", email: "client@x.com" } },
        ] }) }),
      };
      return { select: () => ({ eq: async () => ({ data: [] }) }) };
    },
  }),
}));

describe("addComment notifications", () => {
  beforeEach(() => sendEmail.mockClear());

  it("emails every member except the author", async () => {
    const { addComment } = await import("./[mockupId]/actions");
    await addComment("m1", "pin1", "Please fix the header");
    const recipients = sendEmail.mock.calls.map((c) => c[0].to).sort();
    expect(recipients).toEqual(["client@x.com", "team@x.com"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/app/mockups/comment-notify.test.ts`
Expected: FAIL — `sendEmail` not called.

- [ ] **Step 3: Add notification logic to `addComment`**

In `app/app/mockups/[mockupId]/actions.ts`, add imports at top:

```ts
import { sendEmail } from "@/lib/email/send";
import { commentNotification } from "@/lib/email/templates";
```

Replace the `addComment` function with:

```ts
export async function addComment(
  mockupId: string,
  pinId: string,
  body: string,
  parentCommentId?: string,
) {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const author = userData.user!;
  const { error } = await supabase.from("comments").insert({
    pin_id: pinId,
    author_id: author.id,
    body,
    parent_comment_id: parentCommentId ?? null,
  });
  if (error) return { error: error.message };

  // Best-effort: notify the team (everyone but the author). Never fail the comment.
  try {
    const { data: mk } = await supabase
      .from("mockups")
      .select("name, project_id, projects(workspace_id)")
      .eq("id", mockupId)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workspaceId = (mk as any)?.projects?.workspace_id as string | undefined;
    const projectId = mk?.project_id as string | undefined;
    if (mk && (workspaceId || projectId)) {
      const [{ data: wm }, { data: pm }] = await Promise.all([
        supabase.from("workspace_members").select("profiles(id, name, email)").eq("workspace_id", workspaceId ?? ""),
        supabase.from("project_members").select("profiles(id, name, email)").eq("project_id", projectId ?? ""),
      ]);
      const recipients = new Map<string, { name: string; email: string }>();
      for (const row of [...(wm ?? []), ...(pm ?? [])]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = (row as any).profiles;
        if (p?.id && p.id !== author.id && p.email) {
          recipients.set(p.email, { name: p.name ?? "there", email: p.email });
        }
      }
      const commenterName = (author.user_metadata?.name as string) || author.email || "Someone";
      for (const r of recipients.values()) {
        const tpl = commentNotification({
          recipientName: r.name,
          commenterName,
          mockupName: mk.name as string,
          body,
          mockupId,
        });
        await sendEmail({ to: r.email, ...tpl });
      }
    }
  } catch (e) {
    console.error("[comment] notification failed", e);
  }

  revalidatePath(`/app/mockups/${mockupId}`);
  return {};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/app/mockups/comment-notify.test.ts`
Expected: PASS (recipients are exactly team + client, not the author).

- [ ] **Step 5: Run full suite and commit**

Run: `npx vitest run`
Expected: all pass.

```bash
git add app/app/mockups/[mockupId]/actions.ts app/app/mockups/comment-notify.test.ts
git commit -m "feat(comments): email the team (not the author) when a comment is posted"
```

---

### Task 6: Invite emails

**Files:**
- Modify: `app/app/mockups/[mockupId]/share-actions.ts` (`inviteToProject`)
- Modify: `app/app/actions.ts` (`addMemberByEmail`)
- Create: `app/app/invite-email.test.ts`

**Interfaces:**
- Consumes: `sendEmail` (`@/lib/email/send`), `invitation` (`@/lib/email/templates`).

- [ ] **Step 1: Write the failing test**

Create `app/app/invite-email.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendEmail = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/lib/email/send", () => ({ sendEmail, EMAIL_FROM: "x" }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", user_metadata: { name: "Ravi" } } } }) },
    rpc: async () => ({ data: null }), // no existing profile -> invitation path
    from: (table: string) => {
      if (table === "workspaces") return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "w1", name: "Apexure" } }) }) }),
      };
      if (table === "workspace_members") return {
        select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { workspace_id: "w1", workspaces: { id: "w1", name: "Apexure" } } }) }) }) }),
      };
      return { insert: async () => ({ error: null }) };
    },
  }),
}));

describe("addMemberByEmail invite email", () => {
  beforeEach(() => sendEmail.mockClear());
  it("emails a brand-new invitee", async () => {
    const { addMemberByEmail } = await import("./actions");
    const fd = new FormData();
    fd.set("email", "new@client.com");
    const res = await addMemberByEmail(fd);
    expect(res.invited).toBe(true);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0][0].to).toBe("new@client.com");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/app/invite-email.test.ts`
Expected: FAIL — `sendEmail` not called.

- [ ] **Step 3: Send invite email in `addMemberByEmail`**

In `app/app/actions.ts`, add imports at top:

```ts
import { sendEmail } from "@/lib/email/send";
import { invitation } from "@/lib/email/templates";
```

In `addMemberByEmail`, add a best-effort email to BOTH branches. Replace the `if (profileId) { … } … return { invited: true }` tail with:

```ts
  const inviterName = (userData.user?.user_metadata?.name as string) || "A teammate";

  if (profileId) {
    const { error } = await supabase
      .from("workspace_members")
      .insert({ workspace_id: ws.id, user_id: profileId, role: "member" });
    if (error) return { error: error.message };
    try {
      const tpl = invitation({ inviterName, workspaceName: ws.name, isNewUser: false });
      await sendEmail({ to: email, ...tpl });
    } catch (e) {
      console.error("[invite] email failed", e);
    }
    revalidatePath("/app/members");
    return { invited: false };
  }

  const { error } = await supabase
    .from("invitations")
    .insert({ workspace_id: ws.id, email, invited_by: userData.user!.id });
  if (error) return { error: error.message };
  try {
    const tpl = invitation({ inviterName, workspaceName: ws.name, isNewUser: true });
    await sendEmail({ to: email, ...tpl });
  } catch (e) {
    console.error("[invite] email failed", e);
  }
  revalidatePath("/app/members");
  return { invited: true };
```

- [ ] **Step 4: Send invite email in `inviteToProject`**

In `app/app/mockups/[mockupId]/share-actions.ts`, add imports at top:

```ts
import { sendEmail } from "@/lib/email/send";
import { invitation } from "@/lib/email/templates";
```

`mockupContext` already returns `workspaceName`. Update `inviteToProject` to destructure it and email on both branches. Change the context destructure and both returns:

```ts
  const { supabase, projectId, workspaceId, workspaceName } = await mockupContext(mockupId);
  if (!projectId || !workspaceId) return { error: "Mockup not found" };
  const { data: userData } = await supabase.auth.getUser();
  const inviterName = (userData.user?.user_metadata?.name as string) || "A teammate";

  const { data: profileId } = await supabase.rpc("find_profile_id_by_email", { p_email: clean });

  if (profileId) {
    const { error } = await supabase
      .from("project_members")
      .insert({ project_id: projectId, user_id: profileId, role: "reviewer" });
    if (error && !/duplicate|unique/i.test(error.message)) return { error: error.message };
    try {
      await sendEmail({ to: clean, ...invitation({ inviterName, workspaceName, isNewUser: false }) });
    } catch (e) { console.error("[invite] email failed", e); }
    revalidatePath(`/app/mockups/${mockupId}`);
    return { invited: false as const };
  }

  const { error } = await supabase.from("invitations").insert({
    workspace_id: workspaceId,
    project_id: projectId,
    email: clean,
    role: "reviewer",
    invited_by: userData.user!.id,
  });
  if (error) return { error: error.message };
  try {
    await sendEmail({ to: clean, ...invitation({ inviterName, workspaceName, isNewUser: true }) });
  } catch (e) { console.error("[invite] email failed", e); }
  revalidatePath(`/app/mockups/${mockupId}`);
  return { invited: true as const };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run app/app/invite-email.test.ts`
Expected: PASS.

- [ ] **Step 6: Run full suite and commit**

Run: `npx vitest run`
Expected: all pass (existing `app/app/members.test.ts` still green).

```bash
git add app/app/actions.ts app/app/mockups/[mockupId]/share-actions.ts app/app/invite-email.test.ts
git commit -m "feat(invites): email invitees from workspace and project invite flows"
```

---

### Task 7: Forgot-password recovery flow

**Files:**
- Modify: `app/auth/actions.ts` (add `requestPasswordReset` action)
- Create: `app/forgot-password/page.tsx`
- Create: `app/reset-password/page.tsx`
- Modify: `app/login/page.tsx` (add "Forgot password?" link)
- Create: `app/auth/reset.test.ts`

**Interfaces:**
- Consumes: `AuthShell`, `AuthLink` (`@/components/auth/AuthShell`), `AuthForm` (`@/components/auth/AuthForm`), `createBrowserSupabase` (`@/lib/supabase/client`).
- Produces: `requestPasswordReset(prevState: { error?: string; sent?: boolean }, formData: FormData): Promise<{ error?: string; sent?: boolean }>`.

- [ ] **Step 1: Write the failing test for `requestPasswordReset`**

Create `app/auth/reset.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

const resetMock = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { resetPasswordForEmail: resetMock },
  }),
}));

describe("requestPasswordReset", () => {
  it("returns a neutral sent state and calls Supabase with a redirect", async () => {
    const { requestPasswordReset } = await import("./actions");
    const fd = new FormData();
    fd.set("email", "ravi@x.com");
    const res = await requestPasswordReset({}, fd);
    expect(res.sent).toBe(true);
    expect(resetMock).toHaveBeenCalledWith(
      "ravi@x.com",
      expect.objectContaining({ redirectTo: expect.stringContaining("/reset-password") }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/auth/reset.test.ts`
Expected: FAIL — `requestPasswordReset` is not exported.

- [ ] **Step 3: Add the `requestPasswordReset` action**

In `app/auth/actions.ts`, add near the bottom (after `signUpAction`):

```ts
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://review.apexure.com";

export async function requestPasswordReset(
  _prev: { error?: string; sent?: boolean },
  formData: FormData,
): Promise<{ error?: string; sent?: boolean }> {
  const email = String(formData.get("email")).trim().toLowerCase();
  if (!email) return { error: "Enter your email address" };
  const supabase = await createServerSupabase();
  // Ignore the result to avoid revealing whether an account exists.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${APP_URL}/reset-password`,
  });
  return { sent: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/auth/reset.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the forgot-password page**

Create `app/forgot-password/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/auth/actions";
import { AuthShell, AuthLink } from "@/components/auth/AuthShell";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, {});
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
      footer={<>Remembered it? <AuthLink href="/login">Back to log in</AuthLink></>}
    >
      {state.sent ? (
        <p className="text-sm text-muted" role="status">
          If an account exists for that email, a reset link is on its way. Check your inbox.
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="field-label">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" placeholder="you@agency.com" required className="field" />
          </div>
          {state.error && (
            <p className="text-sm font-medium" style={{ color: "var(--color-danger)" }} role="alert">{state.error}</p>
          )}
          <button type="submit" disabled={pending} className="btn-primary mt-1 w-full disabled:opacity-70">
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
```

- [ ] **Step 6: Build the reset-password page**

Create `app/reset-password/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { AuthShell, AuthLink } from "@/components/auth/AuthShell";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const supabase = createBrowserSupabase();
    // Supabase established a recovery session from the link's tokens on load.
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/app");
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Enter a new password for your account."
      footer={<>Changed your mind? <AuthLink href="/login">Back to log in</AuthLink></>}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="password" className="field-label">New password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 6 characters"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
          />
        </div>
        {error && (
          <p className="text-sm font-medium" style={{ color: "var(--color-danger)" }} role="alert">{error}</p>
        )}
        <button type="submit" disabled={pending} className="btn-primary mt-1 w-full disabled:opacity-70">
          {pending ? "Saving…" : "Update password"}
        </button>
      </form>
    </AuthShell>
  );
}
```

- [ ] **Step 7: Add the "Forgot password?" link to the login page**

In `app/login/page.tsx`, inside the password `<div>` (rendered as a child of `AuthForm`), add a link under the password field. Replace the password `<div>` block with:

```tsx
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="field-label">Password</label>
            <AuthLink href="/forgot-password">Forgot password?</AuthLink>
          </div>
          <input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required className="field" />
        </div>
```

(`AuthLink` is already imported in `app/login/page.tsx`.)

- [ ] **Step 8: Verify build + full suite**

Run: `npm run build && npx vitest run`
Expected: build succeeds (routes `/forgot-password` and `/reset-password` listed); all tests pass.

- [ ] **Step 9: Commit**

```bash
git add app/auth/actions.ts app/forgot-password/page.tsx app/reset-password/page.tsx app/login/page.tsx app/auth/reset.test.ts
git commit -m "feat(auth): forgot-password request + reset-password pages"
```

---

### Task 8: Wire-up docs, Vercel env, and manual verification

**Files:**
- Modify: `README.md` (add an "Email (Resend)" section and env var docs)

- [ ] **Step 1: Document email setup in the README**

Add a section to `README.md` after the Supabase setup steps:

```markdown
## Email notifications (Resend)

Transactional email (comment notifications, invites, welcome) is sent via
[Resend](https://resend.com). Password-reset emails are sent by Supabase.

1. Create a Resend account and an API key.
2. Set these env vars (locally in `.env.local`, and in Vercel → Settings →
   Environment Variables for Production/Preview):
   - `RESEND_API_KEY` — your Resend API key.
   - `EMAIL_FROM` — sender address. Use `onboarding@resend.dev` until you
     verify a domain; then set e.g. `notifications@apexure.com`.
   - `NEXT_PUBLIC_APP_URL` — your live URL, e.g. `https://review.apexure.com`.
3. In Supabase → Authentication → URL Configuration, add
   `https://<your-app>/reset-password` to the Redirect URLs.
4. **Go-live:** verify `apexure.com` in Resend (add the DNS records it shows),
   then set `EMAIL_FROM=notifications@apexure.com`. Until then, Resend only
   delivers to your own verified address.

If `RESEND_API_KEY` is unset, the app runs normally and email sends are skipped
(logged as warnings), so local dev and tests need no email config.
```

- [ ] **Step 2: Commit the docs**

```bash
git add README.md
git commit -m "docs: document Resend email setup and reset-password redirect URL"
```

- [ ] **Step 3: Manual verification checklist (performed by the user, guided step-by-step)**

These require live secrets and cannot be unit-tested. Confirm each after adding the three env vars in Vercel and redeploying:

- [ ] Add `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL` in Vercel → redeploy.
- [ ] Add `${APP_URL}/reset-password` to Supabase Auth Redirect URLs.
- [ ] Sign up a new account → welcome email arrives (at your Resend-verified address during test phase).
- [ ] Open a mockup, drop a pin → popup appears; save → pin + comment created.
- [ ] Post a comment as one user → the other member receives a notification email.
- [ ] Invite a member by email → invite email arrives.
- [ ] Use "Forgot password?" → reset email arrives → reset link opens `/reset-password` → new password works.
- [ ] Open a mockup → sidebar is hidden; the reveal toggle shows it.

---

## Self-Review

**Spec coverage:**
- ① Hide sidebar → Task 2. ✅
- ② Comment popup on pin → Task 3. ✅
- ③ Comment notification email → Task 5. ✅
- ④ Invite email → Task 6 (both workspace + project invite paths). ✅
- ⑤ Forgot password → Task 7. ✅
- ⑥ Welcome email → Task 4. ✅
- Shared `lib/email` module + env vars → Task 1. ✅
- External setup / go-live docs → Task 8. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✅

**Type consistency:** `sendEmail({ to, subject, html, text })` used identically in Tasks 4–7; template functions return `{ subject, html, text }` and are always spread as `...tpl` after `to`. `invitation` always receives `{ inviterName, workspaceName, isNewUser }`. `requestPasswordReset` signature matches its `useActionState` usage in the forgot-password page. ✅

**Ordering note:** Tasks 2–3 (UI) have no dependency on Resend/env and can ship first; Tasks 4–7 depend only on Task 1 (the `lib/email` module), not on live secrets (sends no-op without a key). ✅
