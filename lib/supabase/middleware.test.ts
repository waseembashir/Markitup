// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

type SetAll = (c: { name: string; value: string; options?: object }[]) => void;

let user: { id: string; is_anonymous?: boolean } | null = null;
let refreshCookie = false;

// Stands in for Supabase: getUser() reports whoever `user` is, and can refresh
// the session cookie the way a real token refresh does mid-request.
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, opts: { cookies: { setAll: SetAll } }) => ({
    auth: {
      getUser: async () => {
        if (refreshCookie) {
          opts.cookies.setAll([{ name: "sb-token", value: "fresh", options: { path: "/" } }]);
        }
        return { data: { user } };
      },
    },
  }),
}));

import { updateSession, guestMayOpen } from "./middleware";

const req = (path: string) => new NextRequest(new URL(path, "https://markup.test"));

describe("updateSession on the landing page", () => {
  beforeEach(() => {
    user = null;
    refreshCookie = false;
  });

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
    // Dropping it would sign the user out on their very next request.
    user = { id: "u1" };
    refreshCookie = true;
    const res = await updateSession(req("/"));
    expect(res.status).toBe(307);
    expect(res.cookies.get("sb-token")?.value).toBe("fresh");
  });

  it("leaves every other path alone for signed-in users", async () => {
    user = { id: "u1" };
    for (const path of ["/login", "/app", "/s/abc", "/signup"]) {
      const res = await updateSession(req(path));
      expect(res.headers.get("location")).toBeNull();
    }
  });
});

describe("updateSession for a guest from a share link", () => {
  beforeEach(() => {
    user = { id: "g1", is_anonymous: true };
    refreshCookie = false;
  });

  it("shows a guest the landing page instead of an empty app", async () => {
    // A guest has no workspace. Sending them to /app showed a teammate whose
    // browser still held a guest session an empty dashboard and no projects.
    const res = await updateSession(req("/"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("sends a guest who wanders into the workspace to log in, saying why", async () => {
    for (const path of ["/app", "/app/projects", "/app/projects/p1", "/app/profile", "/app/settings"]) {
      const res = await updateSession(req(path));
      expect(res.status).toBe(307);
      const to = new URL(res.headers.get("location")!);
      expect(to.pathname + to.search).toBe("/login?guest=1");
    }
  });

  it("lets a guest keep reviewing the file they were shared", async () => {
    for (const path of ["/app/mockups/m1", "/app/mockups/m1/html", "/app/projects/p1/compare", "/s/abc"]) {
      const res = await updateSession(req(path));
      expect(res.headers.get("location")).toBeNull();
    }
  });
});

describe("guestMayOpen", () => {
  it("covers a file, its page frame and compare, and nothing of a workspace", () => {
    expect(guestMayOpen("/app/mockups/m1")).toBe(true);
    expect(guestMayOpen("/app/mockups/m1/html")).toBe(true);
    expect(guestMayOpen("/app/projects/p1/compare")).toBe(true);
    for (const p of ["/app", "/app/projects", "/app/projects/p1", "/app/profile", "/app/archive", "/app/members", "/app/requests"]) {
      expect(guestMayOpen(p)).toBe(false);
    }
  });
});
