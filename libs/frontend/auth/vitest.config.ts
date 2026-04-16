import { defineConfig, mergeConfig } from 'vitest/config';
import shared from '../../../vitest.shared';

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      environment: 'happy-dom',
      include: ['src/**/*.spec.{ts,tsx}'],
      exclude: ['**/*.integration.spec.ts', '**/node_modules/**'],
      // next-intl@4.9.1 ESM dist imports `next/navigation` without a .js
      // extension, which Node 24 strict-ESM rejects. Inlining forces Vite to
      // bundle it (CJS-compat transform) instead of loading it as native ESM.
      // Matches the root vitest.config.ts `unit-dom` project setting.
      server: {
        deps: {
          inline: ['next-intl'],
        },
      },
    },
  }),
);
