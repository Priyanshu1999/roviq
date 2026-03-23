import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30_000,
    // @TODO: remove this config when first unit test is added to this project.
    passWithNoTests: true,
    // Unit and integration tests separated via Vitest projects.
    // `nx run database:test` runs unit only.
    // `nx run database:test:integration` runs integration (needs real DB).
    projects: [
      {
        extends: true,

        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.integration.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/*.integration.test.ts'],
        },
      },
    ],
  },
});
