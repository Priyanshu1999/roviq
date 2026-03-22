import { z } from 'zod';

const envSchema = z.looseObject({
  // Database
  DATABASE_URL: z.string({
    error:
      'DATABASE_URL — PostgreSQL connection string for the pooler role (roviq_pooler, assumes roles via SET LOCAL ROLE)',
  }),

  // Redis
  REDIS_URL: z.string({
    error: 'REDIS_URL — Redis connection URL (e.g. redis://localhost:6379)',
  }),

  // NATS
  NATS_URL: z.string({
    error: 'NATS_URL — NATS server URL for event streaming (e.g. nats://localhost:4222)',
  }),

  // JWT
  JWT_SECRET: z.string({
    error: 'JWT_SECRET — signing key for access tokens',
  }),
  JWT_REFRESH_SECRET: z.string({
    error: 'JWT_REFRESH_SECRET — signing key for refresh tokens (must differ from JWT_SECRET)',
  }),

  // WebAuthn / Passkey
  WEBAUTHN_RP_ID: z.string({
    error: 'WEBAUTHN_RP_ID — relying party identifier, typically the domain (e.g. localhost)',
  }),
  WEBAUTHN_RP_NAME: z.string({
    error: 'WEBAUTHN_RP_NAME — relying party display name (e.g. Roviq)',
  }),
  ALLOWED_ORIGINS: z.string({
    error:
      'ALLOWED_ORIGINS — comma-separated allowed origins for CORS and WebAuthn (e.g. http://localhost:4200)',
  }),

  // Optional
  NODE_ENV: z.string().optional(),
  API_GATEWAY_PORT: z.coerce.number().optional(),
  LOG_LEVEL: z.string().optional(),
  JWT_EXPIRATION: z.string().optional(),
  JWT_REFRESH_EXPIRATION: z.string().optional(),
  ROVIQ_EE: z.string().optional(),
  NOTIFICATION_SERVICE_URL: z.string().optional(),
  NOVU_MODE: z.enum(['local', 'cloud']).optional(),
  NOVU_API_URL: z.string().url().optional(),
  BILLING_RETURN_URL: z.string().url().optional(),
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
