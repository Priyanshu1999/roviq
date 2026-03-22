import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';

/**
 * Separate pg Pool for audit writes — bypasses Drizzle/RLS extensions.
 *
 * Uses DATABASE_URL_AUDIT (roviq superuser) because:
 * - Audit writes span multiple tenants in a single batch
 * - withTenant() SET LOCAL would scope to a single tenant
 * - Raw parameterized SQL is cleanest for high-throughput bulk INSERTs
 */
export const AUDIT_DB_POOL = Symbol('AUDIT_DB_POOL');

export const auditDbProvider: Provider = {
  provide: AUDIT_DB_POOL,
  inject: [ConfigService],
  useFactory: (config: ConfigService): pg.Pool => {
    return new pg.Pool({
      connectionString: config.getOrThrow<string>('DATABASE_URL_AUDIT'),
      max: 5,
    });
  },
};
