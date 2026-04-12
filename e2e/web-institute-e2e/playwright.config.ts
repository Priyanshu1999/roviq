import path from 'node:path';
import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.WEB_URL || 'http://localhost:4201';
const instituteAuthFile = path.join(__dirname, 'playwright/.auth/institute.json');

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  globalSetup: require.resolve('../shared/preflight.ts'),
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'login',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /login\.e2e\.spec\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: instituteAuthFile,
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
      NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER: '',
    },
  },
});
