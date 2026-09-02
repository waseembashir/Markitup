import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { CardMenu, MenuItem } from "./CardMenu";

// A card that creates a stacking context the same way `.card-hover:hover` and
// ProjectCard's `group-hover:-translate-y-0.5` do in the real app. Anything
// rendered *inside* it is trapped there no matter how high its z-index, so the
// menu must escape to document.body instead.
function TransformedCard({ children }: { children: React.ReactNode }) {
  return (
    <div data-testid="card" style={{ transform: "translateY(-2px)" }}>
      {children}
    </div>
  );
}

describe("CardMenu", () => {
  it("renders the open panel outside the transformed card", () => {
    render(
      <TransformedCard>
        <CardMenu label="File options">
          {(close) => <MenuItem onClick={close}>Rename</MenuItem>}
        </CardMenu>
      </TransformedCard>,
    );

    fireEvent.click(screen.getByRole("button", { name: /file options/i }));

    const item = screen.getByText("Rename");
    const card = screen.getByTestId("card");
    expect(card.contains(item)).toBe(false);
  });

  it("positions the panel with fixed coordinates so no ancestor can clip it", () => {
    render(
      <CardMenu label="File options">
        {(close) => <MenuItem onClick={close}>Rename</MenuItem>}
      </CardMenu>,
    );
    fireEvent.click(screen.getByRole("button", { name: /file options/i }));

    const panel = screen.getByRole("menu");
    expect(panel.style.position).toBe("fixed");
  });

  it("keeps the menu open when clicking inside the portalled panel", () => {
    const onClose = vi.fn();
    render(
      <CardMenu label="File options" onClose={onClose}>
        {() => <MenuItem onClick={() => {}}>Rename</MenuItem>}
      </CardMenu>,
    );
    fireEvent.click(screen.getByRole("button", { name: /file options/i }));

    fireEvent.pointerDown(screen.getByRole("menu"));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Rename")).toBeTruthy();
  });

  it("closes when pointing down outside the card and the panel", () => {
    render(
      <CardMenu label="File options">
        {() => <MenuItem onClick={() => {}}>Rename</MenuItem>}
      </CardMenu>,
    );
    fireEvent.click(screen.getByRole("button", { name: /file options/i }));
    expect(screen.getByText("Rename")).toBeTruthy();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByText("Rename")).toBeNull();
  });
});
