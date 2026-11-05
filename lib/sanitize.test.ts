import { describe, it, expect } from "vitest";
import { sanitizeCommentHtml, htmlToPlainText, mentionedUserIds } from "./sanitize";

describe("sanitizeCommentHtml", () => {
  it("keeps allowed formatting", () => {
    const out = sanitizeCommentHtml("<b>bold</b> <i>it</i> <ul><li>x</li></ul>");
    expect(out).toContain("<b>bold</b>");
    expect(out).toContain("<li>x</li>");
  });
  it("strips scripts and event handlers", () => {
    const out = sanitizeCommentHtml('<img src=x onerror=alert(1)><script>alert(1)</script>hi');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("onerror");
    expect(out).toContain("hi");
  });
  it("keeps safe links, drops javascript: urls", () => {
    expect(sanitizeCommentHtml('<a href="https://x.com">x</a>')).toContain('href="https://x.com"');
    expect(sanitizeCommentHtml('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
  });
  it("auto-links a bare pasted URL", () => {
    const out = sanitizeCommentHtml("see https://apexure.com/page for details");
    expect(out).toContain('href="https://apexure.com/page"');
    expect(out).toContain("https://apexure.com/page</a>");
  });
  it("does not double-link a URL already inside an anchor", () => {
    const out = sanitizeCommentHtml('<a href="https://x.com">https://x.com</a>');
    expect(out.match(/<a /g)?.length).toBe(1);
  });
  it("a URL carrying a stray quote cannot inject an attribute", () => {
    const out = sanitizeCommentHtml('https://x.com/a" onmouseover="alert(1)');
    // The word may survive as inert text, but never as an attribute inside a tag.
    expect(out).not.toMatch(/<[^>]*\son\w+\s*=/i);
  });
  it("keeps a mention chip and exposes its user id", () => {
    const html = '<span class="mention" data-mention="user-1">@Cara</span> hi';
    const out = sanitizeCommentHtml(html);
    expect(out).toContain('data-mention="user-1"');
    expect(out).toContain("@Cara");
    expect(mentionedUserIds(out)).toEqual(["user-1"]);
  });
  it("drops a disallowed class on a span", () => {
    const out = sanitizeCommentHtml('<span class="evil" data-mention="x">@a</span>');
    expect(out).not.toContain("evil");
  });
});

describe("htmlToPlainText", () => {
  it("strips all tags, leaving text", () => {
    const out = htmlToPlainText("<b>hi</b><script>x</script>");
    expect(out).toContain("hi");
    expect(out).not.toContain("<b>");
    expect(out).not.toContain("<script");
  });
});
