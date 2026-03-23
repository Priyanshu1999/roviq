import path from 'node:path';
import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.WEB_URL || 'http://reseller.localhost:4200';
const apiURL = process.env.API_URL || 'http://localhost:3000/api/graphql';
const resellerAuthFile = path.join(__dirname, 'playwright/.auth/reseller.json');

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: resellerAuthFile,
      },
      testIgnore: /.*\.setup\.ts/,
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      command: 'pnpm run dev:gateway',
      url: apiURL,
      name: 'API Gateway',
      reuseExistingServer: !process.env.CI,
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
