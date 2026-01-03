import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: [/\\.pw\\.ts$/],
  timeout: 30_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- -p 3000",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

