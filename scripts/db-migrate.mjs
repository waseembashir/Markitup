// Migration runner with tracking.
//
// Until now migrations were applied one file at a time by hand, with nothing
// recording what had run. That made a second environment impossible to stand up
// safely: you could not ask a database how current it was, re-running a file
// errored halfway through, and nobody could tell whether an edited migration had
// ever been applied.
//
// This keeps a ledger in its own schema (not `public`, so PostgREST never
// exposes it) holding the filename, a checksum of its contents, and when it ran.
//
//   node scripts/db-migrate.mjs                 # status (read-only, the default)
//   node scripts/db-migrate.mjs --apply         # apply everything pending
//   node scripts/db-migrate.mjs --baseline      # record all as applied, run nothing
//   node scripts/db-migrate.mjs --rehash        # rewrite checksums that differ only in line endings
//   node scripts/db-migrate.mjs --apply --env .env.development.local
//
// Nothing is written unless --apply or --baseline is passed. Status is safe to
// run against production at any time.
//
// Reaches the database either over HTTPS with SUPABASE_ACCESS_TOKEN or directly
// with SUPABASE_DB_URL — see scripts/_transport.mjs for why the first exists.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { makeTransport } from "./_transport.mjs";
import { checksum, legacyChecksums } from "./_checksum.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "supabase", "migrations");

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valueOf = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

const MODE = has("--apply") ? "apply" : has("--baseline") ? "baseline" : has("--rehash") ? "rehash" : "status";
const ENV_FILE = valueOf("--env") ?? ".env.local";

function loadEnv(file) {
  let text = "";
  try {
    text = readFileSync(join(ROOT, file), "utf8");
  } catch {
    // an explicitly named env file that doesn't exist is a mistake worth saying
    if (file !== ".env.local") {
      console.error(`Env file not found: ${file}`);
      process.exit(2);
    }
  }
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}


// Filenames and checksums come from the repo, never from user input, but the
// HTTPS transport has no bind parameters, so quote them properly regardless.
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

function migrationFiles() {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort() // zero-padded numeric prefixes, so lexical order is apply order
    .map((filename) => {
      const sql = readFileSync(join(DIR, filename), "utf8");
      return { filename, sql, checksum: checksum(sql) };
    });
}

const LEDGER = `
  create schema if not exists app_migrations;
  create table if not exists app_migrations.applied (
    filename   text primary key,
    checksum   text not null,
    applied_at timestamptz not null default now()
  );
`;

