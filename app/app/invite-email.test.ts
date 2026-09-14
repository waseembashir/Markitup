import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted so the (hoisted) vi.mock factory can read the per-scenario profile id.
const h = vi.hoisted(() => ({
  state: { profileId: null as string | null },
  sendEmail: vi.fn().mockResolvedValue({ ok: true }),
  rpc: vi.fn(async (name: string) => {
    if (name === "find_profile_id_by_email") return { data: h.state.profileId };
    // getCurrentWorkspace resolves the workspace through this call now, rather
    // than reading workspace_members and inserting when it finds nothing.
    if (name === "ensure_workspace") return { data: [{ id: "w1", name: "Apexure" }], error: null };
    return { error: null };
  }),
}));

vi.mock("@/lib/email/send", () => ({ sendEmail: h.sendEmail, EMAIL_FROM: "x" }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", user_metadata: { name: "Ravi" } } } }) },
    rpc: h.rpc, // null -> invitation path; id -> workspace_members path
    from: (table: string) => {
      if (table === "workspaces") return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "w1", name: "Apexure" } }) }) }),
      };
      if (table === "workspace_members") return {
        select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { workspace_id: "w1", workspaces: { id: "w1", name: "Apexure" } } }) }) }) }),
        insert: async () => ({ error: null }), // the existing-member branch
      };
      return { insert: async () => ({ error: null }) };
    },
  }),
}));

describe("addMemberByEmail invite email", () => {
  beforeEach(() => {
    h.sendEmail.mockClear();
    h.rpc.mockClear();
    h.state.profileId = null;
  });

  it("emails a brand-new invitee with a signup link", async () => {
    h.state.profileId = null; // no existing profile -> invitation path, isNewUser: true
    const { addMemberByEmail } = await import("./actions");
    const fd = new FormData();
    fd.set("email", "new@client.com");
    const res = await addMemberByEmail(fd);
    expect(res.invited).toBe(true);
    expect(h.sendEmail).toHaveBeenCalledOnce();
    expect(h.sendEmail.mock.calls[0][0].to).toBe("new@client.com");
    expect(h.sendEmail.mock.calls[0][0].html).toContain("/signup");
    expect(h.rpc.mock.calls.some((c) => c[0] === "create_notification")).toBe(false);
  });

  it("emails an existing member with a login link", async () => {
    h.state.profileId = "existing-user"; // existing profile -> workspace_members path, isNewUser: false
    const { addMemberByEmail } = await import("./actions");
    const fd = new FormData();
    fd.set("email", "member@client.com");
    const res = await addMemberByEmail(fd);
    expect(res.invited).toBe(false);
    expect(h.sendEmail).toHaveBeenCalledOnce();
    expect(h.sendEmail.mock.calls[0][0].to).toBe("member@client.com");
    expect(h.sendEmail.mock.calls[0][0].html).toContain("/login");
  });

  it("notifies an existing member when added to the workspace", async () => {
    h.state.profileId = "existing-user"; // existing profile -> workspace_members path
    const { addMemberByEmail } = await import("./actions");
    const fd = new FormData();
    fd.set("email", "member@client.com");
    await addMemberByEmail(fd);
    expect(h.rpc.mock.calls).toContainEqual([
      "create_notification",
      expect.objectContaining({ p_user_id: "existing-user", p_type: "invite" }),
    ]);
  });
});
