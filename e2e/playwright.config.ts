import path from 'node:path';
import { workspaceRoot } from '@nx/devkit';
import { defineConfig, devices } from '@playwright/test';

// ── Portal URLs (E2E uses port 4201, separate from dev port 4200) ──
const ADMIN_URL = process.env.WEB_URL_ADMIN || 'http://admin.localhost:4201';
const INSTITUTE_URL = process.env.WEB_URL_INSTITUTE || 'http://localhost:4201';
const RESELLER_URL = process.env.WEB_URL_RESELLER || 'http://reseller.localhost:4201';

// ── Auth state files ──
const adminAuth = path.join(__dirname, 'playwright/.auth/admin.json');
const instituteAuth = path.join(__dirname, 'playwright/.auth/institute.json');
const resellerAuth = path.join(__dirname, 'playwright/.auth/reseller.json');

const chrome = devices['Desktop Chrome'];

export default defineConfig({
  globalSetup: './shared/preflight.ts',
  outputDir: path.join(workspaceRoot, 'dist/.playwright/e2e/test-output'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: path.join(workspaceRoot, 'dist/.playwright/e2e/report'),
        open: 'on-failure',
      },
    ],
  ],

  use: {
    trace: 'on-first-retry',
  },

  expect: {
    toHaveScreenshot: {
      // ~1% diff tolerance accommodates font/antialiasing variance.
      maxDiffPixelRatio: 0.01,
    },
  },

  // ── Auth setup projects (run first, produce storageState files) ──
  projects: [
    {
      name: 'admin-setup',
      testDir: './web-admin-e2e/src',
      testMatch: /.*\.setup\.ts/,
      use: { ...chrome, baseURL: ADMIN_URL },
    },
    {
      name: 'institute-setup',
      testDir: './web-institute-e2e/src',
      testMatch: /.*\.setup\.ts/,
      use: { ...chrome, baseURL: INSTITUTE_URL },
    },
    {
      name: 'reseller-setup',
      testDir: './web-reseller-e2e/src',
      testMatch: /.*\.setup\.ts/,
      use: { ...chrome, baseURL: RESELLER_URL },
    },

    // ── Login page tests (no auth needed) ──
    {
      name: 'admin-login',
      testDir: './web-admin-e2e/src',
      testMatch: /login\.e2e\.spec\.ts/,
      use: { ...chrome, baseURL: ADMIN_URL },
    },
    {
      name: 'institute-login',
      testDir: './web-institute-e2e/src',
      testMatch: /login\.e2e\.spec\.ts/,
      use: { ...chrome, baseURL: INSTITUTE_URL },
    },

    // ── Authenticated tests per portal ──
    {
      name: 'admin',
      testDir: './web-admin-e2e/src',
      testIgnore: [/login\.e2e\.spec\.ts/, /.*\.setup\.ts/],
      use: { ...chrome, baseURL: ADMIN_URL, storageState: adminAuth },
      dependencies: ['admin-setup'],
    },
    {
      name: 'institute',
      testDir: './web-institute-e2e/src',
      testIgnore: [/login\.e2e\.spec\.ts/, /.*\.setup\.ts/],
      use: { ...chrome, baseURL: INSTITUTE_URL, storageState: instituteAuth },
      dependencies: ['institute-setup'],
    },
    {
      name: 'reseller',
      testDir: './web-reseller-e2e/src',
      testIgnore: /.*\.setup\.ts/,
      use: { ...chrome, baseURL: RESELLER_URL, storageState: resellerAuth },
      dependencies: ['reseller-setup'],
    },

    // ── Cross-portal tests (require all auth states) ──
    {
      name: 'cross-portal',
      testDir: './cross-portal/src',
      use: { ...chrome },
      dependencies: ['admin-setup', 'institute-setup', 'reseller-setup'],
    },
  ],

  webServer: {
    command: 'pnpm run dev:web:e2e',
    url: INSTITUTE_URL,
    name: 'Web',
    reuseExistingServer: false,
    cwd: workspaceRoot,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3004',
      NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER: '',
    },
  },
});
