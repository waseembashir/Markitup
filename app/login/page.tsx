import { signInAction } from "@/app/auth/actions";
import { AuthShell, AuthLink } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";
import { GoogleButton } from "@/components/auth/GoogleButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; guest?: string }>;
}) {
  const { next, error, guest } = await searchParams;
  // Set by /auth/callback when a Google sign-in doesn't complete.
  const notice =
    error === "cancelled"
      ? "Google sign-in was cancelled. Try again, or use your email and password."
      : error
        ? "Google sign-in didn't complete. Try again, or use your email and password."
        : null;
  return (
    <AuthShell
      // Not "Welcome back": plenty of people meet this page for the first
      // time, whether from the nav or from a link someone shared with them.
      title="Log in to MarkItUp"
      subtitle={
        next
          ? "Log in to open the file that was shared with you."
          : "Review designs and collect client feedback in one place."
      }
      footer={<>New to MarkItUp? <AuthLink href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}>Create an account</AuthLink></>}
    >
      {notice && (
        <p
          className="mb-4 rounded-lg border px-3 py-2 text-sm font-medium"
          style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}
          role="alert"
        >
          {notice}
        </p>
      )}
      {guest && !notice && (
        // Sent here by the proxy: this browser still holds a guest session from
        // a shared link, which can open that file but not a workspace.
        <p className="mb-4 rounded-lg border bg-brand-soft px-3 py-2 text-sm text-ink" role="status">
          You were reviewing a shared file as a guest. Log in with your own account to see your projects.
        </p>
      )}
      <GoogleButton next={next} label="Continue with Google" />
      <AuthForm action={signInAction} next={next} submitLabel="Log in">
        <div>
          <label htmlFor="email" className="field-label">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@agency.com" required className="field" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="field-label">Password</label>
            <AuthLink href="/forgot-password">Forgot password?</AuthLink>
          </div>
          <input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required className="field" />
        </div>
      </AuthForm>
    </AuthShell>
  );
}
