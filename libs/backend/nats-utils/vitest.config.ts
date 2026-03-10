import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@roviq/nats-utils': path.resolve(__dirname, 'src/index.ts'),
      '@roviq/prisma-client': path.resolve(__dirname, '../prisma-client/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
