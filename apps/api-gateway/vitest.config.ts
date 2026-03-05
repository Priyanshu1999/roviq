import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@roviq/prisma-client': path.resolve(__dirname, '../../libs/prisma-client/src/index.ts'),
      '@roviq/common-types': path.resolve(__dirname, '../../libs/common-types/src/index.ts'),
      '@roviq/nats-utils': path.resolve(__dirname, '../../libs/nats-utils/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
