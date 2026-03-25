import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from '../common/columns';
import { users } from './users';

export const phoneNumbers = pgTable(
  'phone_numbers',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    countryCode: text('country_code').notNull(),
    number: text().notNull(),
    label: text().default('personal').notNull(),
    isPrimary: boolean('is_primary').default(false).notNull(),
    isWhatsapp: boolean('is_whatsapp').default(false).notNull(),
    isVerified: boolean('is_verified').default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('phone_numbers_country_code_number_key').using(
      'btree',
      table.countryCode.asc().nullsLast(),
      table.number.asc().nullsLast(),
    ),
    index('phone_numbers_user_id_idx').using('btree', table.userId.asc().nullsLast()),
    /** Partial unique: exactly one primary phone per user (enforced at DB level) */
    uniqueIndex('idx_phone_numbers_primary').on(table.userId).where(sql`${table.isPrimary} = true`),
  ],
);
