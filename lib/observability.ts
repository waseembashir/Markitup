// Everything here is a no-op until NEXT_PUBLIC_SENTRY_DSN is set. That is
// deliberate: nobody should have to configure error reporting to run the app
// locally or to deploy a preview, and an unconfigured SDK must never be the
// reason a request fails.
//
// The SDK is imported lazily, only once there is a DSN to send to. It used to be
// a static import, which loaded all of @sentry/nextjs into every module that can
// report anything — sending an email, the guest gate, live updates — whether or
// not reporting was switched on. In the test suite that cost about a second on
// an idle machine and over twenty under a full parallel run, charged to
// whichever test first touched email, which read for weeks like a flaky suite.
export const MONITORING_ENABLED = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

export const SENTRY_INIT = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Errors only. Performance tracing samples every request and burns through a
  // free-tier quota in days, which would mean losing the errors that matter.
  tracesSampleRate: 0,
  // Vercel sets this; it makes "broke in production, fine in preview" legible.
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  // Ignore what the user can neither cause nor fix: a closed tab mid-request,
  // a browser extension, a flaky network.
  ignoreErrors: ["AbortError", "NetworkError", "Failed to fetch", "Load failed", "ResizeObserver loop"],
};

// Loaded once, on first use, and only when there is somewhere to send reports.
let sdk: Promise<typeof import("@sentry/nextjs")> | null = null;
function withSentry(fn: (s: typeof import("@sentry/nextjs")) => void) {
  if (!MONITORING_ENABLED) return;
  sdk ??= import("@sentry/nextjs");
  // Reporting must never be the thing that throws.
  sdk.then(fn).catch(() => {});
}

/**
 * Report something that went wrong but was handled — the case this codebase
 * gets wrong most often.
 *
 * Several paths are deliberately best-effort: sending email, posting to Slack,
 * attaching a file. They must not fail the Server Action that triggered them,
 * so they catch, log, and carry on. That is the right behaviour and it is also
 * how a thirteen-day email outage went unnoticed — `console.error` in a
 * serverless function reaches nobody unless somebody is already reading logs.
 *
 * Use this at exactly those points: the operation stays best-effort, but the
 * failure stops being invisible.
 */
export function reportIssue(message: string, context?: Record<string, unknown>) {
  console.error(`[issue] ${message}`, context ?? "");
  withSentry((s) => s.captureMessage(message, { level: "error", extra: context }));
}

/** Report a caught exception from a best-effort path, keeping the stack. */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  console.error("[error]", error, context ?? "");
  withSentry((s) => s.captureException(error, { extra: context }));
}
