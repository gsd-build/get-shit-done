import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env['CI'];
const baseURL = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000';
const authToken = process.env['E2E_AUTH_TOKEN'] ?? 'manual-test-token';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  ...(isCI && { workers: 1 }),
  reporter: 'html',
  timeout: 30000,

  use: {
    baseURL,
    trace: 'on-first-retry',
    storageState: {
      cookies: [
        {
          name: 'gsd-auth',
          value: authToken,
          domain: 'localhost',
          path: '/',
          expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    },
  },

  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: {
    command: 'pnpm run dev',
    url: baseURL,
    reuseExistingServer: !isCI,
  },
});
