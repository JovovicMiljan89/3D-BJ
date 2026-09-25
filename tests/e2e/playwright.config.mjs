import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
export const TEGET_PORT = 4174;

export default defineConfig({
  testDir: "./specs",
  timeout: 30_000,
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Builds the real site (content/site.json -> dist/) and serves it, exactly
      // like a Cloudflare Pages preview would — then runs the smoke tests against it.
      command: `node ../../scripts/build.mjs && PORT=${PORT} node ../../scripts/serve.mjs`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // Same content forced to the "teget" theme, into its own folder, to prove
      // the theme switch still works (see theme.spec.mjs).
      command: `BUILD_THEME=teget BUILD_DIST_DIR=../../dist-teget node ../../scripts/build.mjs && BUILD_DIST_DIR=../../dist-teget PORT=${TEGET_PORT} node ../../scripts/serve.mjs`,
      url: `http://localhost:${TEGET_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
