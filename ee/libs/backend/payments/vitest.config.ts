import path from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    alias: {
      '@roviq/ee-payments': path.resolve(__dirname, 'src/index.ts'),
      '@roviq/nats-jetstream': path.resolve(
        __dirname,
        '../../../../libs/backend/nats-jetstream/src/index.ts',
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
