import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@roviq/prisma-client': path.resolve(
        __dirname,
        '../../libs/backend/prisma-client/src/index.ts',
      ),
      '@roviq/common-types': path.resolve(__dirname, '../../libs/shared/common-types/src/index.ts'),
      '@roviq/nats-utils': path.resolve(__dirname, '../../libs/backend/nats-utils/src/index.ts'),
      '@roviq/nestjs-prisma': path.resolve(
        __dirname,
        '../../libs/backend/nestjs-prisma/src/index.ts',
      ),
      '@roviq/redis': path.resolve(__dirname, '../../libs/backend/redis/src/index.ts'),
      '@roviq/casl': path.resolve(__dirname, '../../libs/backend/casl/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
