import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { CompareView } from "./CompareView";

const mockups = [
  { id: "v1", name: "Home.png", url: "https://x/v1.png", version: 1 },
  { id: "v2", name: "Home.png", url: "https://x/v2.png", version: 2 },
];

function renderCompare(backHref?: string) {
  render(
    <CompareView mockups={mockups} initialLeft="v1" initialRight="v2" projectId="p1" projectName="Acme" backHref={backHref} />,
  );
}

describe("CompareView back arrow", () => {
  it("returns the team to the project", () => {
    renderCompare();
    expect(screen.getByLabelText("Back to project").getAttribute("href")).toBe("/app/projects/p1");
  });

  it("returns a guest to the file, never the project page they can't use", () => {
    renderCompare("/app/mockups/v2");
    expect(screen.queryByLabelText("Back to project")).toBeNull();
    expect(screen.getByLabelText("Back to file").getAttribute("href")).toBe("/app/mockups/v2");
  });
});
