import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'NEXT_PUBLIC_VLM_API_URL=http://localhost:8000 npm run dev',
      url: 'http://localhost:3000',
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'MODEL_ID=mock uvicorn services.vlm.main:app --host 0.0.0.0 --port 8000',
      url: 'http://localhost:8000/api/vlm/health',
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
