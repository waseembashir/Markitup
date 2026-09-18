# Marketing landing page — design

Date: 2026-09-18 · Status: approved in chat, building on `feat/landing-page`

## Goal

A single-page marketing site for MarkItUp by Apexure at `/`. Minimal, elegant,
motion-rich. Concepts borrowed from wisprflow.ai (serif display with italic
accents, stacked rounded panels, a scroll-drawn background ribbon, a sticky
feature walkthrough, tilted drifting quote cards, hand-drawn duo-tone icons),
re-expressed for a visual-feedback product. Not a clone.

## Non-goals

No pricing, no customer logos, no blog/extra pages, no CMS, no analytics.

## Routing

- `/` renders the landing page for everyone who is signed out. The page is
  fully static (prerendered): it reads no cookies and no user.
- Signed-in users hitting `/` are redirected to `/app` **in the proxy**
  (`lib/supabase/middleware.ts#updateSession` already calls `getUser()` on every
  request). The redirect must carry over any refreshed session cookies.
- CTAs: "Start free" → `/signup`, "Log in" → `/login`.

## Look

Palette, fixed (does not follow the app's accent/dark-mode switch):

| Role | Value |
|---|---|
| Canvas (cream) | `#FBFAF3` |
| Ribbon / soft band | `#F1EFE2` |
| Ink | `#1C1C17` |
| Muted ink | `#6A695F` |
| Charcoal panel | `#1B1B18` |
| Sage card | `#E6E6D8` |
| Lime (pins, primary CTA, icon fills) | `#C5F04A` |
| Lime ink on lime | `#1F2A05` |
| Resolved green | `#2F9E62` |
| Quote-card accents | lime, cream `#F4EFD9`, lilac `#E4DDF7`, peach `#FFD9C2` |

Type: **Instrument Serif** (display, 400 + italic) via `next/font/google`,
loaded only by the landing route; Inter (body, already loaded, with tabular
figures for pin numbers and counts). No monospace anywhere on the page (it
read as machine-made). No gradients, no glass, no em dashes in copy.

Icons: custom inline SVG, hand-drawn feel. 2.5px ink strokes, round caps and
joins, lime-filled rounded shapes, loose sketchy arrows. Strokes draw in when
scrolled into view.

## Sections

0. **Floating nav.** Rounded bar, fixed. Mark + "MarkUp" · How it works ·
   Features · FAQ · Log in · Start free. Gains a shadow once scrolled.
1. **Hero.** No eyebrow. H1 "Don't explain it. *Pin it.*" A two-line sub:
   "Clients click anywhere on your design to leave a comment. Every note lands
   exactly where it belongs." CTAs + "Clients never need an account." Spacing
   is tight enough that the top of the film shows on the first screen.
   The whole hero is commentable, like a design in the app: the cursor is the
   app's lime "+" comment cursor, a click drops a numbered pin, a drag marks a
   dashed lime area, and either opens a composer (Enter posts, Escape
   cancels; the last six comments stay). Until the visitor tries it, a loop
   on wide screens shows how: a cursor drags an area over "Don't explain it.",
   pin 1 drops and "Could this line be a little bigger?" is typed and posted.
   Sam's reply "Done, it's bigger in v2." floats at the left beside the CTAs
   (wide screens only), resolving itself every few seconds with the app's
   confetti until the visitor clicks it; it drifts away on scroll.
2. **Hero film.** Large rounded card, code-animated loop (~14s): browser frame
   with a landing-page mockup → cursor drops pin 1 → comment types → drag a
   region for pin 2 → reply arrives → pin 1 resolves green. Card scales up as it
   scrolls in. Visitors can click the mockup to drop their own pin (pauses the
   loop). Has a pause/play button (WCAG 2.2.2) and a text alternative. No
   confetti in the film.
3. **Format marquee (dark band).** Replaces a logo strip: PNG · JPG · Live HTML ·
   Figma frames · Desktop view · Mobile view · Slack · Email. Speed and
   direction follow scroll velocity.
4. **Before and after (cream).** H2 "Same comment. *None of the chaos.*" One
   sticky full-screen scene (440svh of scroll, scrubbed), no panel behind it.
   (Replaces a text-on-a-path funnel, which read as copied from the reference,
   a transit-map board, which was too complicated, a side-by-side version, a
   stacked version, and a giant-logo merge that was too big.)
   - *The old way*, scattered across the whole screen in black and white
     (drawn in greys, not a CSS filter, so scrolling stays smooth), each piece
     bobbing gently: a screenshot with a pen circle, arrow and "this one!!", a
     "Re: Re: Fwd:" email, "which logo?", a sticky note, a messy feedback
     spreadsheet, a missed-call chip, `v3_final_FINAL_2.png`. A floating caption
     reads "The old way. Screenshots, scribbles, long emails and “which logo?”".
   - The pieces gather into a pile; a lime MarkItUp folder (small logo on a
     label on its front) rises below it; the pieces drop in one by one, the
     folder giving a little as each lands, their tops peeking out.
   - The folder flap opens with a lime glow and the MarkItUp app comes up out
     of it in colour: app window + comments rail. The caption becomes "With
     MarkItUp. Click the spot. Say it once. Tick it off." A cursor drops pin 1
     on the logo, "A bit bigger?" and "Done in v2." appear, the pin turns green
     and resolves, confetti (forward scroll only). Two earlier resolved
     comments sit at the foot of the rail.
   Portrait screens rearrange the pieces and stack the app over the rail.
   Reduced motion shows the scattered pieces and the finished app, stacked.
5. **How it works.** H2 "Three steps. *Zero chasing.*" Three hand-drawn
   icons: Upload anything (images, live HTML, Figma frames) · Share one link
   (clients comment with no account) · Close the loop (resolve, compare, move on).
   A scroll-drawn ribbon sweeps behind it.
6. **Sticky features.** Left: step index with lime bar. Centre: sage card with a
   mockup, pins, comment bubbles with coloured speaker names, avatar tiles
   drifting at its edges. Right: serif heading + paragraph. Behind it, one
   thick ribbon draws itself in, then morphs (GSAP MorphSVG, scrubbed) into a
   different shape and tint for each step, the morph straddling the step
   change: a giant cursor arrow pointing at the card (point, cream), a wide
   speech bubble with a tail (talk, lilac), a flight path that loops and
   shoots off the top right with an arrowhead (share, peach), a big tick
   (close the loop, lime). Steps:
   - Point at it — "Put it *exactly there.*" Click to pin, or drag a box.
   - Talk it through — "Keep the *whole conversation.*" Threads, @mentions,
     image/PDF attachments, comments arrive live.
   - Share it — "Clients just *click the link.*" Guest comments with no account,
     locked files with access requests, desktop and mobile views.
   - Close the loop — "Tick it *off.*" Resolve, pin turns green, confetti.
7. **Versions.** Pinned scrub wipes v1 → v2 with pins carried across. "Hold
   Space to compare" — holding Space on the page really flips to v1.
8. **Around the feedback.** H2 "The busywork, *handled.*" Four hand-drawn-icon items: automatic email
   reminders · Slack digests per project · roles (Admin / Manager / Guest) ·
   live Figma frames.
9. **Testimonials (charcoal panel).** H2 "Agencies *stopped chasing* feedback."
   Cards styled as MarkItUp comments (numbered pin, serif quote, cartoon
   avatar, name/role, "Resolved" chip) drift up through a sticky view at
   different speeds and turn as they go. The stage is 230svh and the last three
   cards finish inside the view, so there is never an empty dark screen; the
   section ends as they scroll away. **All quotes are placeholders**, in one
   data file, flagged.
10. **FAQ.** H2 "Questions, *answered.*" Native `<details>` accordion. Accounts, file types, versions,
    access control, Slack, reminders, mobile.
11. **Final CTA.** A rounded photo panel (the client's studio photo,
    `components/landing/images/cta-studio.png`), fully visible: no UI on it
    and no cursor light. "Your next round of feedback *starts here.*" top left
    (no eyebrow); the sub and Start free / Log in about a quarter of the way up
    from the bottom right. Soft shades sit only behind those two corners. The
    photo pushes in as it arrives and shifts slightly with the pointer; the
    Start free button is magnetic. On phones the heading sits at the top and
    the ask at the bottom.
12. **Footer (on the page background, no panel, ink type).** Brand + tagline +
    LinkedIn / Instagram / X; "Got a question?" with info@apexure.com; columns
    Product, Get started, Works with, Apexure (apexure.com, Contact); bottom
    bar with © 2026 Apexure, "Privacy policy" (→ apexure.com/privacy/) and
    "Terms and conditions" (→ /terms); the whole "MarkIt*Up*" wordmark (never
    cropped; "Up" lime with an ink outline), letters rising in, pins stuck on
    it and click-to-pin for visitors. Contact details are Apexure's public
    ones.

**Name.** The product is **MarkItUp** everywhere on the landing and terms
pages (the app itself was not renamed).

**Icons and logo.** Every hand-drawn icon loops a small animation once drawn
(tiles hop, link wiggles, loop arrow turns, clock ticks, bubbles take turns,
padlock clicks, frame breathes). The nav/footer mark drops in and hops on hover.

**Confetti.** Wherever a comment is resolved (the hero's Sam card, before
and after, features' last step) the page fires the app's own `celebrate()`
from `lib/confetti.ts`, from the resolved element. Not in the hero film.

**Photos.** Tried (three Unsplash photos as pinned prints) and removed at the
user's request; the page uses no photography.

**`/terms`.** Interim page: no terms exist yet, so it says they are being
finalised, gives info@apexure.com, and links Apexure's privacy policy.

## Motion and tech

- Dependencies: `gsap` (+ ScrollTrigger), `@gsap/react` (`useGSAP` cleanup),
  `lenis` (smooth scroll, driven from `gsap.ticker`). Imported only by
  `components/landing/*` client components.
- Every scroll effect is created inside `gsap.matchMedia()` under
  `(prefers-reduced-motion: no-preference)`. With reduced motion: no Lenis, no
  pinning or scrubbing, everything rendered in its final state, film shows one
  composed frame, marquee static.
- Mobile (<768px): pinned sequences shortened, features section becomes stacked
  steps without pinning, testimonial cards stack with a lighter drift.
- Transform/opacity/clip-path/stroke-dashoffset only; no layout-property tweens.

## Structure

- `app/page.tsx` — static server page: metadata + `<Landing />`.
- `components/landing/` — `Landing.tsx` (server composition), `content.ts`
  (all copy, quotes flagged PLACEHOLDER), `icons.tsx` (hand-drawn SVGs),
  one file per animated section (`"use client"`), `SmoothScroll.tsx` (Lenis +
  ScrollTrigger wiring), `landing.css` (scoped under `.landing`).
- `lib/supabase/middleware.ts` — signed-in redirect for `/`.

## Testing

- Vitest: proxy redirect (signed in at `/` → 307 to `/app` with cookies kept;
  signed out → passes through; other paths untouched).
- Playwright e2e `e2e/landing.spec.ts`: signed-out `/` renders the H1, CTA hrefs
  are `/signup` and `/login`, no console errors; with `reducedMotion: 'reduce'`
  every section heading is visible; a visitor can drop their own pin on the
  film; the FAQ opens one answer at a time (clicked straight after load, which
  guards the ScrollTrigger refresh crash fixed during the build).

## Implementation notes

- One-shot reveals use `toggleActions: "play none none none"`, never
  `once: true`. A trigger that kills itself can do so inside a ScrollTrigger
  refresh (page loaded already scrolled past it, while the film builds its
  timeline after fonts load) and crash the page.
- The film and funnel build after `document.fonts.ready`, because the cursor
  targets and the text-on-path lengths are measured.
- `next build` shows `/` as static. Screenshot review at 1440×900 and 390×844.

## Placeholders to replace before launch

Testimonial quotes, names and roles in `components/landing/content.ts`.

The `/terms` page body (interim notice) once real terms of service exist.
