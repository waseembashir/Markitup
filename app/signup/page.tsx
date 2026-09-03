import { signUpAction } from "@/app/auth/actions";
import { AuthShell, AuthLink } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up a workspace and start collecting feedback in minutes."
      footer={<>Already have an account? <AuthLink href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Log in</AuthLink></>}
    >
      <AuthForm action={signUpAction} next={next} submitLabel="Create account">
        <div>
          <label htmlFor="name" className="field-label">Full name</label>
          <input id="name" name="name" type="text" autoComplete="name" placeholder="Jane Designer" required className="field" />
        </div>
        <div>
          <label htmlFor="email" className="field-label">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@agency.com" required className="field" />
        </div>
        <div>
          <label htmlFor="password" className="field-label">Password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" placeholder="At least 6 characters" required minLength={6} className="field" />
        </div>
      </AuthForm>
    </AuthShell>
  );
}
