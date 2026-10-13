import { describe, it, expect } from "vitest";
import { tabLabel } from "./SearchableProjects";

describe("tabLabel", () => {
  it("drops the word Workspace, which every tab would otherwise repeat", () => {
    expect(tabLabel("Apexure Success's Workspace")).toBe("Apexure Success");
    expect(tabLabel("Vinay Rajput's Workspace")).toBe("Vinay Rajput");
    expect(tabLabel("Design workspace")).toBe("Design");
  });

  it("leaves a name alone when there's nothing to drop", () => {
    expect(tabLabel("Apexure")).toBe("Apexure");
    expect(tabLabel("Workspace")).toBe("Workspace");
  });
});
