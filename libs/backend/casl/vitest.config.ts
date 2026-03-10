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
      '@roviq/casl': path.resolve(__dirname, 'src/index.ts'),
      '@roviq/prisma-client': path.resolve(__dirname, '../prisma-client/src/index.ts'),
      '@roviq/common-types': path.resolve(__dirname, '../../shared/common-types/src/index.ts'),
      '@roviq/nestjs-prisma': path.resolve(__dirname, '../nestjs-prisma/src/index.ts'),
      '@roviq/redis': path.resolve(__dirname, '../redis/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
