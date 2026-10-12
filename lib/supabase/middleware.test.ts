import { describe, it, expect, vi } from "vitest";

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));

import { guestMayOpen } from "./middleware";

describe("guestMayOpen", () => {
  it("lets a guest open the file they were shared, its page frame and compare", () => {
    expect(guestMayOpen("/app/mockups/m1")).toBe(true);
    expect(guestMayOpen("/app/mockups/m1/html")).toBe(true);
    expect(guestMayOpen("/app/projects/p1/compare")).toBe(true);
  });

  it("keeps a guest out of everything that belongs to a workspace", () => {
    // A guest has no workspace: these showed an empty dashboard and a profile
    // with no email, which looked like the account had lost its projects.
    for (const p of ["/app", "/app/projects", "/app/projects/p1", "/app/profile", "/app/settings", "/app/archive", "/app/members", "/app/requests"]) {
      expect(guestMayOpen(p)).toBe(false);
    }
  });
});
