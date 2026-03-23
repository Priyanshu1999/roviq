import { z } from 'zod';

const envSchema = z.looseObject({
  // Database
  DATABASE_URL: z.string({
    error: 'DATABASE_URL — PostgreSQL connection string for the application runtime role',
  }),

  // NATS
  NATS_URL: z.string({
    error: 'NATS_URL — NATS server URL for event streaming (e.g. nats://localhost:4222)',
  }),

  // Novu
  NOVU_SECRET_KEY: z.string({
    error: 'NOVU_SECRET_KEY — Novu secret key for server-side API calls',
  }),
  NOVU_APPLICATION_IDENTIFIER: z.string({
    error: 'NOVU_APPLICATION_IDENTIFIER — Novu application identifier',
  }),

  // Optional
  NODE_ENV: z.string().optional(),
  NOVU_MODE: z.enum(['local', 'cloud']).optional(),
  NOVU_API_URL: z.string().url().optional(),
  NOTIFICATION_SERVICE_PORT: z.coerce.number().optional(),
  LOG_LEVEL: z.string().optional(),
});

export function validate(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message);
    throw new Error(
      `Missing required environment variables — copy them from .env.example into .env:\n  - ${errors.join('\n  - ')}`,
    );
  }

  return result.data;
}
