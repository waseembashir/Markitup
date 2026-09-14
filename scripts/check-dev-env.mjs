// Runs automatically before `npm run dev` (npm's `predev` hook).
//
// Next resolves env vars in order and STOPS at the first file that has one:
//   .env.development.local  →  .env.local  →  .env.development  →  .env
//
// So a dev file that is merely incomplete does not fail loudly — each missing
// variable silently falls through to .env.local, which is production. You can
// end up developing against live client data while believing you are not.
//
// This refuses to start in that state. A dev file that is simply absent is
// allowed (that is the old single-environment workflow) but says plainly which
// database it is about to use.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEV = ".env.development.local";
const PROD = ".env.local";

// Anything here that falls through to production is dangerous, not merely wrong:
// the first three point the whole app at the live project, and APP_URL decides
// where links in outgoing email send people.
const CRITICAL = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_DB_URL",
  "NEXT_PUBLIC_APP_URL",
];

function parse(file) {
  const path = join(ROOT, file);
  if (!existsSync(path)) return null;
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function host(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url || "(unset)";
  }
}

const dev = parse(DEV);
const prod = parse(PROD);

if (!dev) {
  const target = host(prod?.NEXT_PUBLIC_SUPABASE_URL ?? "");
  console.log(`\n  No ${DEV} — dev will use ${PROD}`);
  console.log(`  Supabase: ${target}`);
  console.log(`  To develop against a separate project, see "First-time local setup" in README.md.\n`);
  process.exit(0);
}

const missing = CRITICAL.filter((k) => !dev[k]);
if (missing.length) {
  console.error(`\n  ${DEV} is incomplete. These would fall through to ${PROD} — i.e. production:\n`);
  for (const k of missing) console.error(`    ${k}`);
  console.error(`\n  Fill them in from your dev Supabase project, then run again.\n`);
  process.exit(1);
}

// Present but identical is the same hazard, just harder to spot.
const clashes = CRITICAL.filter((k) => prod?.[k] && dev[k] === prod[k] && k !== "NEXT_PUBLIC_APP_URL");
if (clashes.length) {
  console.error(`\n  ${DEV} points at the same project as ${PROD}:\n`);
  for (const k of clashes) console.error(`    ${k}`);
  console.error(`\n  Use a separate Supabase project for development.\n`);
  process.exit(1);
}

console.log(`\n  dev → ${host(dev.NEXT_PUBLIC_SUPABASE_URL)}  (app at ${dev.NEXT_PUBLIC_APP_URL})\n`);
