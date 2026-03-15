import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@roviq/common-types',
        replacement: path.resolve(__dirname, '../../shared/common-types/src/index.ts'),
      },
      { find: '@roviq/auth', replacement: path.resolve(__dirname, 'src/index.ts') },
      { find: /^@roviq\/ui\/(.+)$/, replacement: path.resolve(__dirname, '../ui/src/$1') },
      { find: '@roviq/ui', replacement: path.resolve(__dirname, '../ui/src/index.ts') },
    ],
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
