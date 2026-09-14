// Server and edge error reporting. Next calls register() once per server
// instance, before any request is handled, and onRequestError for every error
// it catches while rendering, running a Server Action, or serving a route.
//
// Without NEXT_PUBLIC_SENTRY_DSN this file does nothing at all, so local
// development and preview deploys need no configuration.
import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";
import { MONITORING_ENABLED, SENTRY_INIT } from "@/lib/observability";

export async function register() {
  if (!MONITORING_ENABLED) return;
  // Both runtimes need their own init; the edge one runs in a separate isolate.
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(SENTRY_INIT);
  }
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!MONITORING_ENABLED) return;
  await Sentry.captureRequestError(...args);
};
