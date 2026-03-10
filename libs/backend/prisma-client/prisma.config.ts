import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema.prisma',
  migrate: {
    schema: './prisma/schema.prisma',
  },
  datasource: {
    url: env('DATABASE_URL_MIGRATE') ?? env('DATABASE_URL'),
  },
});
