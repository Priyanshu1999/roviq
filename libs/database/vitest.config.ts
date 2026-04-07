import { defineConfig, mergeConfig } from 'vitest/config';
import shared from '../../vitest.shared';

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Unit tests only here. Integration tests are discovered by the
      // root vitest.config.ts via the `integration` project.
      include: ['src/**/*.spec.ts'],
      exclude: ['**/*.integration.spec.ts', '**/node_modules/**'],
      testTimeout: 30_000,
      passWithNoTests: true,
    },
  }),
);
