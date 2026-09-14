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
//   node scripts/db-migrate.mjs --apply --env .env.development.local
//
// Nothing is written unless --apply or --baseline is passed. Status is safe to
// run against production at any time.
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "supabase", "migrations");

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valueOf = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

const MODE = has("--apply") ? "apply" : has("--baseline") ? "baseline" : "status";
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

// Never print the password, but always print WHICH database is about to change —
// applying dev migrations to production is the mistake worth engineering against.
function describe(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || 5432}${u.pathname} as ${u.username}`;
  } catch {
    return "(unparseable connection string)";
  }
}

const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

function migrationFiles() {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort() // zero-padded numeric prefixes, so lexical order is apply order
    .map((filename) => {
      const sql = readFileSync(join(DIR, filename), "utf8");
      return { filename, sql, checksum: sha(sql) };
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
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error(`SUPABASE_DB_URL not set (expected in ${ENV_FILE})`);
    process.exit(2);
  }

  const files = migrationFiles();
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();

  console.log(`target : ${describe(url)}`);
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

    if (MODE === "baseline") {
      // For a database that already has every migration applied by hand: record
      // them so the runner agrees with reality, without executing anything.
      if (!pending.length) {
        console.log("nothing to baseline — every migration is already recorded.");
        return;
      }
      for (const f of pending) {
        await client.query(
          "insert into app_migrations.applied (filename, checksum) values ($1, $2) on conflict (filename) do nothing",
          [f.filename, f.checksum],
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
      // and stops, rather than leaving the schema half-changed.
      await client.query("begin");
      try {
        await client.query(f.sql);
        await client.query(
          "insert into app_migrations.applied (filename, checksum) values ($1, $2)",
          [f.filename, f.checksum],
        );
        await client.query("commit");
        console.log("ok");
      } catch (e) {
        await client.query("rollback");
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

await main();
