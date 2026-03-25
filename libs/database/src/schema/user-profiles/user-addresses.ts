import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from '../auth/users';

/** Geographic coordinates for OASIS geo-tagging */
export type Coordinates = {
  lat: number;
  lng: number;
};

/**
 * User addresses — platform-level, NO RLS.
 *
 * Each user can have at most one address per type (permanent, current, emergency).
 * District field is essential for Indian government reporting (UDISE+, Shala Darpan).
 */
export const userAddresses = pgTable(
  'user_addresses',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),

    /**
     * Address type:
     * - `permanent`: legal/domicile address (used for government reporting, TC issuance)
     * - `current`: current residential address (used for communication)
     * - `emergency`: emergency contact address (used for safety/medical situations)
     */
    type: varchar('type', { length: 20 }).notNull(),
    line1: varchar('line1', { length: 255 }).notNull(),
    line2: varchar('line2', { length: 255 }),
    line3: varchar('line3', { length: 255 }),
    city: varchar('city', { length: 100 }).notNull(),
    /** District — essential for UDISE+ DCF and Shala Darpan government reporting */
    district: varchar('district', { length: 100 }),
    state: varchar('state', { length: 100 }).notNull(),
    country: varchar('country', { length: 50 }).notNull().default('India'),
    postalCode: varchar('postal_code', { length: 10 }).notNull(),
    /** Geographic coordinates { lat, lng } — used for OASIS geo-tagging */
    coordinates: jsonb().$type<Coordinates>(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    check('chk_address_type', sql`${table.type} IN ('permanent', 'current', 'emergency')`),
    /** One address per type per user */
    uniqueIndex('uq_address_user_type').on(table.userId, table.type),
    index('idx_user_addresses_user_id').on(table.userId),
  ],
);
