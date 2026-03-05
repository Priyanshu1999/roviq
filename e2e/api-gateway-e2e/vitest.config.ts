import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.e2e.test.ts'],
    testTimeout: 15000,
    globalSetup: './global-setup.ts',
  },
});
