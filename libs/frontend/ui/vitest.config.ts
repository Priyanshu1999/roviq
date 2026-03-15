import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@roviq\/ui\/(.+)$/, replacement: path.resolve(__dirname, 'src/$1') },
      { find: '@roviq/ui', replacement: path.resolve(__dirname, 'src/index.ts') },
    ],
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
