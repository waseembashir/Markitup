/* Hand-rolled Supabase test doubles: the real client's builder chain is far too
   large to model faithfully here, so these fakes cover only what is called. */
import { describe, it, expect, vi } from "vitest";

const calls = { rpc: [] as string[], inserted: [] as string[] };

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", email: "a@b.com" } } }) },
    rpc: async (fn: string) => {
      calls.rpc.push(fn);
      return fn === "ensure_workspace"
        ? { data: [{ id: "ws1", name: "A's Workspace" }], error: null }
        : { data: null, error: null };
    },
    from: (table: string) => ({
      insert: () => {
        calls.inserted.push(table);
        return { select: () => ({ single: async () => ({ data: null }) }) };
      },
    }),
  }),
}));

describe("getCurrentWorkspace", () => {
  it("returns the workspace ensure_workspace resolves to", async () => {
    const { getCurrentWorkspace } = await import("./actions");
    const ws = await getCurrentWorkspace();
    expect(ws).toEqual({ id: "ws1", name: "A's Workspace" });
    expect(calls.rpc).toContain("ensure_workspace");
  });

  // The duplicate-workspace bug was a read-then-insert in this function: the
  // layout and the page both called it, both found no membership, and both
  // inserted. Two callers cannot agree without something serializing them, so
  // the get-or-create belongs in one statement in the database. Creating a
  // workspace from application code here is the bug, whatever guard precedes it.
  it("never creates a workspace from application code", async () => {
    calls.inserted.length = 0;
    const { getCurrentWorkspace } = await import("./actions");
    await Promise.all([getCurrentWorkspace(), getCurrentWorkspace(), getCurrentWorkspace()]);
    expect(calls.inserted).not.toContain("workspaces");
    expect(calls.inserted).not.toContain("workspace_members");
  });
});
