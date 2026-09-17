import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["**/node_modules/**", "**/e2e/**"],
    // The 5s default failed a different test or two each run whenever the
    // machine was busy — a dev server, a build — and passed clean otherwise.
    // Nothing here is slow by design; the jsdom environment alone takes most of
    // a minute to set up across the suite, and the first test in a file pays for
    // it. A real hang still fails, just not a scheduling hiccup.
    testTimeout: 20_000,
    hookTimeout: 20_000,
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
