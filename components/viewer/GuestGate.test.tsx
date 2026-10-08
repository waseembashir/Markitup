import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabase: vi.fn() }));

import { GuestGate } from "./GuestGate";

describe("GuestGate", () => {
  it("lets a teammate sign in instead of becoming a guest, and come back to the link", () => {
    // A teammate who comments as a guest is indistinguishable from a client,
    // so their comments go to the team's Slack channel.
    render(<GuestGate token="abc123" fileName="Home.png" />);
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link.getAttribute("href")).toBe("/login?next=%2Fs%2Fabc123");
  });
});
