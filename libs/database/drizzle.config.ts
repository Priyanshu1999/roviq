import { defineConfig } from 'drizzle-kit';

const schemaGlobs = ['./src/schema/index.ts'];

if (process.env.ROVIQ_EE === 'true') {
  schemaGlobs.push('../../ee/libs/database/src/schema/index.ts');
}

// Use DATABASE_URL_MIGRATE (owner role) for schema operations (generate, push, migrate).
// Falls back to DATABASE_URL for backwards compatibility.
const dbUrl = process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL;
if (!dbUrl) {
  throw 'Define DATABASE_URL_MIGRATE or DATABASE_URL env variable in .env file';
}
export default defineConfig({
  dialect: 'postgresql',
  schema: schemaGlobs,
  out: './migrations',
  dbCredentials: {
    url: dbUrl,
  },
  strict: true,
  verbose: true,
  schemaFilter: ['public'],
  tablesFilter: ['!audit_logs_*'],
  entities: {
    roles: {
      // Don't let drizzle-kit manage connection/pool roles — only app roles are in schema
      exclude: ['roviq', 'roviq_pooler'],
    },
  },
  introspect: {
    casing: 'camel',
  },
});
