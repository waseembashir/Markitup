// Browser error reporting. Runs before the app becomes interactive.
//
// This is the half that catches what server logs never see: a component that
// throws only on a client's browser, an upload that fails on their network, a
// viewer interaction that breaks on a screen size nobody tested. Those are
// exactly the failures a client reports as "it didn't work" with no detail.
import * as Sentry from "@sentry/nextjs";
import { MONITORING_ENABLED, SENTRY_INIT } from "@/lib/observability";

if (MONITORING_ENABLED) {
  Sentry.init({
    ...SENTRY_INIT,
    // Session replay and tracing are the two things that exhaust a free-tier
    // quota fastest. Errors are what we actually need.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
