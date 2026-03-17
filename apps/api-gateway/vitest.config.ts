import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@roviq/database': path.resolve(__dirname, '../../libs/database/src/index.ts'),
      '@roviq/common-types': path.resolve(__dirname, '../../libs/shared/common-types/src/index.ts'),
      '@roviq/nats-jetstream': path.resolve(
        __dirname,
        '../../libs/backend/nats-jetstream/src/index.ts',
      ),
      '@roviq/redis': path.resolve(__dirname, '../../libs/backend/redis/src/index.ts'),
      '@roviq/casl': path.resolve(__dirname, '../../libs/backend/casl/src/index.ts'),
      '@roviq/domain': path.resolve(__dirname, '../../libs/shared/domain/src/index.ts'),
      '@roviq/nestjs-graphql': path.resolve(
        __dirname,
        '../../libs/backend/nestjs-graphql/src/index.ts',
      ),
      '@roviq/ee-billing-types': path.resolve(
        __dirname,
        '../../ee/libs/shared/billing-types/src/index.ts',
      ),
      '@roviq/ee-payments': path.resolve(__dirname, '../../ee/libs/backend/payments/src/index.ts'),
      '@roviq/ee-gateway': path.resolve(__dirname, '../../ee/apps/api-gateway/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', '../../ee/apps/api-gateway/src/**/*.test.ts'],
  },
});
