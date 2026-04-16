import path from 'node:path';
import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.WEB_URL || 'http://admin.localhost:4201';
const adminAuthFile = path.join(__dirname, '../playwright/.auth/admin.json');

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  globalSetup: require.resolve('../shared/preflight.ts'),
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
    },
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    // Auth setup — runs once, saves storageState for authenticated tests
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    // Login page tests — no auth needed (tests the login flow itself)
    {
      name: 'login',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /login\.e2e\.spec\.ts/,
    },

    // Authenticated tests — reuse admin login state
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: adminAuthFile,
      },
      testIgnore: /login\.e2e\.spec\.ts/,
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'pnpm run dev:web:e2e',
    url: baseURL,
    name: 'Web',
    reuseExistingServer: !process.env.CI,
    cwd: workspaceRoot,
    timeout: 30_000,
    env: {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3004',
      // Disable Novu Inbox in E2E — Novu API is not exposed to the host
      NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER: '',
    },
  },
});
