import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:3011",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "python3 tests/start-backend.py",
      url: "http://127.0.0.1:8011/health",
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: "npm run dev -- --port 3011",
      url: "http://127.0.0.1:3011",
      reuseExistingServer: false,
      timeout: 90000,
      env: {
        GENOMEDESK_API_URL: "http://127.0.0.1:8011",
        GENOMEDESK_BACKEND_KEY: "e2e-local-only-key",
      },
    },
  ],
});
