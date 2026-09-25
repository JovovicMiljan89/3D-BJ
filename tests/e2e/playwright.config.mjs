import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
export const VARIANT_PORTS = { teget: 4174, limeta: 4175, plava: 4176 };

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
    // Theme variants of the same content (see build-variant.mjs, theme.spec.mjs).
    ...Object.entries(VARIANT_PORTS).map(([name, port]) => ({
      command: `node build-variant.mjs ${name} && BUILD_DIST_DIR=../../dist-variants/${name} PORT=${port} node ../../scripts/serve.mjs`,
      url: `http://localhost:${port}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    })),
  ],
});
