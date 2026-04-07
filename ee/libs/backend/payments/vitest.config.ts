import swc from 'unplugin-swc';
import { defineConfig, mergeConfig } from 'vitest/config';
import shared from '../../../../vitest.shared';

export default mergeConfig(
  shared,
  defineConfig({
    root: __dirname,
    plugins: [swc.vite({ module: { type: 'es6' } })],
    test: {
      include: ['src/**/*.spec.ts'],
      exclude: ['**/*.integration.spec.ts', '**/node_modules/**'],
    },
  }),
);
