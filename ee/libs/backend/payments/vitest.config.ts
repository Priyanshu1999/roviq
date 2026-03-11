import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    },
  },
  resolve: {
    alias: {
      '@roviq/ee-payments': path.resolve(__dirname, 'src/index.ts'),
      '@roviq/prisma-client': path.resolve(
        __dirname,
        '../../../../libs/backend/prisma-client/src/index.ts',
      ),
      '@roviq/nestjs-prisma': path.resolve(
        __dirname,
        '../../../../libs/backend/nestjs-prisma/src/index.ts',
      ),
      '@roviq/nats-utils': path.resolve(
        __dirname,
        '../../../../libs/backend/nats-utils/src/index.ts',
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
