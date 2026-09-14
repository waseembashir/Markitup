import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Mockup bytes no longer flow through a Server Action — the browser uploads
  // them straight to Supabase Storage via a signed URL (see UploadDropzone and
  // createMockupUploadUrl). That sidesteps Vercel's 4.5MB function body cap,
  // which no `bodySizeLimit` can lift, so large mockups upload from anywhere.
  // Actions now carry only small JSON payloads, so the default 1MB cap is fine.
};

// Only wrap the config when error reporting is actually configured. Applying
// the plugin unconditionally would add a build step, bundle the SDK and print
// source-map warnings for everyone who just wants to run the app.
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      silent: true,
      telemetry: false,
      // Source maps are uploaded only if SENTRY_AUTH_TOKEN is present. Without
      // it the build still succeeds; stack traces are just minified.
      widenClientFileUpload: true,
      disableLogger: true,
    })
  : nextConfig;
