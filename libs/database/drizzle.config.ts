import { defineConfig } from 'drizzle-kit';

const schemaGlobs = ['./src/schema/index.ts'];

if (process.env.ROVIQ_EE === 'true') {
  schemaGlobs.push('../../ee/libs/database/src/schema/index.ts');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: schemaGlobs,
  out: './migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
  schemaFilter: ['public'],
  tablesFilter: ['!_prisma_migrations', '!audit_logs_*'],
  introspect: {
    casing: 'camel',
  },
});
