import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@roviq/prisma-client': path.resolve(__dirname, 'src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    root: __dirname,
    include: ['src/**/*.integration.test.ts'],
    exclude: ['node_modules/**'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
