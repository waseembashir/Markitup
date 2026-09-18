# DESIGN.md — Apexure MarkItUp design system

Light theme, product register. All colors OKLCH, all neutrals tinted toward the
brand hue (274). Tokens live in `app/globals.css` under `@theme`; use the Tailwind
utilities they generate (`bg-surface`, `text-muted`, `text-brand`, `rounded-lg`, …)
and the component classes (`.btn-primary`, `.field`, `.card`, `.chip`).

## Theme rationale
Scene: an agency designer and a client reviewing a website mockup on a laptop in a
bright office, mid-afternoon, focused. → **Light.** The canvas must feel like paper
under gallery light so the artwork reads truthfully; dark chrome would fight it.

## Color (OKLCH)
Strategy: Restrained+ — tinted neutral canvas, one committed indigo brand accent
(~8–12% of surface: primary actions, active pins, active nav, focus rings).

| Role | Token | Value |
|---|---|---|
| Canvas | `--color-canvas` | oklch(0.975 0.006 274) |
| Surface (cards, bars) | `--color-surface` | oklch(0.995 0.0015 274) |
| Surface raised | `--color-surface-2` | oklch(1 0 0) w/ shadow |
| Border | `--color-border` | oklch(0.912 0.007 274) |
| Border strong | `--color-border-strong` | oklch(0.86 0.008 274) |
| Text strong | `--color-ink` | oklch(0.27 0.021 274) |
| Text muted | `--color-muted` | oklch(0.52 0.016 274) |
| Text faint | `--color-faint` | oklch(0.64 0.013 274) |
| Brand | `--color-brand` | oklch(0.54 0.20 274) |
| Brand hover | `--color-brand-hover` | oklch(0.48 0.20 274) |
| Brand soft (tint) | `--color-brand-soft` | oklch(0.955 0.03 274) |
| Success (resolved) | `--color-success` | oklch(0.60 0.14 155) |
| Success soft | `--color-success-soft` | oklch(0.95 0.04 155) |
| Danger | `--color-danger` | oklch(0.56 0.19 25) |
| Danger soft | `--color-danger-soft` | oklch(0.955 0.03 25) |

Pins: active pin = brand indigo; resolved pin = success green. These are the two
loudest colors in the product and they carry functional meaning.

## Typography
- **UI + headings:** Plus Jakarta Sans (`--font-sans`), weights 400/500/600/700/800.
- **Numbers, timestamps, file meta, pin badges:** Geist Mono (`--font-mono`).
- Scale (≥1.25 steps): display 30/700, h1 22/700, h2 18/600, h3 15/600,
  body 14/400, small 13/400, micro 12/500 (labels, uppercase tracking).
- Body max width 68ch for comment text.

## Space & shape
- Spacing rhythm on a 4px base: 4,6,8,12,16,20,24,32,48,64. Vary it for rhythm;
  never uniform padding everywhere.
- Radii: sm 6, md 10 (buttons, inputs), lg 14 (cards, panels), xl 20 (modals),
  full (pills, avatars, pin badges).
- Elevation: soft, indigo-tinted, low-alpha. `--shadow-sm` for cards at rest,
  `--shadow-md` for popovers/hover-lift, `--shadow-lg` for the active comment card.
  Prefer border + faint shadow over heavy drop shadows.

## Motion
- `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`. Durations 150–200ms.
- Transition color/opacity/transform/box-shadow only. Never animate layout props.
- Hover lifts (translateY(-1px)) and tints; pins get a subtle scale/press feedback.

## Components
- **Button:** primary (brand fill, white text), secondary (surface + border),
  ghost (transparent, tint on hover). Height 36 (md) / 32 (sm). Radius md.
  All have hover/focus-visible/active/disabled + optional loading spinner.
- **Field:** label (micro) + input (surface, border, radius md, brand focus ring),
  inline error in danger. Never a bare unlabeled input.
- **Card:** surface, border, radius lg, `--shadow-sm`; hover lifts + border-strong.
  No nested cards, no side-stripe borders.
- **Chip / badge:** pill, soft tint bg + role color text; used for status counts.
- **Avatar:** initials on a deterministic tint, radius full, ring on stacks.

## Bans (in addition to the global ones)
No side-stripe accent borders, no gradient text, no glassmorphism, no modal-first
flows, no identical-card monotony (vary card content density), no em dashes in UI copy.
