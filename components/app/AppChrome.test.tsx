import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const pathnameMock = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => pathnameMock() }));
vi.mock("./AppSidebar", () => ({
  AppSidebar: () => <nav data-testid="sidebar" />,
}));

import { AppChrome } from "./AppChrome";

describe("AppChrome", () => {
  it("shows the sidebar on normal app routes", () => {
    pathnameMock.mockReturnValue("/app");
    render(<AppChrome workspaceName="W"><div /></AppChrome>);
    expect(screen.queryByTestId("sidebar")).not.toBeNull();
  });

  it("hides the sidebar on the mockup viewer route", () => {
    pathnameMock.mockReturnValue("/app/mockups/abc");
    render(<AppChrome workspaceName="W"><div /></AppChrome>);
    expect(screen.queryByTestId("sidebar")).toBeNull();
  });

  it("hides the sidebar on the compare screen", () => {
    pathnameMock.mockReturnValue("/app/projects/p1/compare");
    render(<AppChrome workspaceName="W"><div /></AppChrome>);
    expect(screen.queryByTestId("sidebar")).toBeNull();
  });

  it("offers nothing floating over the design to bring the nav back", () => {
    // The old reveal toggle sat on top of the artwork and read as part of it.
    pathnameMock.mockReturnValue("/app/mockups/abc");
    const { container } = render(<AppChrome workspaceName="W"><div /></AppChrome>);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("gives a guest no app navigation, even off the viewer", () => {
    pathnameMock.mockReturnValue("/app");
    render(<AppChrome workspaceName="W" isGuest><div /></AppChrome>);
    expect(screen.queryByTestId("sidebar")).toBeNull();
  });
});
