import { describe, it, expect } from "vitest";
import { searchTerms, matchesSearch } from "./search";

describe("searching a list of projects", () => {
  const summa = { name: "Summa Planning Group", files: ["Homepage | Summa", "About Us | Summa"] };

  it("matches on the project's own name", () => {
    expect(matchesSearch(searchTerms("summa"), summa.name, summa.files)).toBe(true);
  });

  it("finds a project by a file inside it", () => {
    // The thing people are actually looking for is often the file.
    expect(matchesSearch(searchTerms("about us"), summa.name, summa.files)).toBe(true);
  });

  it("takes the words in any order, across both", () => {
    expect(matchesSearch(searchTerms("about summa"), summa.name, summa.files)).toBe(true);
    expect(matchesSearch(searchTerms("summa about"), summa.name, summa.files)).toBe(true);
  });

  it("needs every word, not just one", () => {
    expect(matchesSearch(searchTerms("summa careers"), summa.name, summa.files)).toBe(false);
  });

  it("ignores case and stray spacing", () => {
    expect(matchesSearch(searchTerms("  SUMMA   homepage "), summa.name, summa.files)).toBe(true);
  });

  it("matches everything when nothing has been typed", () => {
    expect(matchesSearch(searchTerms("   "), summa.name, summa.files)).toBe(true);
  });

  it("copes with a project that has no files yet", () => {
    expect(matchesSearch(searchTerms("railey"), "Railey Molinario", [])).toBe(true);
    expect(matchesSearch(searchTerms("railey"), "Railey Molinario", undefined)).toBe(true);
  });
});
