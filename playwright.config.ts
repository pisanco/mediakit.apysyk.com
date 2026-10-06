// E2E against the built site (run `bun run build` first): Chromium and WebKit,
// on a desktop and on a 390 x 844 phone. E2E_PORT keeps parallel runs apart.

import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 4481);

const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: { baseURL: `http://127.0.0.1:${port}` },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "chromium-phone", use: { ...devices["Desktop Chrome"], ...phone } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } } },
    { name: "webkit-phone", use: { ...devices["Desktop Safari"], ...phone } },
  ],
  webServer: {
    command: "bun scripts/serve.ts",
    env: { PORT: String(port) },
    port,
    reuseExistingServer: false,
  },
});
