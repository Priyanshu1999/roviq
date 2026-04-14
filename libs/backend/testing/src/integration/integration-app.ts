import 'json-bigint-patch';
import type { Server } from 'node:http';
import { createMock } from '@golevelup/ts-vitest';
import { type INestApplication, type Type, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule, type TestingModuleBuilder } from '@nestjs/testing';
import { createDrizzleDb, DRIZZLE_DB, type DrizzleDB } from '@roviq/database';
import type { JetStreamClient } from '@roviq/nats-jetstream';
import { REDIS_CLIENT } from '@roviq/redis';
import type { Redis } from 'ioredis';
import { Pool } from 'pg';
import { setupTestEnv } from './test-env.js';

/**
 * One place to type provider overrides — matches `overrideProvider().useValue()`.
 * Unlike `{ provide: unknown; useValue: unknown }`, this lets TypeScript catch
 * typos in the token and mismatches between the token and its value.
 */
export interface ProviderOverride<T = unknown> {
  provide: string | symbol | (new (...args: never[]) => T);
  useValue: T;
}

export interface IntegrationAppOptions {
  /**
   * NestJS modules to import. Typically `[AppModule]` for resolver-level tests
   * or a focused list of feature modules for narrower coverage.
   */
  modules: Type<unknown>[];
  /**
   * Additional providers to override beyond the defaults (Redis + JetStream
   * are mocked by default). Use to swap a service for a stub or to wire up a
   * real NATS connection (see `createIntegrationAppWithNats`).
   */
  overrides?: ProviderOverride[];
  /**
   * If true, do NOT mock the JetStream client — boot against the real NATS
   * server at `process.env.NATS_URL`. Use for end-to-end audit pipeline tests.
   */
  useRealNats?: boolean;
}

export interface IntegrationAppResult {
  app: INestApplication;
  module: TestingModule;
  /** The underlying `http.Server`, ready to pass to supertest. */
  httpServer: Server;
  /**
   * The real Drizzle instance the booted app uses. Pass this to factories like
   * `createTestInstitute(db)` so tests share the app's connection pool instead
   * of opening a second one.
   */
  db: DrizzleDB;
  /**
   * Close the app (and its underlying pg pool) and release resources. Call
   * from `afterAll` — without this, the pg pool leaks between test files.
   */
  close: () => Promise<void>;
}

/**
 * Boot a NestJS application in-process with a real PostgreSQL connection and
 * mocked external services (Redis + NATS by default).
 *
 * The returned app is wired identically to production: same global prefix
 * (`/api`), same ValidationPipe options, same scope guards, same audit
 * interceptor. Test against it via `gqlRequest(result.httpServer, ...)`.
 */
export async function createIntegrationApp(
  options: IntegrationAppOptions,
): Promise<IntegrationAppResult> {
  // Must run BEFORE Test.createTestingModule so AppModule's ConfigModule
  // validation sees all required env vars. Moved inside the function so the
  // side effect fires only when an integration app is actually booted — never
  // when unit tests import helpers from this lib.
  setupTestEnv();

  let builder: TestingModuleBuilder = Test.createTestingModule({
    imports: options.modules,
  });

  // Mock Redis. ImpersonationSessionGuard short-circuits for non-impersonation
  // tokens, so a default mock with .get returning null is enough for tests
  // that don't exercise session flows.
  builder = builder.overrideProvider(REDIS_CLIENT).useValue(
    createMock<Redis>({
      get: async () => null,
      set: async () => 'OK',
      del: async () => 0,
    }),
  );

  // Mock JetStream — AuditInterceptor publishes fire-and-forget, so a no-op
  // mock satisfies it for tests that don't care about the audit pipeline.
  if (!options.useRealNats) {
    builder = builder.overrideProvider('JETSTREAM_CLIENT').useValue(createMock<JetStreamClient>());
  }

  // Override DRIZZLE_DB with a pool wired directly to DATABASE_URL_TEST.
  // The default factory reads DATABASE_URL via ConfigService, which loads
  // from .env into an internal cache that takes precedence over process.env —
  // so a setupTestEnv override of process.env.DATABASE_URL has no effect on
  // the production factory's pool. This override bypasses ConfigService
  // entirely, guaranteeing the test app talks to the test DB.
  const testDbUrl =
    process.env.DATABASE_URL_TEST ??
    'postgresql://roviq_pooler:roviq_pooler_dev@localhost:5434/roviq_test';
  const testPool = new Pool({ connectionString: testDbUrl, max: 20, idleTimeoutMillis: 30_000 });
  const testDb = createDrizzleDb(testPool);
  builder = builder.overrideProvider(DRIZZLE_DB).useValue(testDb);

  for (const override of options.overrides ?? []) {
    builder = builder.overrideProvider(override.provide).useValue(override.useValue);
  }

  const module = await builder.compile();
  // `logger: false` disables Nest's default logger entirely. The previous
  // version passed `bufferLogs: true` without ever calling `app.useLogger()`,
  // which silently leaks buffered log entries for the lifetime of the app.
  // Set ROVIQ_TEST_VERBOSE=1 to surface runtime errors during test debugging.
  const app = module.createNestApplication({
    logger: process.env.ROVIQ_TEST_VERBOSE === '1' ? ['error', 'warn'] : false,
    rawBody: true,
  });

  // Mirror main.ts: same global prefix, same ValidationPipe options. Without
  // these, requests hit /graphql instead of /api/graphql and resolver argument
  // validation behaves differently from production.
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  const httpServer = app.getHttpServer() as Server;
  const db = module.get<DrizzleDB>(DRIZZLE_DB);

  return {
    app,
    module,
    httpServer,
    db,
    close: async () => {
      await app.close();
      await testPool.end();
    },
  };
}

/**
 * Variant that boots against a real NATS server. Use only for tests that
 * exercise the full audit pipeline (mutation → publish → consumer → DB).
 */
export function createIntegrationAppWithNats(
  options: Omit<IntegrationAppOptions, 'useRealNats'>,
): Promise<IntegrationAppResult> {
  return createIntegrationApp({ ...options, useRealNats: true });
}
