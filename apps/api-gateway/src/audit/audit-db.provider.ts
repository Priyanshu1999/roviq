import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';

// Audit writes use the superuser pool so a single batch can span multiple
// tenants — withTenant()'s SET LOCAL would pin it to one.
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
