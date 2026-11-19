# Design: Email Notifications & Viewer UX

Date: 2026-07-16
Status: Approved (design), pending implementation plan

## Overview

Six enhancements to the deployed MarkUp app, grouped into two areas:

**Viewer UX (no new infrastructure):**
1. Hide the workspace sidebar when a mockup is open, giving the viewer full width.
2. Show a floating comment popup at the pin location when a user drops a new pin.

**Email subsystem (new `lib/email` module backed by Resend):**
3. Email the team when a new comment is posted.
4. Email an invitee when they are invited to a project.
5. Forgot-password recovery flow.
6. Welcome email on signup.

## Decisions (from brainstorming)

- **Email provider:** Resend. Start with its test domain (`onboarding@resend.dev`); the
  "from" address and app URL are environment variables, so going live for real clients is
  a config change (verify `apexure.com` in Resend, flip `EMAIL_FROM`) plus DNS, not a code change.
- **Email architecture:** send inline from Server Actions via a small `lib/email` module,
  fire-and-forget. Email failure must never break the underlying action (comment still posts,
  invite still records) — failures are caught and logged only.
- **Comment recipients:** all workspace/project members **except** the comment author.
- **Password reset:** uses Supabase's native `resetPasswordForEmail` (only Supabase can mint the
  reset token). Delivery is via Supabase's mailer; pointing Supabase SMTP at Resend is an
  optional go-live step, not required to build.

## Constraints during the Resend test-domain phase

Until `apexure.com` is verified in Resend, custom emails (comment/invite/welcome) reliably
deliver only to the account owner's own verified address. This is accepted for building and
testing. The design must not hard-code any address so the switch to production is trivial.

## Architecture

### Shared plumbing: `lib/email/`

- `lib/email/client.ts` — lazily constructs the Resend client from `RESEND_API_KEY`. If the key
  is missing, `sendEmail` becomes a no-op that logs a warning (so local/dev without a key does
  not error).
- `lib/email/send.ts` — `sendEmail({ to, subject, html, text })`. Wraps the Resend call in
  try/catch, returns `{ ok: boolean }`, never throws. Uses `EMAIL_FROM` for the sender.
- `lib/email/templates.ts` — pure functions returning `{ subject, html, text }` for each email
  type: `commentNotification`, `invitation`, `welcome`. Password-reset content is rendered by
  Supabase, not here. Templates are plain, inline-styled HTML (no external assets) consistent
  with the app's brand.
- All recipient lookups and sends happen **after** the core DB write succeeds and are not awaited
  in a way that blocks the user response beyond a best-effort attempt; any error is caught.

### Environment variables (new)

| Name | Purpose | Default |
|------|---------|---------|
| `RESEND_API_KEY` | Resend API key (server-only) | none — if unset, sends are skipped with a log |
| `EMAIL_FROM` | Sender address | `onboarding@resend.dev` |
| `NEXT_PUBLIC_APP_URL` | Base URL used to build links in emails and reset redirects | `https://review.apexure.com` |

### Feature 1 — Hide sidebar in the mockup viewer

`app/app/layout.tsx` currently renders `<AppSidebar />` for every `/app/*` route. The mockup
viewer route `/app/mockups/[mockupId]` should not show it.

Approach: introduce a small client component `components/app/AppChrome.tsx` that reads the current
pathname (`usePathname`) and, on `/app/mockups/*` routes, either hides the sidebar or renders it
collapsed behind a toggle. The shared layout renders `AppChrome` around `children`. A slim toggle
button lets the user reveal the sidebar if they want it. No route data changes; purely layout.

### Feature 2 — Comment popup when pinning

Current flow (`components/viewer/MockupViewer.tsx`): clicking the image calls `createPin`,
producing an empty "Pin #N" whose comment is then typed in the sidebar thread.

New flow: clicking the image shows a **floating popup anchored at the click point** containing a
comment textarea plus Save / Cancel. On Save, create the pin and its first comment together
(`createPin` then `addComment`), then close the popup. On Cancel, no pin is created (the pin is
only persisted on Save, so nothing to clean up). Existing pins continue to open in the sidebar
thread as today. The popup lives inside `MockupViewer.tsx`; internals to be read during planning.
`MockupViewer.tsx` is large (~447 lines) — if the popup logic pushes it further, extract the
popup into its own component (`components/viewer/PinComposer.tsx`).

