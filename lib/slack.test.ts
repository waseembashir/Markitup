import { describe, it, expect } from "vitest";
import { commentSlackMessage, commentRollupSlackMessage, SLACK_BATCH_WINDOW_MINUTES } from "./slack";

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
