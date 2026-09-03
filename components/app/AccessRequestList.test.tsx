import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const grantAccessRequest = vi.hoisted(() => vi.fn());
vi.mock("@/app/app/notifications-actions", () => ({ grantAccessRequest }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => toast }));

import { AccessRequestList } from "./AccessRequestList";
import type { NotificationItem } from "@/app/app/notifications-actions";

function req(over: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "n1",
    type: "access_request",
    body: "Ravi Rajput is asking for access to hero.png",
    mockupId: "mk1",
    projectId: "pr1",
    actorId: "u-ravi",
    granted: false,
    readAt: null,
    createdAt: new Date().toISOString(),
    actorName: "Ravi Rajput",
    actorEmail: "ravi@x.com",
    ...over,
  };
}

describe("AccessRequestList", () => {
  beforeEach(() => {
    grantAccessRequest.mockReset();
    grantAccessRequest.mockResolvedValue({ ok: true });
    toast.success.mockReset();
    toast.error.mockReset();
  });

  it("grants access for the request that was clicked", async () => {
    render(<AccessRequestList requests={[req(), req({ id: "n2", actorName: "Ajit" })]} />);
    fireEvent.click(screen.getAllByRole("button", { name: /allow access/i })[1]);
    await waitFor(() => expect(grantAccessRequest).toHaveBeenCalledWith("n2"));
    expect(grantAccessRequest).toHaveBeenCalledTimes(1);
  });

  it("shows the granted state instead of the button afterwards", async () => {
    render(<AccessRequestList requests={[req()]} />);
    fireEvent.click(screen.getByRole("button", { name: /allow access/i }));
    await screen.findByText(/access granted/i);
    expect(screen.queryByRole("button", { name: /allow access/i })).toBeNull();
  });

  it("renders an already-granted request as handled", () => {
    render(<AccessRequestList requests={[req({ granted: true })]} />);
    expect(screen.getByText(/access granted/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /allow access/i })).toBeNull();
  });

  it("keeps the button available when the grant is refused", async () => {
    grantAccessRequest.mockResolvedValue({ error: "You don't have permission to grant access to this project." });
    render(<AccessRequestList requests={[req()]} />);
    fireEvent.click(screen.getByRole("button", { name: /allow access/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /allow access/i })).toBeTruthy();
    expect(screen.queryByText(/access granted/i)).toBeNull();
  });
});
