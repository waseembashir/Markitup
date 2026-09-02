import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const removeTeamMember = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true }));
vi.mock("@/app/app/team-actions", () => ({ removeTeamMember }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import { TeamRoster } from "./TeamRoster";
import type { TeamData } from "@/app/app/team-actions";

const owner = { id: "u-owner", name: "Vinay", email: "vinay@x.com", role: "owner" as const, isYou: true, pending: false };
const admin = { id: "u-admin", name: "Sajad", email: "sajad@x.com", role: "admin" as const, isYou: false, pending: false };
const manager = { id: "u-mgr", name: "Ajit Kumar", email: "ajit@x.com", role: "member" as const, isYou: false, pending: false };
const invited = { id: "new@x.com", name: "new@x.com", email: "new@x.com", role: "member" as const, isYou: false, pending: true };

function data(over: Partial<TeamData> = {}): TeamData {
  return { admins: [owner, admin], managers: [manager, invited], guests: [], canManage: true, ...over };
}

describe("TeamRoster removal", () => {
  beforeEach(() => removeTeamMember.mockClear());

  it("offers no remove button to someone who can't manage the team", () => {
    render(<TeamRoster data={data({ canManage: false })} />);
    fireEvent.click(screen.getByRole("button", { name: /^Manager/ }));
    expect(screen.queryByRole("button", { name: /remove ajit/i })).toBeNull();
  });

  it("never offers to remove the owner or yourself", () => {
    render(<TeamRoster data={data()} />);
    // Admin tab is default and holds the owner (who is also "you").
    expect(screen.queryByRole("button", { name: /remove vinay/i })).toBeNull();
    expect(screen.getByRole("button", { name: /remove sajad/i })).toBeTruthy();
  });

  it("removes a manager after confirmation", async () => {
    render(<TeamRoster data={data()} />);
    fireEvent.click(screen.getByRole("button", { name: /^Manager/ }));
    fireEvent.click(screen.getByRole("button", { name: /remove ajit kumar/i }));

    expect(screen.getByText(/loses access to every project/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^remove$/i }));
    await waitFor(() => expect(removeTeamMember).toHaveBeenCalledWith("u-mgr"));
  });

  it("revokes a pending invitation by email, not by id", async () => {
    render(<TeamRoster data={data()} />);
    fireEvent.click(screen.getByRole("button", { name: /^Manager/ }));
    fireEvent.click(screen.getByRole("button", { name: /revoke invitation for new@x.com/i }));
    fireEvent.click(screen.getByRole("button", { name: /^revoke invitation$/i }));
    await waitFor(() => expect(removeTeamMember).toHaveBeenCalledWith("new@x.com"));
  });

  it("does nothing when the confirmation is cancelled", () => {
    render(<TeamRoster data={data()} />);
    fireEvent.click(screen.getByRole("button", { name: /^Manager/ }));
    fireEvent.click(screen.getByRole("button", { name: /remove ajit kumar/i }));
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(removeTeamMember).not.toHaveBeenCalled();
  });
});
