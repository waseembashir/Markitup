// Two ways to run SQL against a Supabase database, behind one interface.
//
// The direct Postgres connection is the obvious one, and when it works it is the
// better one. It is also the one that strands you: it needs the database
// password, which Supabase shows once at reset time, and which is embedded in a
// URL where a stray character silently changes it. A password that does not
// match is indistinguishable from a password that did not save, and neither
// tells you which it was — we burned an evening on exactly that, across ten
// resets, on a connection string that turned out to be correct in every part
// except the secret.
//
// The Management API is the way out. It runs SQL over HTTPS against a project,
// authenticated by an account-level personal access token rather than a database
// password. The token is displayed in a copyable field, can be regenerated
// freely, and is not wrapped in a URL, so the failure modes that bite passwords
// do not apply. It also reaches projects whose Postgres port is blocked by a
// network, which is the other way people get stranded here.
//
// Prefer the API when a token is present; fall back to Postgres otherwise.
import pg from "pg";

const API = "https://api.supabase.com";

// The project ref is the first label of the Supabase URL, so a token is the only
// new thing anyone has to supply.
export function projectRef(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const m = url.match(/^https?:\/\/([a-z0-9]+)\.supabase\./i);
  return m ? m[1] : null;
}

class ApiTransport {
  constructor(token, ref) {
    this.token = token;
    this.ref = ref;
    this.label = `project ${ref} via Management API`;
  }

  async connect() {
    // Fail here, with a clear reason, rather than midway through a migration.
    const r = await fetch(`${API}/v1/projects/${this.ref}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (r.status === 401) throw new Error("SUPABASE_ACCESS_TOKEN was rejected (401). Generate a new one at https://supabase.com/dashboard/account/tokens");
    if (r.status === 404) throw new Error(`No project ${this.ref} on this account (404). Check NEXT_PUBLIC_SUPABASE_URL and that the token belongs to the right account.`);
    if (!r.ok) throw new Error(`Management API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }

  async query(sql) {
    const r = await fetch(`${API}/v1/projects/${this.ref}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    const text = await r.text();
    if (!r.ok) {
      let msg = text.slice(0, 400);
      try {
        const j = JSON.parse(text);
        msg = j.message ?? j.error ?? msg;
      } catch {
        // not JSON; the raw body is the best message available
      }
      throw new Error(msg);
    }
    return { rows: text ? JSON.parse(text) : [] };
  }

  async end() {}
}

class PgTransport {
  constructor(url) {
    this.url = url;
    try {
      const u = new URL(url);
      this.label = `${u.hostname}:${u.port || 5432}${u.pathname} as ${u.username}`;
    } catch {
      this.label = "(unparseable connection string)";
    }
  }

  async connect() {
    this.client = new pg.Client({
      connectionString: this.url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });
    try {
      await this.client.connect();
    } catch (e) {
      if (e.code === "28P01") {
        throw new Error(
          "password authentication failed.\n" +
            "  The host and user in SUPABASE_DB_URL are reachable, so only the password is wrong.\n" +
            "  Rather than resetting it again, set SUPABASE_ACCESS_TOKEN and run over HTTPS instead:\n" +
            "  https://supabase.com/dashboard/account/tokens",
        );
      }
      throw e;
    }
  }

  async query(sql, params) {
    return this.client.query(sql, params);
  }

  async end() {
    await this.client?.end();
  }
}

// `sql` is trusted migration text from the repo, never user input.
export function makeTransport(env) {
  const token = env.SUPABASE_ACCESS_TOKEN?.trim();
  const ref = projectRef(env);
  if (token && ref) return new ApiTransport(token, ref);
  if (env.SUPABASE_DB_URL) return new PgTransport(env.SUPABASE_DB_URL);
  return null;
}
