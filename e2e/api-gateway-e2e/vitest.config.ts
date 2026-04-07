import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    restoreMocks: true,
    environment: 'node',
    root: path.resolve(__dirname),
    include: ['src/**/*.api-e2e.spec.ts'],
    testTimeout: 15000,
    globalSetup: './global-setup.ts',
  },
});
