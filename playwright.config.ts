import { defineConfig, devices } from '@playwright/test';

const PORT = 4300;

/** End-to-end tests in the browser (jeep-sqlite), see e2e/. Run with `pnpm e2e`. */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'de-CH',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-phone',
      use: { ...devices['Desktop Chrome'], viewport: { width: 393, height: 852 } },
    },
  ],
  webServer: {
    command: `pnpm exec ng serve --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
