import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@roviq/common-types': path.resolve(__dirname, '../../shared/common-types/src/index.ts'),
      '@roviq/auth': path.resolve(__dirname, 'src/index.ts'),
      '@roviq/ui': path.resolve(__dirname, '../ui/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
