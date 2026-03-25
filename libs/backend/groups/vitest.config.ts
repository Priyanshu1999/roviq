import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@roviq/groups': path.resolve(__dirname, 'src/index.ts'),
      '@roviq/database': path.resolve(__dirname, '../../database/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
