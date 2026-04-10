import path from 'node:path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths({ root: '../..' })],
  test: {
    globals: false,
    restoreMocks: true,
    environment: 'node',
    root: path.resolve(__dirname),
    include: ['src/**/*.api-e2e.spec.ts'],
    testTimeout: 30000,
    globalSetup: './global-setup.ts',
    fileParallelism: false,
  },
});
