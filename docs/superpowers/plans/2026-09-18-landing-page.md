# Marketing Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static, motion-rich single-page marketing site for MarkUp at `/`, with signed-in visitors redirected to `/app` by the proxy.

**Architecture:** `app/page.tsx` is a static server page that renders `components/landing/Landing.tsx`. Each animated section is its own `"use client"` component that builds its GSAP timelines inside `useGSAP` + `gsap.matchMedia()`, so reduced motion and mobile get static fallbacks and everything is cleaned up on unmount. Lenis drives smooth scroll from `gsap.ticker`. Sticky sections use CSS `position: sticky` with ScrollTrigger reading progress (no GSAP pinning), which keeps layout predictable with Lenis.

**Tech Stack:** Next 16.3 App Router, React 19.2, Tailwind v4, `gsap` + ScrollTrigger, `@gsap/react`, `lenis`, `next/font` (Instrument Serif), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-18-landing-page-design.md`

## Global Constraints

- Palette is fixed and scoped under `.landing`: cream `#FBFAF3`, ribbon `#F1EFE2`, ink `#1C1C17`, muted `#6A695F`, charcoal `#1B1B18`, sage `#E6E6D8`, lime `#C5F04A`, lime-ink `#1F2A05`, resolved `#2F9E62`, quote accents lime / `#F4EFD9` / `#E4DDF7` / `#FFD9C2`.
- Display font Instrument Serif (400 + italic), body Inter, numerals Geist Mono. No gradients, no glass, no em dashes in UI copy.
- Animate transform, opacity, clip-path, stroke-dashoffset, SVG `startOffset` only.
- Every scroll or loop animation lives under `(prefers-reduced-motion: no-preference)`; the reduced-motion state is the final, fully readable frame.
- Product facts must be true: uploads are PNG/JPG, HTML (live) and Figma frames, up to 25 MB; PDFs are comment attachments only.
- Testimonial content is PLACEHOLDER and lives only in `components/landing/content.ts`.
- Next 16: routing middleware is `proxy.ts`; read `node_modules/next/dist/docs/` before using an API.
- Commits happen only when the user asks; each task ends at a checkpoint that is ready to commit.

## File map

| File | Responsibility |
|---|---|
| `lib/supabase/middleware.ts` (modify) | Redirect signed-in `/` to `/app`, keeping refreshed cookies |
| `lib/supabase/middleware.test.ts` | Unit tests for that redirect |
| `app/page.tsx` (replace) | Static page: metadata, serif font variable, `<Landing />` |
| `components/landing/Landing.tsx` | Server composition of all sections |
| `components/landing/landing.css` | Scoped tokens + bespoke classes (`lp-*`) |
| `components/landing/gsap.ts` | Registers ScrollTrigger + useGSAP once, re-exports |
| `components/landing/SmoothScroll.tsx` | Lenis ↔ ScrollTrigger wiring, anchor scrolling |
| `components/landing/content.ts` | All copy, FAQ, steps, PLACEHOLDER quotes |
| `components/landing/icons.tsx` | Mark + hand-drawn duo-tone SVG icons |
| `components/landing/Nav.tsx` | Floating nav |
| `components/landing/Hero.tsx` | Headline, CTAs, parallax feedback scraps |
| `components/landing/HeroFilm.tsx` | Looping product film, click-to-pin, pause |
| `components/landing/FormatBand.tsx` | Dark velocity marquee |
| `components/landing/FeedbackFunnel.tsx` | textPath funnel through the pin |
| `components/landing/HowItWorks.tsx` | Three drawn icons |
| `components/landing/Ribbon.tsx` | Scroll-drawn background ribbon |
| `components/landing/Features.tsx` | Sticky four-step walkthrough (+ stacked mobile) |
| `components/landing/Versions.tsx` | Scrubbed v1→v2 wipe + hold Space |
| `components/landing/Extras.tsx` | Reminders / Slack / roles / Figma |
| `components/landing/Testimonials.tsx` | Drifting tilted comment-cards |
| `components/landing/Faq.tsx` | `<details>` accordion |
| `components/landing/FinalCta.tsx` | Closing CTA + footer |
| `e2e/landing.spec.ts` | Browser checks incl. reduced motion |

