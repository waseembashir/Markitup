// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

type SetAll = (c: { name: string; value: string; options?: object }[]) => void;

let user: { id: string } | null = null;
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

import { updateSession } from "./middleware";

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