async function main() {
  loadEnv(ENV_FILE);
  const client = makeTransport(process.env);
  if (!client) {
    console.error(`No way to reach the database (expected in ${ENV_FILE}):`);
    console.error(`  SUPABASE_ACCESS_TOKEN  — runs SQL over HTTPS, no database password needed`);
    console.error(`  SUPABASE_DB_URL        — a direct Postgres connection`);
    console.error(`\nGet a token at https://supabase.com/dashboard/account/tokens`);
    process.exit(2);
  }

  const files = migrationFiles();
  await client.connect();

  console.log(`target : ${client.label}`);
  console.log(`env    : ${ENV_FILE}`);
  console.log(`mode   : ${MODE}\n`);

  try {
    await client.query(LEDGER);
    const { rows } = await client.query("select filename, checksum, applied_at from app_migrations.applied");
    const applied = new Map(rows.map((r) => [r.filename, r]));

    const pending = files.filter((f) => !applied.has(f.filename));
    // A file whose contents changed after it was applied: the database and the
    // repo disagree, and no re-run will reconcile them silently.
    const drifted = files.filter((f) => applied.has(f.filename) && applied.get(f.filename).checksum !== f.checksum);
    const orphans = [...applied.keys()].filter((n) => !files.some((f) => f.filename === n));

    if (MODE === "status") {
      console.log(`applied : ${applied.size}`);
      console.log(`pending : ${pending.length}`);
      for (const f of pending) console.log(`   + ${f.filename}`);
      if (drifted.length) {
        console.log(`\ndrift   : ${drifted.length} file(s) changed since they were applied`);
        for (const f of drifted) console.log(`   ~ ${f.filename}`);
        console.log("   The database was built from a different version of these files.");
      }
      if (orphans.length) {
        console.log(`\norphans : ${orphans.length} recorded but missing from the repo`);
        for (const n of orphans) console.log(`   ? ${n}`);
      }
      if (!pending.length && !drifted.length && !orphans.length) console.log("\nup to date.");
      return;
    }

    if (MODE === "rehash") {
      // Checksums used to be taken over raw bytes, so a file checked out with
      // CRLF line endings hashed differently from the same file with LF — and
      // git on Windows does exactly that rewrite. This updates recorded
      // checksums to the normalized form, but ONLY where the recorded value
      // matches this file's own LF or CRLF bytes. A recorded checksum matching
      // neither means the content genuinely changed after it was applied; that
      // is real drift, and it is reported and left alone rather than laundered
      // away, because hiding it is the one thing this tool must never do.
      let fixed = 0;
      const real = [];
      for (const f of drifted) {
        const recorded = applied.get(f.filename).checksum;
        if (legacyChecksums(f.sql).has(recorded)) {
          await client.query(
            `update app_migrations.applied set checksum = ${lit(f.checksum)} where filename = ${lit(f.filename)}`,
          );
          console.log(`rehashed  ${f.filename}  (line endings only)`);
          fixed++;
        } else {
          real.push(f.filename);
        }
      }
      if (!drifted.length) console.log("nothing to rehash — every checksum already matches.");
      if (real.length) {
        console.log(`\nREAL DRIFT, not touched — content differs from what was applied:`);
        for (const n of real) console.log(`   ~ ${n}`);
        process.exitCode = 1;
      }
      if (fixed) console.log(`\nrehashed ${fixed} checksum(s). No SQL was executed.`);
      return;
    }

    if (MODE === "baseline") {
      // For a database that already has every migration applied by hand: record
      // them so the runner agrees with reality, without executing anything.
      if (!pending.length) {
        console.log("nothing to baseline — every migration is already recorded.");
        return;
      }
      for (const f of pending) {
        await client.query(
          `insert into app_migrations.applied (filename, checksum)
           values (${lit(f.filename)}, ${lit(f.checksum)})
           on conflict (filename) do nothing`,
        );
        console.log(`recorded  ${f.filename}`);
      }
      console.log(`\nbaselined ${pending.length} migration(s). Nothing was executed.`);
      return;
    }

    // apply
    if (drifted.length) {
      console.error("Refusing to apply: these files changed after being applied —");
      for (const f of drifted) console.error(`   ~ ${f.filename}`);
      console.error("Resolve by writing a new migration, or re-baseline if the change was intentional.");
      process.exit(1);
    }
    if (!pending.length) {
      console.log("nothing pending.");
      return;
    }

    for (const f of pending) {
      process.stdout.write(`applying  ${f.filename} ... `);
      // Each migration is its own transaction: a failure rolls that file back
      // and stops, rather than leaving the schema half-changed. The ledger row
      // goes in the same transaction, so a database can never hold a migration
      // it has no record of, or a record of one that did not run.
      //
      // Sent as a single statement rather than begin/…/commit round trips: over
      // HTTPS each request is its own session, so a separate "begin" would open
      // a transaction that the next request could never see. Postgres aborts the
      // whole block on any error here, and the trailing commit then commits
      // nothing — the same guarantee, one round trip.
      const sql = [
        "begin;",
        f.sql,
        `insert into app_migrations.applied (filename, checksum)
         values (${lit(f.filename)}, ${lit(f.checksum)});`,
        "commit;",
      ].join("\n");
      try {
        await client.query(sql);
        console.log("ok");
      } catch (e) {
        console.log("FAILED");
        console.error(`\n${f.filename}: ${e.message}`);
        console.error("Rolled back. Nothing after this file was applied.");
        process.exit(1);
      }
    }
    console.log(`\napplied ${pending.length} migration(s).`);
  } finally {
    await client.end();
  }
}

// A connection that cannot be made is an operator problem, not a bug. Print the
// reason and nothing else — a stack trace here buries the one line that matters.
//
// Set exitCode rather than calling process.exit: the HTTPS transport leaves a
// keep-alive socket open, and tearing the process down on top of it trips a
// libuv assertion on Windows that looks alarming and means nothing.
try {
  await main();
} catch (e) {
  console.error(`\n${e.message}\n`);
  process.exitCode = 1;
}
