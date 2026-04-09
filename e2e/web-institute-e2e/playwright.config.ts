import path from 'node:path';
import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.WEB_URL || 'http://localhost:4200';
// Used only as the webServer readiness probe. Playwright accepts 2xx, 3xx, 400,
// 401, 402, 403 as "ready" (https://playwright.dev/docs/test-webserver), so
// GET /api/graphql is fine: in dev it returns 200 (Apollo Sandbox), with CSRF
// prevention it returns 400 — both count as ready. Do NOT point this at a
// route that returns 404/405 or the probe will time out.
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
