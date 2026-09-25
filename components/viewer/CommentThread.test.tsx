import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CommentThread } from "./CommentThread";
import type { ViewerPin } from "./MockupViewer";

vi.mock("@/app/app/mockups/[mockupId]/actions", () => ({
  // Echo the submitted body as the server-sanitized body the client renders.
  addComment: async (_m: string, _p: string, body: string) => ({ body }),
  setPinStatus: async () => ({}),
}));

// RichCommentInput's onSubmit fires an optimistic update via onChange, just
// like the real MockupViewer parent does; mirror that here so the thread
// actually re-renders with the new comment.
function Harness({ onChangeSpy }: { onChangeSpy: (p: ViewerPin) => void }) {
  const [pin, setPin] = useState<ViewerPin>({ id: "p1", mockupId: "m1", version: 1, isCurrentVersion: true, createdBy: null, x: 0.5, y: 0.5, w: 0, h: 0, number: 1, status: "active", device: "desktop", comments: [] });
  return (
    <CommentThread
      mockupId="m1"
      projectId="proj1"
      pin={pin}
      members={[]}
      currentUserName="Tester"
      onChange={(p) => {
        onChangeSpy(p);
        setPin(p);
      }}
    />
  );
}

describe("CommentThread", () => {
  it("adds a top-level comment to the thread on submit", async () => {
    const onChange = vi.fn();
    render(<Harness onChangeSpy={onChange} />);
    fireEvent.input(screen.getByRole("textbox", { name: /comment/i }), {
      target: { innerHTML: "Looks off here" },
    });
    fireEvent.click(screen.getByText("Comment"));
    await waitFor(() => expect(screen.getByText("Looks off here")).toBeInTheDocument());
    expect(onChange).toHaveBeenCalled();
  });
});

// Resolving is the end of the conversation. Leaving the popup open afterwards
// left a reply box for a closed thread sitting over the design.
describe("resolving a thread", () => {
  function renderPin(status: "active" | "resolved", onClose: () => void) {
    const pin: ViewerPin = { id: "p1", mockupId: "m1", version: 1, isCurrentVersion: true, createdBy: null, x: 0.5, y: 0.5, w: 0, h: 0, number: 1, status, device: "desktop", comments: [] };
    render(
      <CommentThread
        mockupId="m1"
        projectId="proj1"
        pin={pin}
        members={[]}
        currentUserName="Tester"
        onChange={() => {}}
        onClose={onClose}
      />,
    );
  }

  it("closes the popup once the thread is marked resolved", async () => {
    const onClose = vi.fn();
    renderPin("active", onClose);
    fireEvent.click(screen.getByRole("button", { name: "Mark resolved" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("stays open when a resolved thread is reopened", async () => {
    const onClose = vi.fn();
    renderPin("resolved", onClose);
    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
    await new Promise((r) => setTimeout(r, 20));
    expect(onClose).not.toHaveBeenCalled();
  });
});
