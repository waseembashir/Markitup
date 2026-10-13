import { describe, it, expect } from "vitest";
import { needsAttention, quietFor, type AttentionRow } from "./attention";

const NOW = new Date("2026-10-13T12:00:00Z").getTime();
const daysAgo = (n: number) => new Date(NOW - n * 24 * 3600 * 1000).toISOString();

function row(over: Partial<AttentionRow> & { projectId: string }): AttentionRow {
  return {
    name: over.projectId,
    sharedAt: null,
    lastClientView: null,
    lastClientComment: null,
    openThreads: 0,
    fileRows: [{ mockupId: `${over.projectId}-f1`, openThreads: over.openThreads ?? 0, unread: over.unread }],
    ...over,
  };
}

describe("quietFor", () => {
  it("counts from the client's last visit, or from sharing if they never came", () => {
    expect(quietFor(row({ projectId: "p", lastClientView: daysAgo(4), sharedAt: daysAgo(9) }), NOW)?.days).toBe(4);
    expect(quietFor(row({ projectId: "p", sharedAt: daysAgo(9) }), NOW)?.days).toBe(9);
  });

  it("is nothing once the client has replied, or before anything was shared", () => {
    expect(quietFor(row({ projectId: "p", sharedAt: daysAgo(9), lastClientComment: daysAgo(1) }), NOW)).toBeNull();
    expect(quietFor(row({ projectId: "p" }), NOW)).toBeNull();
  });
});

describe("needsAttention", () => {
  it("puts unread client comments first, then long silences, then open comments", () => {
    const out = needsAttention(
      [
        row({ projectId: "open", openThreads: 2 }),
        row({ projectId: "quiet", sharedAt: daysAgo(5) }),
        row({ projectId: "new", unread: 3, unreadAt: daysAgo(0) }),
      ],
      NOW,
    );
    expect(out.map((a) => a.kind)).toEqual(["new", "quiet", "open"]);
  });

  it("lists each project once, under its most pressing reason", () => {
    const out = needsAttention([row({ projectId: "p", unread: 1, openThreads: 4, sharedAt: daysAgo(8) })], NOW);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("new");
  });

  it("leaves out a client who went quiet less than three days ago", () => {
    expect(needsAttention([row({ projectId: "p", lastClientView: daysAgo(2) })], NOW)).toEqual([]);
  });

  it("goes straight to the file when one file holds the news", () => {
    const r = row({ projectId: "p", unread: 2 });
    r.fileRows = [
      { mockupId: "a", openThreads: 0, unread: 2 },
      { mockupId: "b", openThreads: 0, unread: 0 },
    ];
    const [a] = needsAttention([r], NOW);
    expect(a.kind === "new" && a.href).toBe("/app/mockups/a");
  });

  it("orders news newest first and silences longest first", () => {
    const out = needsAttention(
      [
        row({ projectId: "older", unread: 1, unreadAt: daysAgo(2) }),
        row({ projectId: "newer", unread: 1, unreadAt: daysAgo(0) }),
        row({ projectId: "q4", sharedAt: daysAgo(4) }),
        row({ projectId: "q9", sharedAt: daysAgo(9) }),
      ],
      NOW,
    );
    expect(out.map((a) => a.projectId)).toEqual(["newer", "older", "q9", "q4"]);
  });
});
