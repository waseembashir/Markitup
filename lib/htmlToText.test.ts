import { describe, it, expect } from "vitest";
import { htmlToText } from "./format";

describe("htmlToText", () => {
  it("turns a line break into a space instead of showing the tag", () => {
    // This is the bug: the rail printed "can we have icons relevant<br />".
    expect(htmlToText("can we have icons relevant<br />")).toBe("can we have icons relevant");
  });

  it("keeps words apart across a break", () => {
    expect(htmlToText("first line<br>second line")).toBe("first line second line");
  });

  it("strips formatting but keeps the words", () => {
    expect(htmlToText("<b>on hover</b> animate is <i>cluttered</i>")).toBe("on hover animate is cluttered");
  });

  it("separates list items and paragraphs", () => {
    expect(htmlToText("<ul><li>one</li><li>two</li></ul>")).toBe("one two");
    expect(htmlToText("<p>one</p><p>two</p>")).toBe("one two");
  });

  it("decodes entities back to the characters they stand for", () => {
    expect(htmlToText("Tom &amp; Jerry")).toBe("Tom & Jerry");
    expect(htmlToText("&lt;div&gt; is a tag")).toBe("<div> is a tag");
    expect(htmlToText("it&#39;s fine")).toBe("it's fine");
  });

  it("does not double-decode an escaped entity", () => {
    // "&amp;lt;" means the literal text "&lt;", not a "<".
    expect(htmlToText("&amp;lt;")).toBe("&lt;");
  });

  it("collapses the whitespace a stripped tag leaves behind", () => {
    expect(htmlToText("<p>  spaced   out  </p>")).toBe("spaced out");
  });

  it("handles an empty or missing body", () => {
    expect(htmlToText("")).toBe("");
    expect(htmlToText(undefined as unknown as string)).toBe("");
  });
});
