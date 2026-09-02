import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const requestAccess = vi.hoisted(() => vi.fn());
vi.mock("@/app/app/access-actions", () => ({ requestAccess }));
vi.mock("@/app/auth/actions", () => ({ signOut: vi.fn() }));

import { LockedFile } from "./LockedFile";

const props = {
  mockupId: "m1",
  fileName: "A2 Dental Sedation.html",
  projectName: "A2 Dental",
  userEmail: "client@example.com",
};

describe("LockedFile", () => {
  beforeEach(() => requestAccess.mockReset());

  it("names the file and the account you are signed in as", () => {
    render(<LockedFile {...props} />);
    expect(screen.getByText(/don't have access/i)).toBeTruthy();
    expect(screen.getByText("A2 Dental Sedation.html")).toBeTruthy();
    expect(screen.getByText("client@example.com")).toBeTruthy();
  });

  it("confirms once the request is sent", async () => {
    requestAccess.mockResolvedValue({ ok: true });
    render(<LockedFile {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /request access/i }));
    await waitFor(() => expect(requestAccess).toHaveBeenCalledWith("m1"));
    await screen.findByText(/request sent/i);
  });

  it("surfaces the reason a request was refused", async () => {
    requestAccess.mockResolvedValue({ ok: false, error: "That file no longer exists." });
    render(<LockedFile {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /request access/i }));
    await screen.findByText("That file no longer exists.");
    expect(screen.queryByText(/request sent/i)).toBeNull();
  });
});
