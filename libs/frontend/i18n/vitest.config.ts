import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [{ find: '@roviq/i18n', replacement: path.resolve(__dirname, 'src/index.ts') }],
  },
  test: {
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
