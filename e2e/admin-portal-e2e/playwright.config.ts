import path from 'node:path';
import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.ADMIN_PORTAL_URL || 'http://admin.localhost:4200';
const apiURL = process.env.API_URL || 'http://localhost:3000/api/graphql';
const adminAuthFile = path.join(__dirname, 'playwright/.auth/admin.json');

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
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
      testMatch: /login\.spec\.ts/,
    },

    // Authenticated tests — reuse admin login state
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: adminAuthFile,
      },
      testIgnore: /login\.spec\.ts/,
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      // API gateway is provided externally (Tilt locally, Docker E2E stack in CI).
      // Reuse always — CI must NOT spawn a fresh gateway.
      command: 'pnpm run dev:gateway',
      url: apiURL,
      name: 'API Gateway',
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: 60_000,
    },
    {
      // Web app: spawn ourselves. apps/web hosts admin via subdomain routing.
      command: 'pnpm run dev:web',
      url: baseURL,
      name: 'Web (admin scope)',
      reuseExistingServer: !process.env.CI,
      cwd: workspaceRoot,
      timeout: 120_000,
    },
  ],
});
