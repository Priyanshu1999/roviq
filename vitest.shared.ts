import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

/**
 * Shared base config imported by per-project vitest.config.ts files via
 * mergeConfig(). Cannot extend the root vitest.config.ts directly because
 * the root has `test.projects` and projects cannot inherit a `projects`
 * configuration recursively.
 *
 * Path aliases come from tsconfig.base.json automatically — no per-project
 * resolve.alias declarations needed.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: false,
    restoreMocks: true,
  },
});
