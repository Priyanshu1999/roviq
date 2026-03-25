import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from '../auth/users';

/**
 * Drizzle custom type for a PostgreSQL `tsvector` column.
 * Mapped as `string` in TypeScript (serialised tsvector representation).
 * The actual column is GENERATED ALWAYS AS (...) STORED — created via custom migration.
 */
const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

/**
 * Platform-level personal profile extending the Auth `users` table.
 *
 * NO RLS — globally scoped. Write access controlled by CASL (self or admin).
 * A user's name, DOB, and gender don't change per institute.
 */
export const userProfiles = pgTable(
  'user_profiles',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),

    // ── Personal ────────────────────────────────────────
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }),
    /**
     * Full name in regional script (e.g., "राज कुमार" for Hindi).
     * Required by RBSE registration which demands Hindi + English names.
     * Single field because regional names don't always split cleanly into first/last.
     */
    nameLocal: varchar('name_local', { length: 200 }),
    /** Biological gender — restricted to male/female/other per government reporting requirements (UDISE+) */
    gender: varchar('gender', { length: 10 }),
    dateOfBirth: date('date_of_birth'),
    /**
     * ABO-Rh blood group — printed on institute ID cards and used in medical records.
     * Values: `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`
     */
    bloodGroup: varchar('blood_group', { length: 5 }),
    nationality: varchar('nationality', { length: 50 }).default('Indian'),
    religion: varchar('religion', { length: 30 }),
    /** Primary spoken language — required by UDISE+ DCF for student general profile */
    motherTongue: varchar('mother_tongue', { length: 50 }),

    // ── Images ──────────────────────────────────────────
    profileImageUrl: text('profile_image_url'),
    coverImageUrl: text('cover_image_url'),

    // ── Full-text search ────────────────────────────────
    /**
     * Auto-generated tsvector for name search.
     * Weight A = first_name (most relevant), Weight B = last_name.
     * Uses 'simple' dictionary for multilingual support (no stemming).
     * GENERATED ALWAYS AS (...) STORED — PostgreSQL auto-maintains this column.
     */
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`setweight(to_tsvector('simple', coalesce(first_name, '')), 'A') || setweight(to_tsvector('simple', coalesce(last_name, '')), 'B')`,
    ),

    // ── Metadata ────────────────────────────────────────
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
    createdBy: uuid('created_by').references(() => users.id),
    updatedBy: uuid('updated_by').references(() => users.id),
  },
  (table) => [
    check('chk_gender', sql`${table.gender} IN ('male', 'female', 'other')`),
    check(
      'chk_blood_group',
      sql`${table.bloodGroup} IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')`,
    ),
    index('idx_user_profiles_user_id').on(table.userId),
    /** GIN index on the generated tsvector for fast full-text search */
    index('idx_user_profiles_search').using('gin', sql`search_vector`),
  ],
);