### Feature 3 — Comment notification email

Hook in `addComment` (`app/app/mockups/[mockupId]/actions.ts`). After the comment insert
succeeds:
- Resolve the mockup's workspace and project, and gather member profiles (id, name, email) from
  `workspace_members` and `project_members`.
- Exclude the author (`userData.user.id`). De-duplicate by email.
- Send each recipient the `commentNotification` email: subject "New comment on {mockup name}",
  body includes commenter name, the comment text, and a link to
  `${APP_URL}/app/mockups/{mockupId}`.
- Errors caught; the comment already succeeded regardless.

### Feature 4 — Invite email

Hook in `inviteToProject` (`app/app/mockups/[mockupId]/share-actions.ts`) and `addMemberByEmail`
(`app/app/actions.ts`). After recording the membership/invitation, send the invitee the
`invitation` email: subject "{Inviter} invited you to {workspace}", body links to
`${APP_URL}/login` (existing users) or `${APP_URL}/signup` (new emails). Both the
already-a-member path and the new-invitation path send the email.

### Feature 5 — Forgot password

- Add a "Forgot password?" `AuthLink` on the login page.
- New route `app/forgot-password/page.tsx` — email field; a server action calls
  `supabase.auth.resetPasswordForEmail(email, { redirectTo: ${APP_URL}/reset-password })`.
  Always shows a neutral "If that email exists, we've sent a link" message (no account
  enumeration).
- New route `app/reset-password/page.tsx` — client page; on load Supabase establishes a recovery
  session from the URL. User enters a new password; a call to `supabase.auth.updateUser({
  password })` sets it, then redirects to `/app`.
- Add `${APP_URL}/reset-password` to Supabase Auth redirect URLs (documented go-live step).
- Errors surfaced via the same `AuthForm` error pattern introduced for login/signup.

### Feature 6 — Welcome email

Hook in `signUp` (`app/auth/actions.ts`) after a successful `signUp` (before the redirect).
Send the new user the `welcome` email: subject "Welcome to MarkUp", short branded intro plus a
link to `${APP_URL}/app`. Caught/logged; signup proceeds regardless.

## Error handling

- Every email send is best-effort: wrapped in try/catch inside `lib/email`, returns a boolean,
  never throws into the calling Server Action.
- Missing `RESEND_API_KEY` disables sending with a single warning log rather than erroring —
  keeps local dev and tests working without secrets.
- Auth flows (reset, signup) surface user-facing errors through the existing `AuthForm`
  `useActionState` error display.

## Testing

- `lib/email` unit tests: mock the Resend client; assert `sendEmail` builds the correct
  from/to/subject and swallows thrown errors (returns `{ ok: false }`).
- Template unit tests: assert each template includes the key dynamic fields (names, links).
- `addComment` test: mock Supabase + `lib/email`; assert recipients exclude the author and the
  comment insert still succeeds when email throws.
- `inviteToProject` / `addMemberByEmail`: assert an invite email is attempted on both paths.
- Auth: `resetPasswordForEmail` action returns the neutral message on both success and unknown
  email; welcome-email send is attempted after successful signup.
- All existing unit tests must remain green. E2E core-loop must still pass (email is mocked/no-op
  in test env since `RESEND_API_KEY` is unset).

## Out of scope (YAGNI)

- Per-user notification preferences / unsubscribe management.
- Digest/batched emails.
- In-app notification center.
- Real-time (websocket) comment updates.
- Background queue or Supabase Edge Functions for email delivery.

## External setup (user actions, exact steps provided at implementation time)

1. Create a Resend account, generate an API key.
2. Add `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL` to Vercel env vars.
3. Add `${APP_URL}/reset-password` to Supabase Auth → URL Configuration → Redirect URLs.
4. Go-live (later): verify `apexure.com` in Resend, set `EMAIL_FROM=notifications@apexure.com`,
   optionally configure Supabase custom SMTP to use Resend for auth emails.
