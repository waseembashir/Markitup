import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    exclude: ["**/node_modules/**", "**/e2e/**"],
    // The default 5s timeout is kept on purpose. Email tests intermittently
    // timed out, and the timeout was briefly raised to 20s on the theory that a
    // busy machine was to blame. It was not: lib/observability.ts statically
    // imported the whole Sentry SDK, and the first test to touch email paid for
    // loading it. A generous timeout would have hidden that indefinitely. A slow
    // test is information; let it fail.
  },
  resolve: {
    alias: {
      "@": __dirname,
      // Next.js server-guard packages have no browser build; stub them in tests.
      "server-only": __dirname + "/test/empty.ts",
      "client-only": __dirname + "/test/empty.ts",
    },
  },
});