---

### Task 1: Signed-in redirect in the proxy

**Files:**
- Modify: `lib/supabase/middleware.ts`
- Test: `lib/supabase/middleware.test.ts`

**Interfaces:**
- Produces: `updateSession(request: NextRequest): Promise<NextResponse>`, same signature; now returns a 307 to `/app` when a user exists and the path is exactly `/`.

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

let user: { id: string } | null = null;
let refreshCookie = false;

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_u: string, _k: string, opts: { cookies: { setAll: (c: { name: string; value: string; options?: object }[]) => void } }) => ({
    auth: {
      getUser: async () => {
        if (refreshCookie) opts.cookies.setAll([{ name: "sb-token", value: "fresh", options: { path: "/" } }]);
        return { data: { user } };
      },
    },
  }),
}));

import { updateSession } from "./middleware";

const req = (path: string) => new NextRequest(new URL(path, "https://markup.test"));

describe("updateSession on the landing page", () => {
  beforeEach(() => { user = null; refreshCookie = false; });

  it("shows the landing page to signed-out visitors", async () => {
    const res = await updateSession(req("/"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("sends signed-in visitors at / straight to the app", async () => {
    user = { id: "u1" };
    const res = await updateSession(req("/"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/app");
  });

  it("keeps a refreshed session cookie on the redirect", async () => {
    user = { id: "u1" };
    refreshCookie = true;
    const res = await updateSession(req("/"));
    expect(res.cookies.get("sb-token")?.value).toBe("fresh");
  });

  it("leaves every other path alone for signed-in users", async () => {
    user = { id: "u1" };
    for (const p of ["/login", "/app", "/s/abc", "/signup"]) {
      const res = await updateSession(req(p));
      expect(res.headers.get("location")).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run it and watch the redirect tests fail**

Run: `npx vitest run lib/supabase/middleware.test.ts`
Expected: the "signed-in" and "refreshed cookie" tests FAIL (no location header).

- [ ] **Step 3: Implement**

In `updateSession`, replace `await supabase.auth.getUser(); return response;` with:

```ts
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed-in visitors skip the marketing page and land in the app. Doing it
  // here, not in app/page.tsx, keeps the landing page static: it never reads
  // the session, so it can be prerendered and served from the CDN.
  if (user && request.nextUrl.pathname === "/") {
    const redirect = NextResponse.redirect(new URL("/app", request.url));
    // getUser() may have refreshed the session; losing those cookies here
    // would sign the user out on the very next request.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `npx vitest run lib/supabase/middleware.test.ts` → 4 passed.

- [ ] **Step 5: Checkpoint** — `fix`-free, ready to commit as `feat(landing): send signed-in visitors at / to the app from the proxy`.

---

### Task 2: Static page scaffold, tokens, smooth scroll, nav

**Files:**
- Replace: `app/page.tsx`
- Create: `components/landing/{Landing.tsx,landing.css,gsap.ts,SmoothScroll.tsx,content.ts,icons.tsx,Nav.tsx}`
- Modify: `package.json` (deps)

**Interfaces:**
- Produces: `gsap`, `ScrollTrigger`, `useGSAP` from `components/landing/gsap.ts`; `MOTION_OK = "(prefers-reduced-motion: no-preference)"`; content exports `NAV_LINKS`, `SCRAPS`, `FUNNEL_IN`, `FUNNEL_OUT`, `STEPS`, `EXTRAS`, `QUOTES`, `FAQ`; icon exports `Mark`, `IconUpload`, `IconShare`, `IconLoop`, `IconReminder`, `IconSlack`, `IconRoles`, `IconFigma`.

- [ ] **Step 1:** `npm i gsap @gsap/react lenis`. Read `node_modules/next/dist/docs/01-app/01-getting-started/{11-css,13-fonts,14-metadata-and-og-images}.md` and Lenis's README for the anchor option.
- [ ] **Step 2:** `gsap.ts`:

```ts
"use client";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// Every scroll effect is registered under this query; reduced motion gets the
// final frame, never a half-played animation.
export const MOTION_OK = "(prefers-reduced-motion: no-preference)";
export { gsap, ScrollTrigger, useGSAP };
```

- [ ] **Step 3:** `SmoothScroll.tsx`: Lenis `{ lerp: 0.1, anchors: { offset: -96 } }`, `lenis.on("scroll", ScrollTrigger.update)`, `gsap.ticker.add(t => lenis.raf(t * 1000))`, `gsap.ticker.lagSmoothing(0)`; skipped entirely under reduced motion; destroyed on unmount.
- [ ] **Step 4:** `app/page.tsx`: `Instrument_Serif({ variable: "--font-serif", weight: "400", style: ["normal", "italic"], subsets: ["latin"] })`, metadata (title "MarkUp by Apexure · Feedback pinned to the design", description, openGraph), renders `<Landing fontClass={serif.variable} />`. No cookies, no Supabase import.
- [ ] **Step 5:** `landing.css` tokens under `.landing` (Global Constraints palette as `--lp-*`), `.lp-serif`, `.lp-italic`, `.lp-eyebrow`, `.lp-btn` (lime primary, ghost secondary, focus ring), `.lp-panel-dark` (40px radius, 8px side inset), `.lp-container` (max 1200, 24px gutters, 16px under 640px), `html:has(.landing)` background cream so overscroll matches.
- [ ] **Step 6:** `Nav.tsx`: fixed, centred, max-w 1120, radius 18, cream/95 + border; `data-scrolled` after 8px adds shadow. Links hidden under 768px except Log in + Start free.
- [ ] **Step 7:** Verify: `npm run build` lists `○ /` (static). `npm run dev`, open `/` signed out → nav + empty sections render, no console errors.
- [ ] **Step 8: Checkpoint.**

---

### Task 3: Hero + hero film

**Files:** Create `components/landing/Hero.tsx`, `components/landing/HeroFilm.tsx`; add styles to `landing.css`.

- Headline words wrapped in `<span class="lp-word"><span>word</span></span>`; CSS keyframe rise (translateY 110%→0, 900ms, cubic-bezier(.22,1,.36,1), 60ms stagger via `--i`). Runs without JS; disabled under reduced motion.
- Six `SCRAPS` (email subject, Slack bubble, sticky note, file chip, "per our call…", "can we try it in blue?") absolutely placed around the headline with `data-depth` 0.2–1. `gsap.quickTo` x/y on pointermove (±24px × depth); scrubbed scroll-out (y −120 × depth, opacity 0) from `top top` to `bottom top`. Hidden under 900px except two.
- Film: `.lp-film` stage, `aspect-ratio: 16/10`, `container-type: inline-size`, all sizes in `cqi`. Browser chrome + mock client site ("Northwind Coffee": nav, headline, image block, CTA) + comment rail (hidden `@container (max-width: 640px)`).
- Film timeline (`repeat: -1, repeatDelay: 1.2`), labels: `pin1` cursor to logo, click, pin 1 pops (back.out 2) → typewriter "Can the logo be a bit bigger?" → collapses into rail item 1; `region` drag box over CTA (scale from top-left) → pin 2 + "Make this say Start trial"; `reply` "Sam · Designer: Done in v2"; `resolve` tick → pin 1 turns `--lp-resolved` with 8-dot burst; `still` label used as the reduced-motion frame.
- Click on the mock site: pause timeline, drop a visitor pin (next number) at the click point with a popover "That's how easy it is. Start free to use it on your own designs." linking `/signup`; resumes after 6s or on Play.
- Pause/Play button (`aria-pressed`), `role="img"` + `aria-label` describing the loop.
- Scroll: film scales 0.88→1 and radius 28→20, scrub from `top 95%` to `top 35%`.
- Verify in browser at 1440 and 390; reduced motion shows the `still` frame. **Checkpoint.**

---

### Task 4: Format band + feedback funnel

**Files:** Create `FormatBand.tsx`, `FeedbackFunnel.tsx`.

- Band: dark panel, eyebrow "WORKS WITH WHAT YOU MAKE", one serif row "PNG & JPG ✳ Live HTML ✳ Figma frames ✳ Desktop & mobile views ✳ Slack ✳ Email reminders" duplicated twice; base tween `xPercent: -50, repeat: -1, ease: none, duration: 40`; ScrollTrigger `onUpdate` sets `timeScale` to `clamp(±1…±5)` from velocity/400 with sign = scroll direction, easing back to ±1 over 0.6s.
- Funnel: H2 "Feedback, *in one place.*" + sub. Two SVGs (desktop viewBox 1440×620, mobile 400×640), only the visible one animates.
  - Input: grey (`#A3A195`) 17px text on a looping path ending at the pin; `FUNNEL_IN` repeated to cover path + one cycle.
  - Output: charcoal 46px round-cap stroke path from the pin rising to the right; white 17px text on the same path; `FUNNEL_OUT` items separated by em-space gaps; lime badge circles placed each frame with `getStartPositionOfChar` / `getRotationOfChar` at each item's first gap char.
  - Pin: lime teardrop with mono number over the junction; number = item currently emerging; gentle 2.4s pulse ring.
  - Loop: `startOffset = -cycle + (phase mod cycle)`; base 38 px/s, multiplied by `1 + min(|velocity|/300, 5)` decaying; rAF runs only while intersecting.
  - Reduced motion: fixed phase chosen so two badges are visible, no rAF.
- Verify both breakpoints. **Checkpoint.**

---

### Task 5: How it works + ribbon + extras icons

**Files:** Create `HowItWorks.tsx`, `Ribbon.tsx`, `Extras.tsx`; fill `icons.tsx`.

- Icons: 160×110 viewBox, `stroke: var(--lp-ink)`, width 2.5, round caps/joins, `pathLength="1"` on stroke paths; lime fills `rx` 10–14. Upload: three lime tiles (image, `</>`, frame glyph) with a looping arrow above. Share: lime tile with link glyph → sketch arrow → outlined tile with two heads. Loop: circular arrow around a lime pill with a tick. Extras: envelope + clock, hash bubble, key + two heads, frame corners.
- On enter (`top 80%`): strokes `strokeDashoffset 1→0` (1.1s, power2.out, 0.15 stagger), fills scale 0.6→1 (back.out).
- Ribbon: one SVG path, stroke `--lp-ribbon`, width 170, round caps, absolutely behind `HowItWorks`+`Features` (wrapper `.lp-ribbon-zone`), drawn by scrub (`dashoffset 1→0`, `top 70%`→`bottom bottom`) with slight y parallax. Hidden under reduced motion? No: shown fully drawn.
- Extras: 4 items in a 4-col grid (2-col under 900, 1-col under 560), fade-up stagger.
- **Checkpoint.**

---

### Task 6: Sticky features

**Files:** Create `Features.tsx`.

- Desktop (`min-width: 1024px`): outer `height: 400svh`, inner `position: sticky; top: 0; height: 100svh`, 3-column grid: index (4 `STEPS` titles, lime 3px bar on active, muted others), centre sage card 520×560 with four stacked scenes, right stacked copy blocks.
- ScrollTrigger on outer, `onUpdate` → `step = min(3, floor(progress * 4))`; on change: outgoing scene/copy fade + y −16, incoming fade + y 16→0, bubbles stagger 0.12s; avatar tiles (`/avatars/3.png`, `/avatars/7.png`, `/avatars/12.png` with name tags) `gsap.to` per-step positions and float yoyo (sine, 3–4s).
- Scenes: Point (mockup, cursor, pin drop, region box, bubble "Priya · Client"), Talk (three bubbles incl. `@Sam` highlight, `brand-guide.pdf` chip, "typing…"), Share (link field `markup.apexure.com/s/k7Qm2`, "Anyone with the link can comment", guest bubble, Desktop/Mobile toggle), Resolve (thread with tick, green pin, "Resolved" chip).
- Mobile: separate stacked variant (`lg:hidden`), each step = copy + scene in final state, fade-up on enter.
- **Checkpoint.**

---

### Task 7: Versions

**Files:** Create `Versions.tsx`.

- Outer `250svh`, sticky inner. Browser card with v1 and v2 mock designs layered; v2 `clip-path: inset(0 0 0 X%)` scrubbed 100→0; lime divider with "v1 | v2" handle follows X. Pins on both layers; pin 1 green on v2.
- Copy: H2 "New version. *Same conversation.*", body, `<kbd>Space</kbd>` hint.
- Space: only while the section intersects and focus is not in a form field: `keydown` (no repeat) → preventDefault, force clip 100% (show v1) + label "Showing v1"; `keyup` → back to scroll state. Listeners removed on unmount.
- Reduced motion: divider at 50%, no scrub; Space still works.
- **Checkpoint.**

---

### Task 8: Testimonials

**Files:** Create `Testimonials.tsx`; `QUOTES` in `content.ts` marked PLACEHOLDER.

- Dark panel; H2 "Agencies *stopped chasing* feedback."; stage `220svh` with sticky 100svh viewport; five comment-cards (w `min(460px, 80vw)`, radius 28, accent backgrounds) each: lime pin badge + avatar + name/role + mono "2d", serif quote 30px, footer "Resolved ✓" chip.
- One scrubbed timeline over the stage: each card `fromTo` its own start (x, y, rotation) to end, speeds 0.7–1.3 so they cross at different rates; slight rotation change (e.g. −8° → 3°).
- Mobile/reduced motion: vertical stack with alternating ±2° rotation, fade-up on enter (motion only).
- **Checkpoint.**

---

### Task 9: FAQ, final CTA, footer

**Files:** Create `Faq.tsx`, `FinalCta.tsx`.

- FAQ: 7 `FAQ` items as `<details name="faq">` (exclusive accordion) with plus icon rotating 45°; content height transition via `interpolate-size: allow-keywords` + `::details-content` (progressive; instant elsewhere).
- Final CTA: serif "Your next round of feedback *starts here.*", lime "Start free" with magnetic hover (quickTo ±8px, pointer devices only), ghost "Log in"; three small pins pop in on enter.
- Footer: rule, mark + "MarkUp by Apexure", anchor links, Log in, Sign up, "© 2026 Apexure".
- **Checkpoint.**

---

### Task 10: Verification

**Files:** Create `e2e/landing.spec.ts`.

```ts
import { test, expect } from "@playwright/test";

test.describe("landing page", () => {
  test("signed-out visitors see the landing page with working CTAs", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Pin it.");
    await expect(page.getByRole("link", { name: "Start free" }).first()).toHaveAttribute("href", "/signup");
    await expect(page.getByRole("link", { name: "Log in" }).first()).toHaveAttribute("href", "/login");
    expect(errors).toEqual([]);
  });

  test("everything is readable with reduced motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    for (const name of [
      "Feedback, in one place.",
      "Fits your process. Clears it up.",
      "New version. Same conversation.",
      "Agencies stopped chasing feedback.",
      "Your next round of feedback starts here.",
    ]) {
      const h = page.getByRole("heading", { name });
      await h.scrollIntoViewIfNeeded();
      await expect(h).toBeVisible();
    }
    await context.close();
  });
});
```

- [ ] `npx vitest run` (whole suite) passes.
- [ ] `npx playwright test e2e/landing.spec.ts` passes.
- [ ] `npm run lint` clean for new files; `npx tsc --noEmit` clean.
- [ ] `npm run build` shows `○ /`.
- [ ] Screenshot review at 1440×900 and 390×844 through every section; fix what looks off.
- [ ] **Checkpoint.**
