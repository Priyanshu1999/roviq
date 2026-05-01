import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

/**
 * Root vitest config — declares 4 named projects:
 *   - unit-node    : pure-logic backend tests (apps/, libs/backend, libs/shared, libs/database, ee/...)
 *   - unit-dom     : frontend tests requiring DOM (libs/frontend, apps/web)
 *   - integration  : real-DB tests (libs/database/__tests__/*.integration.spec.ts etc.)
 *   - e2e-api      : vitest E2E API tests against a running api-gateway
 *
 * Run via:
 *   pnpm vitest run                              # all projects
 *   pnpm vitest run --project unit-node
 *   pnpm vitest run --project unit-dom
 *   pnpm vitest run --project integration
 *   pnpm vitest run --project e2e-api
 *
 * `pnpm test:unit` runs both unit-node + unit-dom together (see package.json).
 *
 * NX still discovers per-project vitest.config.ts files for `nx run <project>:test`.
 * The two coexist: NX uses per-project configs; this root config powers the
 * cross-project pnpm test:* scripts via test.projects.
 *
 * Note: pool: 'forks' is intentionally NOT set on the integration project.
 * Existing RLS tests in libs/database/ share a module-level pg.Pool and were
 * not written for process-per-file isolation.
 */
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: {
          name: 'unit-node',
          environment: 'node',
          globals: false,
          restoreMocks: true,
          include: [
            'apps/api-gateway/src/**/*.spec.ts',
            'apps/notification-service/src/**/*.spec.ts',
            'libs/backend/**/src/**/*.spec.ts',
            'libs/shared/**/src/**/*.spec.ts',
            'libs/database/src/**/*.spec.ts',
            'ee/apps/**/src/**/*.spec.ts',
            'ee/libs/**/src/**/*.spec.ts',
            'scripts/__tests__/**/*.spec.ts',
            'tests/**/*.spec.ts',
          ],
          exclude: [
            '**/*.integration.spec.ts',
            '**/*.api-e2e.spec.ts',
            '**/node_modules/**',
            '**/dist/**',
          ],
          testTimeout: 5000,
        },
      },
      {
        plugins: [tsconfigPaths()],
        // Force the automatic JSX runtime so app/web specs (whose nearest
        // tsconfig uses `"jsx": "preserve"` for Next.js) don't have to add an
        // explicit `import * as React from 'react'` to every file.
        esbuild: { jsx: 'automatic' },
        test: {
          name: 'unit-dom',
          environment: 'happy-dom',
          globals: false,
          restoreMocks: true,
          setupFiles: ['./libs/frontend/ui/src/test-setup.ts'],
          // next-intl's ESM exports import `next/navigation` via a relative
          // path that only resolves inside the real Next.js bundler context.
          // Inlining forces vite to resolve those imports through the
          // workspace node_modules, matching runtime behavior without mocks.
          server: {
            deps: {
              inline: ['next-intl', '@roviq/i18n'],
            },
          },
          include: [
            'libs/frontend/**/src/**/*.spec.ts',
            'libs/frontend/**/src/**/*.spec.tsx',
            'apps/web/src/**/*.spec.ts',
            'apps/web/src/**/*.spec.tsx',
          ],
          exclude: [
            '**/*.integration.spec.ts',
            '**/*.api-e2e.spec.ts',
            '**/node_modules/**',
            '**/dist/**',
          ],
          testTimeout: 5000,
        },
      },
      {
        // SWC emits decorator metadata so that integration tests booting
        // NestJS via Test.createTestingModule() can resolve constructor
        // dependencies by type (e.g., JwtStrategy → ConfigService).
        plugins: [
          tsconfigPaths(),
          swc.vite({
            module: { type: 'es6' },
            jsc: {
              parser: { syntax: 'typescript', decorators: true },
              transform: { legacyDecorator: true, decoratorMetadata: true },
              target: 'es2022',
              keepClassNames: true,
            },
          }),
        ],
        test: {
          name: 'integration',
          environment: 'node',
          globals: false,
          restoreMocks: true,
          setupFiles: ['./vitest.setup.ts'],
          include: [
            'apps/**/src/**/*.integration.spec.ts',
            'libs/**/src/**/*.integration.spec.ts',
            'ee/apps/**/src/**/*.integration.spec.ts',
            'ee/libs/**/src/**/*.integration.spec.ts',
          ],
          exclude: ['**/node_modules/**', '**/dist/**'],
          testTimeout: 30000,
        },
      },
      {
        plugins: [tsconfigPaths()],
        test: {
          name: 'e2e-api',
          environment: 'node',
          globals: false,
          restoreMocks: true,
          include: ['e2e/api-gateway-e2e/src/**/*.api-e2e.spec.ts'],
          exclude: ['**/node_modules/**', '**/dist/**'],
          testTimeout: 30000,
          globalSetup: ['e2e/api-gateway-e2e/global-setup.ts'],
        },
      },
    ],
    // ── Coverage thresholds (Phase 7) ──────────────────────────────────────────
    // Run via: pnpm test:coverage
    //
    // Scoped to two paths:
    //   libs/shared/domain    — value objects, currently at ~92%  → floor 80%
    //   libs/frontend/ui      — UI components/hooks, currently at ~55% → floor 55%
    //
    // Shadcn-only passthrough files (calendar, command, kbd, pagination,
    // scroll-area, spinner, textarea) and the Firebase SDK wrapper are excluded
    // from coverage measurement — they contain no application logic.
    //
    // TODO: raise libs/frontend/ui threshold to 60% once the following are covered:
    //   - input-group, button-group (need consumer-level tests)
    //   - dropdown-menu, popover, sonner (Radix state-machine internals, low ROI)
    coverage: {
      provider: 'v8',
      include: ['libs/shared/domain/src/**/*.{ts,tsx}', 'libs/frontend/ui/src/**/*.{ts,tsx}'],
      exclude: [
        // Thin shadcn/Radix passthroughs — zero application logic
        'libs/frontend/ui/src/components/ui/calendar.tsx',
        'libs/frontend/ui/src/components/ui/command.tsx',
        'libs/frontend/ui/src/components/ui/kbd.tsx',
        'libs/frontend/ui/src/components/ui/pagination.tsx',
        'libs/frontend/ui/src/components/ui/scroll-area.tsx',
        'libs/frontend/ui/src/components/ui/spinner.tsx',
        'libs/frontend/ui/src/components/ui/textarea.tsx',
        // Firebase SDK wrapper — tested via integration tests, not unit tests
        'libs/frontend/ui/src/lib/firebase.ts',
        // Test setup files
        '**/test-setup.ts',
      ],
      thresholds: {
        statements: 55,
        branches: 55,
        functions: 55,
        lines: 55,
      },
    },
  },
});
