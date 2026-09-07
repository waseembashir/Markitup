import { describe, it, expect } from "vitest";

// The rule the share page enforces, isolated so it can be asserted directly:
// the LINK decides whether an account is required, never the visitor.
type Visitor = { signedIn: boolean; isGuest: boolean };
type Door = "guest-gate" | "login" | "open-file";

function doorFor(visibility: "public" | "restricted", v: Visitor): Door {
  const isPublic = visibility === "public";
  if (!isPublic && (!v.signedIn || v.isGuest)) return "login";
  if (!v.signedIn) return "guest-gate";
  return "open-file";
}

const anon: Visitor = { signedIn: false, isGuest: false };
const guest: Visitor = { signedIn: true, isGuest: true };
const member: Visitor = { signedIn: true, isGuest: false };

describe("who has to sign in for a shared link", () => {
  it("never asks for an account on a public link", () => {
    expect(doorFor("public", anon)).toBe("guest-gate");
  });

  it("lets an existing guest straight into another public link", () => {
    expect(doorFor("public", guest)).toBe("open-file");
  });

  it("opens a public link immediately for a signed-in member", () => {
    expect(doorFor("public", member)).toBe("open-file");
  });

  it("requires an account on a restricted link", () => {
    expect(doorFor("restricted", anon)).toBe("login");
  });

  it("sends a guest to sign in for a restricted link, not to a dead end", () => {
    // A guest can't be granted access and can't even ask for it, so the locked
    // screen would leave them stuck. They need a real account.
    expect(doorFor("restricted", guest)).toBe("login");
  });

  it("lets a signed-in member through a restricted link to be access-checked", () => {
    expect(doorFor("restricted", member)).toBe("open-file");
  });

  it("never sends anyone to a login form from a public link", () => {
    for (const v of [anon, guest, member]) {
      expect(doorFor("public", v)).not.toBe("login");
    }
  });
});
