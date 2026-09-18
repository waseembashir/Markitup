import Link from "next/link";
import { Instrument_Serif } from "next/font/google";
import "./auth-scene.css";

// The same display serif as the landing page, so signing in feels like the
// same place.
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
});

// The MarkItUp pin, in the theme's brand colour with an ink outline.
function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 28" className={className} aria-hidden>
      <path
        d="M12 26.2c-.4 0-.8-.2-1-.5C8.4 22.4 3 16.6 3 11.2a9 9 0 0 1 18 0c0 5.4-5.4 11.2-8 14.5-.2.3-.6.5-1 .5Z"
        fill="var(--color-brand)"
        stroke="#1c1c17"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="11" r="3.2" fill="#1c1c17" />
    </svg>
  );
}

const Check = () => (
  <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden>
    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Avatar({ n }: { n: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/avatars/${n}.png`} alt="" width={40} height={40} decoding="async" />;
}

/**
 * One review, start to finish, on loop: a share link is copied, the client
 * pins the headline and drags a box over the photo, the designer replies,
 * and both pins turn green. Pure CSS (auth-scene.css), so this stays a
 * server component; with reduced motion it rests on the finished review.
 */
function ReviewScene() {
  return (
    <div className="as-stage" aria-hidden>
      <div className="as-window">
        <div className="as-chrome">
          <i />
          <i />
          <i />
          <span>Fernleaf · Homepage v1</span>
        </div>
        <div className="as-site">
          <div className="as-site-nav">
            <span className="as-site-logo">fernleaf</span>
            <i />
            <i />
            <b>Shop</b>
          </div>
          <p className="as-site-h">
            Slow mornings, <em>better coffee.</em>
          </p>
          <span className="as-line" />
          <span className="as-line as-line-short" />
          <div className="as-site-img">
            <span className="as-sun" />
            <span className="as-cup" />
          </div>

          <span className="as-box" />
          <span className="as-pin as-pin-1">
            <b>1</b>
            <Check />
          </span>
          <span className="as-pin as-pin-2">
            <b>2</b>
            <Check />
          </span>
          <span className="as-cursor">
            <svg viewBox="0 0 24 24">
              <path d="M4 2.5l15.5 9-6.8 1.6-3.4 6.4z" fill="#1c1c17" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>

      <div className="as-chip as-share">
        <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden>
          <path d="M6.5 9.5l3-3M5.2 7.3 4 8.5a2.5 2.5 0 0 0 3.5 3.5l1.2-1.2M10.8 8.7 12 7.5A2.5 2.5 0 0 0 8.5 4L7.3 5.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        Link copied <span>· no account needed</span>
      </div>

      <div className="as-card as-card-client">
        <p className="as-who">
          <Avatar n={3} /> <b>Priya</b> <span>Client</span>
        </p>
        <p className="as-msg as-msg-1">
          <span className="as-num">1</span> Can the headline be punchier?
        </p>
        <p className="as-msg as-msg-2">
          <span className="as-num">2</span> And a warmer photo here?
        </p>
        <span className="as-done">
          <Check /> Resolved
        </span>
      </div>

      <div className="as-card as-card-team">
        <p className="as-who">
          <Avatar n={12} /> <b>Sam</b> <span>Designer</span>
        </p>
        <p className="as-msg">Both done in v2.</p>
      </div>

      <div className="as-chip as-progress">
        <span className="as-progress-label">
          <span className="as-open">2 open</span>
          <span className="as-all">
            <Check /> All resolved
          </span>
        </span>
        <i>
          <b />
        </i>
      </div>
    </div>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen">
      {/* brand panel */}
      <section
        className={`as-panel relative hidden w-[58%] flex-col justify-between overflow-hidden p-12 text-white lg:flex ${serif.variable}`}
        style={{ background: "hsl(60 5% 11%)" }}
      >
        <div className="flex items-center gap-2.5">
          <Mark className="h-8 w-7" />
          <span className="text-lg font-bold tracking-tight">MarkItUp</span>
        </div>

        <div className="relative">
          <ReviewScene />

          <h2 className="as-title">
            Feedback that lands <em>exactly where it matters.</em>
          </h2>
          <p className="mt-4 max-w-md text-base text-white/75">
            Upload a file, share a link, and let clients pin comments right on
            the design. No more guessing which button they meant.
          </p>
        </div>

        <p className="text-sm text-white/60">Apexure · Visual review, done right.</p>
      </section>

      {/* form */}
      <section className="flex w-full flex-col justify-center px-6 py-12 lg:w-[42%]">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Mark className="h-8 w-7" />
            <span className="text-lg font-bold tracking-tight text-ink">MarkItUp</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>

          <div className="mt-7">{children}</div>

          <p className="mt-6 text-sm text-muted">{footer}</p>
        </div>
      </section>
    </main>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-brand-ink transition-colors hover:text-brand-hover">
      {children}
    </Link>
  );
}
