import { defineConfig, mergeConfig } from 'vitest/config';
import shared from '../../../vitest.shared';

export default mergeConfig(
  shared,
  defineConfig({
    esbuild: {
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
        },
      },
    },
    test: {
      include: ['src/**/*.spec.ts'],
      exclude: ['**/*.integration.spec.ts', '**/node_modules/**'],
    },
  }),
);
