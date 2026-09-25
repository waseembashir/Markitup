import { describe, it, expect } from "vitest";
import { commentSlackMessage, commentRollupSlackMessage, mockupSlackWebhook, commentIsFromClient, SLACK_BATCH_WINDOW_MINUTES } from "./slack";
import { encryptSecret } from "./crypto";

// Slack renders `text` in notifications and previews, so that string is what
// actually reaches someone's phone — worth asserting, not just the blocks.
describe("Slack comment messages", () => {
  it("names the person and the project in the burst-opening message", () => {
    const m = commentSlackMessage({
      commenter: "Vinay Rajput",
      projectName: "Insight CLA",
      mockupName: "hero.png",
      body: "the mouth icon shows a knee bone",
      href: "https://x/app/mockups/m1",
    });
    expect(m.text).toBe("Vinay Rajput commented on Insight CLA");
    expect(JSON.stringify(m.blocks)).toContain("the mouth icon shows a knee bone");
    expect(JSON.stringify(m.blocks)).toContain("hero.png");
  });

  it("escapes Slack markup so a comment can't forge formatting", () => {
    const m = commentSlackMessage({
      commenter: "Vinay",
      projectName: "P",
      mockupName: "a.png",
      body: "<!channel> & <https://evil.test|click>",
      href: "https://x",
    });
    const blocks = JSON.stringify(m.blocks);
    expect(blocks).not.toContain("<!channel>");
    expect(blocks).toContain("&lt;!channel&gt;");
  });

  it("truncates a very long comment rather than flooding the channel", () => {
    const m = commentSlackMessage({
      commenter: "Vinay",
      projectName: "P",
      mockupName: "a.png",
      body: "x".repeat(1000),
      href: "https://x",
    });
    expect(JSON.stringify(m.blocks)).not.toContain("x".repeat(301));
  });

  it("counts the rest of the burst in one roll-up", () => {
    const m = commentRollupSlackMessage({
      commenter: "Vinay Rajput",
      projectName: "Insight CLA",
      count: 6,
      href: "https://x/app/mockups/m1",
    });
    expect(m.text).toBe("Vinay Rajput left 6 more comments on Insight CLA");
  });

  it("says 'comment' rather than 'comments' for a single one", () => {
    const m = commentRollupSlackMessage({
      commenter: "Vinay",
      projectName: "P",
      count: 1,
      href: "https://x",
    });
    expect(m.text).toBe("Vinay left 1 more comment on P");
  });

  it("does not quote any single comment in the roll-up", () => {
    // Quoting one of six would misrepresent the other five.
    const m = commentRollupSlackMessage({ commenter: "V", projectName: "P", count: 6, href: "https://x" });
    expect(JSON.stringify(m.blocks)).not.toContain(">");
  });

  it("uses a window long enough to swallow a review session", () => {
    expect(SLACK_BATCH_WINDOW_MINUTES).toBe(15);
  });
});

// A client commenting through a share link is NOT a workspace member, and the
// RLS policy on workspace_integrations only lets members read the row. Looking
// the webhook up through the commenter's own session therefore found nothing
// for exactly the person whose comment matters most, so their comments were
// never announced. The lookup goes through a security-definer function keyed on
// the file they are allowed to comment on.
describe("finding the webhook as whoever is commenting", () => {
  process.env.FIGMA_TOKEN_SECRET = "test-secret-at-least-16-characters";
  const cipher = encryptSecret("https://hooks.slack.com/services/T/B/xyz");

  function fakeSupabase(impl: (fn: string, args: unknown) => unknown) {
    return { rpc: async (fn: string, args: unknown) => impl(fn, args) } as never;
  }

  it("asks for the webhook by the file the commenter can see", async () => {
    let asked: unknown = null;
    const supabase = fakeSupabase((fn, args) => {
      expect(fn).toBe("slack_webhook_for_mockup");
      asked = args;
      return { data: [{ cipher: cipher.cipher, iv: cipher.iv }], error: null };
    });
    const url = await mockupSlackWebhook(supabase, "mk-1");
    expect(asked).toEqual({ p_mockup: "mk-1" });
    expect(url).toBe("https://hooks.slack.com/services/T/B/xyz");
  });

  it("returns null when the workspace has no Slack connected", async () => {
    const supabase = fakeSupabase(() => ({ data: [], error: null }));
    expect(await mockupSlackWebhook(supabase, "mk-1")).toBeNull();
  });

  it("returns null rather than throwing when the function is missing", async () => {
    const supabase = fakeSupabase(() => ({ data: null, error: { message: "function does not exist" } }));
    expect(await mockupSlackWebhook(supabase, "mk-1")).toBeNull();
  });
});

// The channel is for the people who are not in the room. A teammate's comment
// is a conversation the team is already having.
describe("whose comments the channel is for", () => {
  const team = ["u-vinay", "u-israfil"];

  it("announces someone who is not on the team", () => {
    expect(commentIsFromClient("u-client", team)).toBe(true);
  });

  it("stays quiet for a team member", () => {
    expect(commentIsFromClient("u-israfil", team)).toBe(false);
  });

  it("announces a guest, whose empty roster is the answer and not an error", () => {
    // RLS shows a non-member no rows at all, which is how a guest reads.
    expect(commentIsFromClient("guest-anon", [])).toBe(true);
  });

  it("treats a project-only collaborator as a client", () => {
    // They can see the file but are not in the workspace, which is the same
    // line the dashboard draws for "Seen by" and client replies.
    expect(commentIsFromClient("u-collaborator", team)).toBe(true);
  });
});
