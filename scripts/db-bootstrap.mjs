// Generates supabase/bootstrap.sql — every migration concatenated into one file
// you can paste into the Supabase SQL Editor to build a database from nothing.
//
//   node scripts/db-bootstrap.mjs
//
// This exists because the SQL Editor is the only way into a Supabase database
// from a machine that cannot reach the Postgres port (the direct endpoint is
// IPv6-only, and plenty of office networks are not). Without it, standing up a
// new environment means pasting 31 files in order and hoping you kept count.
//
// The output is NOT committed. It is derived from supabase/migrations/, and a
// stale copy in git is worse than no copy: the moment someone adds a migration,
// the checked-in file silently stops being a complete schema, and the person who
// finds out is whoever is restoring from a disaster. Regenerate it when needed.
//
// The trailing ledger inserts matter as much as the schema. They record every
// migration as applied, with the same checksums db-migrate.mjs computes, so a
// freshly bootstrapped database reports "up to date" instead of trying to run
// all 31 files again over a schema that already has them.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { checksum } from "./_checksum.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "supabase", "migrations");
const OUT = join(ROOT, "supabase", "bootstrap.sql");


const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort() // zero-padded numeric prefixes, so lexical order is apply order
  .map((filename) => {
    const sql = readFileSync(join(DIR, filename), "utf8");
    return { filename, sql, checksum: checksum(sql) };
  });

if (!files.length) {
  console.error(`No .sql files in ${DIR}`);
  process.exit(1);
}

const rule = "-- " + "=".repeat(70);
const parts = [
  `-- MarkUp — one-shot bootstrap for a FRESH database.`,
  `-- Generated from supabase/migrations/ (${files.length} files) by scripts/db-bootstrap.mjs.`,
  `-- Do not edit: regenerate with \`npm run db:bootstrap\`.`,
  `-- Paste into the Supabase SQL Editor and Run, once, on an empty project.`,
  ``,
  `create schema if not exists app_migrations;`,
  `create table if not exists app_migrations.applied (`,
  `  filename   text primary key,`,
  `  checksum   text not null,`,
  `  applied_at timestamptz not null default now()`,
  `);`,
  `alter table app_migrations.applied enable row level security;`,
  ``,
];

for (const f of files) {
  parts.push(rule, `-- ${f.filename}`, rule, f.sql.trimEnd(), ``);
}

parts.push(
  rule,
  `-- Record every migration as applied, so db-migrate.mjs sees a current database`,
  `-- rather than 31 pending files.`,
  rule,
  `insert into app_migrations.applied (filename, checksum) values`,
  files.map((f) => `  ('${f.filename}', '${f.checksum}')`).join(",\n") + ``,
  `on conflict (filename) do update set checksum = excluded.checksum;`,
  ``,
);

const text = parts.join("\n");
writeFileSync(OUT, text);
console.log(`wrote supabase/bootstrap.sql — ${files.length} migrations, ${text.split("\n").length} lines`);
console.log(`first  ${files[0].filename}`);
console.log(`last   ${files[files.length - 1].filename}`);
