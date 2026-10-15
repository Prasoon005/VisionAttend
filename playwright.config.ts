import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

/**
 * E2E runs against a production build (same as Vercel), on desktop Chrome
 * plus the two phones CLAUDE.md requires: Pixel 7 (Chromium) and iPhone 14 (WebKit).
 * In CI the build step has already run, so only `next start` is needed.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-pixel-7', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-iphone-14', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: process.env.CI
      ? `npm run start -- --port ${PORT}`
      : `npm run build && npm run start -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
