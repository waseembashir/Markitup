import { describe, it, expect, vi } from "vitest";

const resetMock = vi.fn().mockResolvedValue({ error: null });
let hdrs = new Headers({ host: "review.apexure.com", "x-forwarded-proto": "https" });
vi.mock("next/headers", () => ({ headers: async () => hdrs }));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { resetPasswordForEmail: resetMock },
  }),
}));

describe("requestPasswordReset", () => {
  it("returns a neutral sent state and calls Supabase with a redirect", async () => {
    const { requestPasswordReset } = await import("./actions");
    const fd = new FormData();
    fd.set("email", "ravi@x.com");
    const res = await requestPasswordReset({}, fd);
    expect(res.sent).toBe(true);
    expect(resetMock).toHaveBeenCalledWith(
      "ravi@x.com",
      expect.objectContaining({ redirectTo: expect.stringContaining("/auth/callback") }),
    );
    const redirectTo = resetMock.mock.calls[0][1].redirectTo;
    expect(redirectTo).toContain("reset-password");
  });

  it("sends the link back to the address the reset was asked from, not a configured one", async () => {
    // NEXT_PUBLIC_APP_URL still named the old domain, which Supabase's allow
    // list refuses — so the link fell back to the home page.
    resetMock.mockClear();
    hdrs = new Headers({ "x-forwarded-host": "review.apexure.com", "x-forwarded-proto": "https" });
    const { requestPasswordReset } = await import("./actions");
    const fd = new FormData();
    fd.set("email", "ravi@x.com");
    await requestPasswordReset({}, fd);
    expect(resetMock.mock.calls[0][1].redirectTo).toBe("https://review.apexure.com/auth/callback?next=/reset-password");
  });
});
