import { describe, it, expect } from "vitest";
import { quietFor, type Standing } from "./attention";

const NOW = new Date("2026-10-13T12:00:00Z").getTime();
const daysAgo = (n: number) => new Date(NOW - n * 24 * 3600 * 1000).toISOString();

function row(over: Partial<Standing> & { projectId: string }): Standing {
  return { sharedAt: null, lastClientView: null, lastClientComment: null, ...over };
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
