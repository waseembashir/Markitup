import { describe, it, expect } from "vitest";
import { htmlScrollDelta } from "./MockupViewer";

// A 6000px page shown through an 800px-tall canvas.
const PAGE = 6000;
const VIEW = 800;
const pin = (y: number, h = 0) => ({ y, h });

describe("scrolling an HTML page to a selected comment", () => {
  it("centres a pin that is far below the fold", () => {
    // Pin sits at 3000px; centring it means scrolling to 3000 - 400.
    expect(htmlScrollDelta(pin(0.5), PAGE, VIEW, 0)).toBe(2600);
  });

  it("scrolls backwards for a pin above the current position", () => {
    expect(htmlScrollDelta(pin(0.1), PAGE, VIEW, 3000)).toBeLessThan(0);
  });

  it("centres a region on its middle, not its top edge", () => {
    const point = htmlScrollDelta(pin(0.5), PAGE, VIEW, 0)!;
    const region = htmlScrollDelta(pin(0.5, 0.1), PAGE, VIEW, 0)!;
    // The region extends 600px below its anchor, so its centre is 300px lower.
    expect(region - point).toBe(300);
  });

  it("never scrolls above the top of the page", () => {
    // A pin near the very top would otherwise ask for a negative offset.
    expect(htmlScrollDelta(pin(0.01), PAGE, VIEW, 0)).toBe(0);
  });

  it("never scrolls past the bottom of the page", () => {
    const dy = htmlScrollDelta(pin(0.99), PAGE, VIEW, 0)!;
    expect(dy).toBe(PAGE - VIEW);
  });

  it("does nothing until the page has reported its height", () => {
    // Acting on a height of 0 would fling the reader to the top of the page.
    expect(htmlScrollDelta(pin(0.5), 0, VIEW, 1200)).toBeNull();
  });

  it("stays put when the pin is already centred", () => {
    expect(htmlScrollDelta(pin(0.5), PAGE, VIEW, 2600)).toBe(0);
  });
});
