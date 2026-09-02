/* Hand-rolled Supabase test doubles: the real client's builder chain is far too
   large to model faithfully here, so the fakes are deliberately loosely typed. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";

const state = { members: [] as any[], workspaces: [] as any[] };

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", email: "a@b.com" } } }) },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === "workspace_members"
              ? { data: state.members[0] ?? null }
              : { data: null },
          limit: () => ({
            maybeSingle: async () => ({ data: state.members[0] ?? null }),
          }),
        }),
      }),
      insert: (row: any) => ({
        select: () => ({
          single: async () => {
            const created = { id: "ws1", name: row.name ?? "n" };
            state.workspaces.push(created);
            state.members.push({ workspace_id: "ws1", name: created.name });
            return { data: created };
          },
        }),
      }),
    }),
  }),
}));

describe("getCurrentWorkspace", () => {
  it("creates a workspace on first login when none exists", async () => {
    const { getCurrentWorkspace } = await import("./actions");
    const ws = await getCurrentWorkspace();
    expect(ws?.id).toBe("ws1");
  });
});
