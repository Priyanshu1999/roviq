import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { RoviqDrizzleLogger } from './logger';
import * as schema from './schema';
import { relations } from './schema/relations';

export const DRIZZLE_DB = Symbol('DRIZZLE_DB');

/** Full-typed Drizzle DB — two generics for db.query.* relational types */
export type DrizzleDB = NodePgDatabase<typeof schema, typeof relations>;

export const drizzleProviders: Provider[] = [
  {
    provide: DRIZZLE_DB,
    inject: [ConfigService],
    useFactory: (config: ConfigService): DrizzleDB => {
      const pool = new Pool({
        connectionString: config.getOrThrow<string>('DATABASE_URL'),
        max: 20,
        idleTimeoutMillis: 30_000,
      });
      return drizzle({
        client: pool,
        schema,
        relations,
        logger: new RoviqDrizzleLogger(),
      });
    },
  },
];
