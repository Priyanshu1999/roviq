import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.ADMIN_PORTAL_URL || 'http://localhost:4200';
const apiURL = process.env.API_URL || 'http://localhost:3000/api/graphql';

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'bun run dev:gateway',
      url: apiURL,
      name: 'API Gateway',
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: 5_000,
    },
    {
      command: 'bun run dev:admin',
      url: baseURL,
      name: 'Admin Portal',
      reuseExistingServer: !process.env.CI,
      cwd: workspaceRoot,
      timeout: 120_000,
    },
  ],
});
