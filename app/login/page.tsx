import { signInAction } from "@/app/auth/actions";
import { AuthShell, AuthLink } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";
import { GoogleButton } from "@/components/auth/GoogleButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  // Set by /auth/callback when a Google sign-in doesn't complete.
  const notice =
    error === "cancelled"
      ? "Google sign-in was cancelled. Try again, or use your email and password."
      : error
        ? "Google sign-in didn't complete. Try again, or use your email and password."
        : null;
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to review designs and pick up the feedback."
      footer={<>New to MarkUp? <AuthLink href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}>Create an account</AuthLink></>}
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
