import path from 'node:path';
import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.WEB_URL || 'http://localhost:4200';
const apiURL = process.env.API_URL || 'http://localhost:3000/api/graphql';
const instituteAuthFile = path.join(__dirname, 'playwright/.auth/institute.json');

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
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
  webServer: [
    {
      command: 'pnpm run dev:gateway',
      url: apiURL,
      name: 'API Gateway',
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: 60_000,
    },
    {
      command: 'pnpm run dev:web',
      url: baseURL,
      name: 'Web',
      reuseExistingServer: !process.env.CI,
      cwd: workspaceRoot,
      timeout: 120_000,
    },
  ],
});
