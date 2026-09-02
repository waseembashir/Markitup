import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MockupViewer } from "./MockupViewer";
import { createPin, addComment } from "@/app/app/mockups/[mockupId]/actions";

vi.mock("@/app/app/mockups/[mockupId]/actions", () => ({
  createPin: vi.fn(async () => ({ id: "p1", number: 1 })),
  // Echo the submitted body as the server-sanitized body the client renders.
  addComment: vi.fn(async (_m: string, _p: string, body: string) => ({ body })),
  setPinStatus: vi.fn(async () => ({})),
}));

const mockCreatePin = vi.mocked(createPin);
const mockAddComment = vi.mocked(addComment);

// jsdom has no layout; stub the image's bounding rect + ResizeObserver
beforeEach(() => {
  mockCreatePin.mockReset();
  mockCreatePin.mockResolvedValue({ id: "p1", number: 1 });
  mockAddComment.mockReset();
  mockAddComment.mockImplementation(async (_m: string, _p: string, body: string) => ({ body }));
  Element.prototype.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
  Object.assign(global, {
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
});

// A press-and-release that doesn't move: the viewer treats anything under the
// 4px drag threshold as a point pin, which is what a plain click used to do.
function tap(el: Element, at: { clientX: number; clientY: number } = { clientX: 0, clientY: 0 }) {
  fireEvent.pointerDown(el, { button: 0, ...at });
  fireEvent.pointerUp(document, at);
}

// Press, move, release — drags out a region.
function dragOut(el: Element, from: { clientX: number; clientY: number }, to: { clientX: number; clientY: number }) {
  fireEvent.pointerDown(el, { button: 0, ...from });
  fireEvent.pointerMove(document, to);
  fireEvent.pointerUp(document, to);
}

function renderViewer() {
  return render(
    <MockupViewer
      mockupId="m1"
      projectId="proj1"
      imageUrl="http://x/y.png"
      imageName="y.png"
      initialPins={[]}
      siblings={[{ id: "m1" }]}
      members={[]}
      currentUserName="Tester"
    />,
  );
}

describe("MockupViewer", () => {
  it("renders existing pins by number", () => {
    render(
      <MockupViewer
        mockupId="m1"
        projectId="proj1"
        imageUrl="http://example.com/a.png"
        imageName="a.png"
        initialPins={[{ id: "p1", x: 0.5, y: 0.5, w: 0, h: 0, number: 3, status: "active", device: "desktop", comments: [] }]}
        siblings={[{ id: "m1" }]}
        members={[]}
        currentUserName="Tester"
      />,
    );
    expect(screen.getByLabelText("Pin 3, active")).toBeInTheDocument();
  });

  it("hides mobile feedback while the desktop view is active", () => {
    render(
      <MockupViewer
        mockupId="m1"
        projectId="proj1"
        imageUrl="http://example.com/a.png"
        imageName="a.png"
        initialPins={[
          { id: "p1", x: 0.2, y: 0.2, w: 0, h: 0, number: 1, status: "active", device: "desktop", comments: [] },
          { id: "p2", x: 0.4, y: 0.4, w: 0, h: 0, number: 1, status: "active", device: "mobile", comments: [] },
        ]}
        siblings={[{ id: "m1" }]}
        members={[]}
        currentUserName="Tester"
      />,
    );
    // Both pins are numbered 1 — they belong to independent per-device
    // sequences — so exactly one marker should be on the desktop canvas.
    expect(screen.getAllByLabelText("Pin 1, active")).toHaveLength(1);
  });

  it("switches to the mobile feedback set when the mobile view is selected", async () => {
    render(
      <MockupViewer
        mockupId="m1"
        projectId="proj1"
        imageUrl="http://example.com/a.png"
        imageName="a.png"
        initialPins={[
          { id: "p1", x: 0.2, y: 0.2, w: 0, h: 0, number: 1, status: "active", device: "desktop", comments: [] },
          { id: "p2", x: 0.4, y: 0.4, w: 0, h: 0, number: 7, status: "active", device: "mobile", comments: [] },
        ]}
        siblings={[{ id: "m1" }]}
        members={[]}
        currentUserName="Tester"
      />,
    );
    expect(screen.getByLabelText("Pin 1, active")).toBeInTheDocument();
    expect(screen.queryByLabelText("Pin 7, active")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /mobile view/i }));

    expect(await screen.findByLabelText("Pin 7, active")).toBeInTheDocument();
    expect(screen.queryByLabelText("Pin 1, active")).not.toBeInTheDocument();
  });

  it("opens a comment popup when the image is clicked without creating a pin", () => {
    renderViewer();
    const img = screen.getByAltText("mockup");
    fireEvent.load(img);
    tap(img);
    expect(screen.getByRole("textbox", { name: /comment/i })).toBeTruthy();
    expect(mockCreatePin).not.toHaveBeenCalled();
  });

  it("creates the pin and its first comment on submit", async () => {
    renderViewer();
    const img = screen.getByAltText("mockup");
    fireEvent.load(img);
    tap(img);
    const textbox = screen.getByRole("textbox", { name: /comment/i });
    fireEvent.input(textbox, { target: { innerHTML: "Hello there" } });
    fireEvent.click(screen.getByRole("button", { name: /^comment$/i }));

    await screen.findByLabelText("Pin 1, active");
    expect(mockCreatePin).toHaveBeenCalledTimes(1);
    expect(mockCreatePin).toHaveBeenCalledWith("m1", 0, 0, "desktop", 0, 0);
    expect(mockAddComment).toHaveBeenCalledTimes(1);
    expect(mockAddComment).toHaveBeenCalledWith("m1", "p1", "Hello there");
    // popup closes after success
    expect(screen.queryByRole("textbox", { name: /comment/i })).toBeNull();
  });

  it("hides a pin's region outline until its pin is selected", () => {
    const { container } = render(
      <MockupViewer
        mockupId="m1"
        projectId="proj1"
        imageUrl="http://example.com/a.png"
        imageName="a.png"
        initialPins={[
          { id: "p1", x: 0.1, y: 0.1, w: 0.4, h: 0.3, number: 1, status: "active", device: "desktop", comments: [] },
        ]}
        siblings={[{ id: "m1" }]}
        members={[]}
        currentUserName="Tester"
      />,
    );
    const dashed = () => container.querySelectorAll(".border-dashed").length;
    // Left on screen permanently, the box reads as a mark on the design itself.
    expect(dashed()).toBe(0);

    fireEvent.click(screen.getByLabelText("Pin 1, active"));
    expect(dashed()).toBe(1);
  });

  it("saves a dragged region as the pin's area", async () => {
    renderViewer();
    const img = screen.getByAltText("mockup");
    fireEvent.load(img);
    // The stubbed rect is 100x100, so 10,20 -> 60,70 is a quarter-ish region.
    dragOut(img, { clientX: 10, clientY: 20 }, { clientX: 60, clientY: 70 });

    const textbox = screen.getByRole("textbox", { name: /comment/i });
    fireEvent.input(textbox, { target: { innerHTML: "This whole block" } });
    fireEvent.click(screen.getByRole("button", { name: /^comment$/i }));

    await screen.findByLabelText("Pin 1, active");
    const [id, x, y, dev, w, h] = mockCreatePin.mock.calls[0];
    expect([id, dev]).toEqual(["m1", "desktop"]);
    expect(x).toBeCloseTo(0.1, 5);
    expect(y).toBeCloseTo(0.2, 5);
    expect(w).toBeCloseTo(0.5, 5);
    expect(h).toBeCloseTo(0.5, 5);
  });

  it("treats a press that barely moves as a point pin, not a region", async () => {
    renderViewer();
    const img = screen.getByAltText("mockup");
    fireEvent.load(img);
    // 2px of jitter is below the 4px threshold.
    dragOut(img, { clientX: 30, clientY: 30 }, { clientX: 31, clientY: 31 });

    const textbox = screen.getByRole("textbox", { name: /comment/i });
    fireEvent.input(textbox, { target: { innerHTML: "Just here" } });
    fireEvent.click(screen.getByRole("button", { name: /^comment$/i }));

    await screen.findByLabelText("Pin 1, active");
    expect(mockCreatePin).toHaveBeenCalledWith("m1", 0.3, 0.3, "desktop", 0, 0);
  });

  it("does not call any action when Cancel is clicked", () => {
    renderViewer();
    const img = screen.getByAltText("mockup");
    fireEvent.load(img);
    tap(img);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(mockCreatePin).not.toHaveBeenCalled();
    expect(mockAddComment).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: /comment/i })).toBeNull();
  });

  it("shows an error and appends no pin when addComment fails", async () => {
    mockAddComment.mockResolvedValue({ error: "nope" });
    renderViewer();
    const img = screen.getByAltText("mockup");
    fireEvent.load(img);
    tap(img);
    const textbox = screen.getByRole("textbox", { name: /comment/i });
    fireEvent.input(textbox, { target: { innerHTML: "Will fail" } });
    fireEvent.click(screen.getByRole("button", { name: /^comment$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("nope");
    expect(screen.queryByLabelText(/Pin 1/)).toBeNull();
    // popup stays open so the user can retry
    expect(screen.getByRole("textbox", { name: /comment/i })).toBeTruthy();
  });

  it("labels a newly created pin comment with the current user's name", async () => {
    render(
      <MockupViewer
        mockupId="m1"
        projectId="proj1"
        imageUrl="http://x/y.png"
        imageName="y.png"
        initialPins={[]}
        siblings={[{ id: "m1" }]}
        members={[]}
        currentUserName="Ravi Rajput"
      />,
    );
    const img = screen.getByAltText("mockup");
    fireEvent.load(img);
    tap(img);
    const textbox = screen.getByRole("textbox", { name: /comment/i });
    fireEvent.input(textbox, { target: { innerHTML: "Fix the header" } });
    fireEvent.click(screen.getByRole("button", { name: /^comment$/i }));
    await waitFor(() => expect(screen.getByText("Ravi Rajput")).toBeTruthy());
  });

  it("renders the server-returned body, never the raw typed HTML", async () => {
    // Server always returns sanitized output regardless of the dirty input.
    mockAddComment.mockResolvedValue({ body: "SAFE-OUTPUT" });
    const { container } = renderViewer();
    const img = screen.getByAltText("mockup");
    fireEvent.load(img);
    tap(img);
    const textbox = screen.getByRole("textbox", { name: /comment/i });
    fireEvent.input(textbox, { target: { innerHTML: '<img src=x onerror="alert(1)">bad' } });
    fireEvent.click(screen.getByRole("button", { name: /^comment$/i }));

    await waitFor(() => expect(screen.getByText("SAFE-OUTPUT")).toBeInTheDocument());
    // The dangerous payload must never reach the DOM (the mockup <img> is
    // legitimate; the injected onerror <img> must not exist).
    expect(container.querySelector("img[onerror]")).toBeNull();
    expect(container.innerHTML).not.toContain("onerror");
    expect(container.innerHTML).not.toContain("<img src=x");
  });
});
