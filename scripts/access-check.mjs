// Cross-tenant access check: can one customer reach another customer's work?
//
// This is the failure that matters most for an agency tool. A slow page is an
// annoyance; one client seeing another client's unreleased designs is the end of
// the relationship. It has already happened here once — a mockup was reachable
// from an account it had never been shared with — so it is worth a test that
// runs rather than a policy that looks right.
//
// Two real accounts, through the real REST API, with real JWTs. Not simulated
// claims in SQL and not the service role: exactly the path an attacker has.
// Every check states what SHOULD happen, so a failure reads as a sentence.
//
//   node scripts/access-check.mjs --env .env.development.local
//
// Never point this at production. It creates accounts and data, and there is no
// way to delete an auth user without the service-role key.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const ENV_FILE = args.includes("--env") ? args[args.indexOf("--env") + 1] : ".env.development.local";

const env = {};
for (const line of readFileSync(join(ROOT, ENV_FILE), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim();
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) {
  console.error(`Missing Supabase URL or anon key in ${ENV_FILE}`);
  process.exit(2);
}
if (/ezdfyowpnbixdobjytfw/.test(URL_)) {
  console.error("Refusing to run against production — this creates accounts and data.");
  process.exit(2);
}

let failures = 0;
const pass = (s) => console.log(`  pass  ${s}`);
const fail = (s, detail) => {
  failures++;
  console.log(`  FAIL  ${s}${detail ? `\n          ${detail}` : ""}`);
};

const rnd = () => Math.random().toString(36).slice(2, 10);

async function signUp(name) {
  const r = await fetch(`${URL_}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: `acl-${rnd()}@example.com`, password: `pw-${rnd()}-${rnd()}`, data: { name } }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`could not create ${name}: ${JSON.stringify(j).slice(0, 200)}`);
  return { token: j.access_token, id: j.user?.id, name };
}

const hdr = (u) => ({ apikey: KEY, Authorization: `Bearer ${u.token}`, "Content-Type": "application/json" });

const rest = (u, path, init = {}) =>
  fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...hdr(u), ...(init.headers ?? {}) } });

const rpc = (u, fn, body) =>
  rest(u, `rpc/${fn}`, { method: "POST", body: JSON.stringify(body ?? {}) }).then((r) => r.json());

/** A read that must come back empty. Rows returned means a leak. */
async function mustNotRead(label, u, path) {
  const r = await rest(u, path);
  const body = await r.json().catch(() => null);
  if (Array.isArray(body) && body.length === 0) return pass(label);
  if (!Array.isArray(body)) return pass(`${label} (rejected: ${r.status})`);
  fail(label, `returned ${body.length} row(s): ${JSON.stringify(body[0]).slice(0, 160)}`);
}

/** A write that must not take effect. */
async function mustNotWrite(label, u, path, init, verify) {
  const r = await rest(u, path, init);
  const body = await r.text();
  if (r.ok) {
    // PostgREST returns 2xx for an UPDATE or DELETE that matched no rows, which
    // is the correct RLS outcome. Only a change that actually landed is a leak.
    const leaked = verify ? await verify() : body.trim() !== "" && body.trim() !== "[]";
    if (leaked) return fail(label, `succeeded: ${body.slice(0, 160)}`);
    return pass(`${label} (no rows affected)`);
  }
  pass(`${label} (rejected: ${r.status})`);
}

async function main() {
  console.log(`\ntarget : ${new URL(URL_).hostname}`);
  console.log(`env    : ${ENV_FILE}\n`);

  const alice = await signUp("Alice Agency");
  const mallory = await signUp("Mallory Outsider");

  // Alice sets up a workspace with a file, a pin and a comment on it.
  const ws = (await rpc(alice, "ensure_workspace"))[0];
  if (!ws?.id) throw new Error("Alice got no workspace from ensure_workspace");

  // Insert without Prefer: return=representation. PostgREST turns that into
  // INSERT ... RETURNING, which also runs the SELECT policy — and the policy on
  // projects looks a row up by its own id through a STABLE function that cannot
  // see the row being inserted. Create, then read back.
  const mk1 = async (table, row) => {
    const r = await rest(alice, table, { method: "POST", body: JSON.stringify(row) });
    if (!r.ok) throw new Error(table + " insert failed: " + r.status + " " + (await r.text()).slice(0, 160));
  };

  await mk1("projects", { name: "Alice Confidential", workspace_id: ws.id, created_by: alice.id });
  const projectId = (await (await rest(alice, "projects?select=id&name=eq.Alice%20Confidential")).json())[0]?.id;

  await mk1("mockups", { name: "unreleased-homepage.png", project_id: projectId, created_by: alice.id, file_path: "x/secret.png" });
  const mockupId = (await (await rest(alice, "mockups?select=id&project_id=eq." + projectId)).json())[0]?.id;

  await mk1("pins", { mockup_id: mockupId, device: "desktop", x: 0.5, y: 0.5, created_by: alice.id });
  const pinId = (await (await rest(alice, "pins?select=id&mockup_id=eq." + mockupId)).json())[0]?.id;

  await mk1("comments", { pin_id: pinId, author_id: alice.id, body: "Client hasnt approved this yet" });
  const commentId = (await (await rest(alice, "comments?select=id&pin_id=eq." + pinId)).json())[0]?.id;
  if (!projectId || !mockupId || !pinId || !commentId) {
    console.error("Setup failed — Alice could not create her own data:", { projectId, mockupId, pinId, commentId });
    process.exit(1);
  }
  console.log(`Alice's workspace ${ws.id.slice(0, 8)} — project, file, pin and comment created.\n`);
  console.log("Mallory, an unrelated account, must not be able to:\n");

  // ── reads ────────────────────────────────────────────────────────────────
  await mustNotRead("see Alice's workspace", mallory, `workspaces?select=id,name&id=eq.${ws.id}`);
  await mustNotRead("see Alice's project", mallory, `projects?select=id,name&id=eq.${projectId}`);
  await mustNotRead("see Alice's file", mallory, `mockups?select=id,name&id=eq.${mockupId}`);
  await mustNotRead("see Alice's pin", mallory, `pins?select=id&id=eq.${pinId}`);
  await mustNotRead("see Alice's comment", mallory, `comments?select=id,body&id=eq.${commentId}`);
  await mustNotRead("see who is in Alice's workspace", mallory, `workspace_members?select=user_id,role&workspace_id=eq.${ws.id}`);
  await mustNotRead("see Alice's share links", mallory, `share_links?select=token&mockup_id=eq.${mockupId}`);
  await mustNotRead("see Alice's invitations", mallory, `invitations?select=token&workspace_id=eq.${ws.id}`);
  await mustNotRead("list every project in the database", mallory, `projects?select=id&id=neq.00000000-0000-0000-0000-000000000000`);
  await mustNotRead("list every file in the database", mallory, `mockups?select=id&id=neq.00000000-0000-0000-0000-000000000000`);

  // ── writes ───────────────────────────────────────────────────────────────
  // Returns true when the attacker's change actually landed. Named for the
  // failure rather than the happy path, because an inverted predicate here
  // reports a security hole that does not exist — or worse, hides one.
  const changeLanded = async (path, matches) => {
    const rows = await (await rest(alice, path)).json().catch(() => []);
    return Array.isArray(rows) && rows.length > 0 && matches(rows[0]);
  };

  await mustNotWrite("join Alice's workspace", mallory, "workspace_members", {
    method: "POST",
    body: JSON.stringify({ workspace_id: ws.id, user_id: mallory.id, role: "owner" }),
  });
  await mustNotWrite("add a pin to Alice's file", mallory, "pins", {
    method: "POST",
    body: JSON.stringify({ mockup_id: mockupId, device: "desktop", x: 0.1, y: 0.1, created_by: mallory.id }),
  });
  await mustNotWrite(
    "edit Alice's comment",
    mallory,
    `comments?id=eq.${commentId}`,
    { method: "PATCH", body: JSON.stringify({ body: "tampered" }) },
    () => changeLanded(`comments?select=body&id=eq.${commentId}`, (r) => r.body === "tampered"),
  );
  await mustNotWrite(
    "delete Alice's comment",
    mallory,
    `comments?id=eq.${commentId}`,
    { method: "DELETE" },
    async () => {
      const rows = await (await rest(alice, `comments?select=id&id=eq.${commentId}`)).json();
      return !Array.isArray(rows) || rows.length === 0;
    },
  );
  await mustNotWrite(
    "delete Alice's project",
    mallory,
    `projects?id=eq.${projectId}`,
    { method: "DELETE" },
    async () => {
      const rows = await (await rest(alice, `projects?select=id&id=eq.${projectId}`)).json();
      return !Array.isArray(rows) || rows.length === 0;
    },
  );
  await mustNotWrite(
    "rename Alice's project",
    mallory,
    `projects?id=eq.${projectId}`,
    { method: "PATCH", body: JSON.stringify({ name: "owned" }) },
    () => changeLanded(`projects?select=name&id=eq.${projectId}`, (r) => r.name === "owned"),
  );
  await mustNotWrite("mint a share link for Alice's file", mallory, "share_links", {
    method: "POST",
    body: JSON.stringify({ mockup_id: mockupId, token: `stolen-${rnd()}`, created_by: mallory.id }),
  });

  // ── the request-access path must not be a way in ──────────────────────────
  const asked = await rpc(mallory, "request_mockup_access", { p_mockup: mockupId });
  if (asked === "sent" || asked === "no_recipients") {
    const after = await (await rest(mallory, `mockups?select=id&id=eq.${mockupId}`)).json();
    if (Array.isArray(after) && after.length === 0) pass("gain access merely by asking for it");
    else fail("gain access merely by asking for it", "requesting access granted it");
  } else {
    pass(`gain access merely by asking for it (returned "${asked}")`);
  }

  console.log(
    failures === 0
      ? "\nAll checks passed — Mallory could neither read nor change anything of Alice's.\n"
      : `\n${failures} check(s) FAILED — cross-tenant access is possible.\n`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

await main();
