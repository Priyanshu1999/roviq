import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@roviq/database': resolve(__dirname, '../../libs/database/src/index.ts'),
      '@roviq/nats-jetstream': resolve(__dirname, '../../libs/backend/nats-jetstream/src/index.ts'),
      '@roviq/notifications': resolve(__dirname, '../../libs/backend/notifications/src/index.ts'),
      '@roviq/telemetry': resolve(__dirname, '../../libs/backend/telemetry/src/index.ts'),
      '@roviq/common-types': resolve(__dirname, '../../libs/shared/common-types/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
