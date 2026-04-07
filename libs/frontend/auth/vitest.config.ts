import { defineConfig, mergeConfig } from 'vitest/config';
import shared from '../../../vitest.shared';

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      environment: 'happy-dom',
      include: ['src/**/*.spec.{ts,tsx}'],
      exclude: ['**/*.integration.spec.ts', '**/node_modules/**'],
    },
  }),
);
