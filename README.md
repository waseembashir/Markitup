# Markitup

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Environments

This project uses a **cloud Supabase project per environment** — no Docker, no
Supabase CLI. Two environments:

| | Env file | Supabase project | Used by |
|---|---|---|---|
| **Development** | `.env.development.local` | your own dev project | `npm run dev` |
| **Production** | `.env.local` | the live project | migration scripts, `npm run build` |

Next.js loads `.env.development.local` ahead of `.env.local` when you run
`npm run dev`, so the app points at dev automatically while the production values
stay available to the scripts.

Both files are gitignored. Only the `.example` templates are committed.

## First-time local setup

1. **Create a dev Supabase project** at [supabase.com](https://supabase.com/dashboard).
   Name it something unmistakable, e.g. `markitup-dev`. The free tier is fine.

2. **Create your dev env file:**
   ```bash
   cp .env.development.local.example .env.development.local
   ```
   Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (Settings → API) and `SUPABASE_DB_URL` (Settings → Database → Connection
   string → URI, with your password inserted). Generate a **dev-only**
   `FIGMA_TOKEN_SECRET`; never reuse production's.

3. **Build the schema.** One command applies all migrations in order and records
   each one:
   ```bash
   npm run dev:migrate
   ```
   Check it any time with `npm run dev:status`.

4. **Create the storage buckets.** Migrations cover tables and policies, not
   buckets. In Supabase → Storage, create two **private** buckets:
   `mockups` and `comment-files`.

5. **Turn off email confirmation.** Authentication → Sign In / Providers → Email
   → uncheck **Confirm email**. With it on and no SMTP configured, a new signup
   produces no session and cannot enter the app.

6. **Enable anonymous sign-ins** (Authentication → Sign In / Providers) if you
   want to test public share links, which let clients comment without an account.
   Remember to press **Save** — the toggle reverts silently otherwise.

7. **Run it:**
   ```bash
   npm run dev
   ```

## Migrations

Migrations live in `supabase/migrations/` and are applied by a runner that keeps
a ledger in the `app_migrations` schema — filename, a checksum of the contents,
and when it ran.

```bash
npm run db:status      # what is applied and pending (read-only, safe on prod)
npm run db:migrate     # apply everything pending
npm run dev:status     # the same, against the dev project
npm run dev:migrate
```

Nothing is written unless you ask it to apply. Three rules the runner enforces:

- **Order.** Files run in filename order, each in its own transaction. A failure
  rolls that file back and stops, rather than leaving the schema half-changed.
- **Exactly once.** An applied migration is never re-run.
- **No silent edits.** If a file's contents change after it was applied, the
  runner refuses to apply anything until you resolve it. Fix a mistake with a
  *new* migration rather than editing an old one.

To adopt an existing database that already has every migration applied by hand,
record them without executing anything:

```bash
npm run db:baseline
```

### Writing a migration

Create `supabase/migrations/00NN_short_name.sql`, write the SQL with a comment
explaining *why*, then:

```bash
npm run dev:migrate    # dev first, always
npm run test           # then the suite
npm run db:migrate     # production, once dev is proven
```

## Google sign-in (optional)

Email/password auth works out of the box. To also enable "Sign in with Google", configure the Google provider in Supabase:

1. In the [Google Cloud Console](https://console.cloud.google.com/), create an OAuth 2.0 Client ID (Web application) and add `https://<your-project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI.
2. In the Supabase dashboard, go to **Authentication → Providers → Google**, enable it, and paste in the Client ID and Client Secret from step 1.
3. (If using the local Supabase CLI instead of the cloud dashboard, set the equivalent values under `[auth.external.google]` in `supabase/config.toml`.)
4. The app's OAuth callback route (`app/auth/callback/route.ts`) exchanges the returned `code` for a session and redirects to `/app`; no additional app code changes are required once the provider is configured.

## Email notifications (Resend)

Transactional email (comment notifications, invites, welcome) is sent via
[Resend](https://resend.com). Password-reset emails are sent by Supabase.

1. Create a Resend account and an API key.
2. Set these env vars (locally in `.env.local`, and in Vercel → Settings →
   Environment Variables for Production/Preview):
   - `RESEND_API_KEY` — your Resend API key.
   - `EMAIL_FROM` — sender address. Use `onboarding@resend.dev` until you
     verify a domain; then set e.g. `notifications@apexure.com`.
   - `NEXT_PUBLIC_APP_URL` — your live URL, e.g. `https://markitup-woad.vercel.app`.
3. In Supabase → Authentication → URL Configuration, add
   `https://<your-app>/auth/callback` to the Redirect URLs. The password-reset
   flow routes through this same route (it performs the server-side PKCE code
   exchange, so resets work across devices) and then forwards internally to
   `/reset-password`, which is same-origin and needs no separate allowlist
   entry. This is the same callback URL used by Google sign-in above, so it
   may already be present.
4. **Go-live:** verify `apexure.com` in Resend (add the DNS records it shows),
   then set `EMAIL_FROM=notifications@apexure.com`. Until then, Resend only
   delivers to your own verified address.

If `RESEND_API_KEY` is unset, the app runs normally and email sends are skipped
(logged as warnings), so local dev and tests need no email config.

## Running Tests

This project uses [Vitest](https://vitest.dev) for unit tests.

```bash
npm test            # run the unit test suite once (Vitest)
npm run test:watch  # run in watch mode
npm run test:e2e    # full end-to-end core loop (Playwright, drives the real app)
```

Two database-backed invariants are proven by standalone scripts that run against
the cloud DB (they use a transaction and roll back, leaving no data behind):

```bash
node scripts/rls-check.mjs    # tenant-isolation RLS (self-join denied, owner bootstrap allowed)
node scripts/pins-check.mjs   # per-mockup sequential pin numbering
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
