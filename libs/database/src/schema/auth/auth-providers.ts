import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from '../common/columns';
import { users } from './users';

export const authProviders = pgTable(
  'auth_providers',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    provider: text().notNull(),
    providerUserId: text('provider_user_id'),
    providerData: jsonb('provider_data'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('auth_providers_provider_provider_user_id_key').using(
      'btree',
      table.provider.asc().nullsLast(),
      table.providerUserId.asc().nullsLast(),
    ),
    index('auth_providers_user_id_idx').using('btree', table.userId.asc().nullsLast()),
  ],
);
