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
import { i18nText } from '../common/columns';

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
    /**
     * Multilingual first name — `{ "en": "Raj", "hi": "राज" }`. English is
     * required (enforced at the Zod layer via `i18nTextSchema`); other
     * locales are optional. Stored as jsonb so every form that captures a
     * name can use `<I18nInput>` and every read site can use
     * `useI18nField()` with a single fallback chain. Matches the plan
     * name pattern from ee billing (ee/apps/api-gateway/src/billing/
     * models/subscription-plan.model.ts).
     */
    firstName: i18nText('first_name').notNull(),
    /**
     * Multilingual last name — `{ "en": "Kumar", "hi": "कुमार" }`. Optional
     * because Indian naming conventions don't always split cleanly into
     * first/last; regional scripts may put the entire name in `firstName`.
     */
    lastName: i18nText('last_name'),
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
     * Auto-generated tsvector for name search across ALL locales.
     * Weight A = first_name, Weight B = last_name. `jsonb_path_query_array`
     * flattens every value in the i18nText map so searching "राज" hits
     * `first_name->>'hi'` and "Raj" hits `first_name->>'en'` without
     * duplicate rows. Uses 'simple' dictionary — no stemming, works for
     * Devanagari/Latin/Tamil/etc. PostgreSQL auto-maintains this column.
     */
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`setweight(to_tsvector('simple', coalesce(array_to_string(ARRAY(SELECT jsonb_each_text(first_name)->>1 WHERE first_name IS NOT NULL), ' '), '')), 'A') || setweight(to_tsvector('simple', coalesce(array_to_string(ARRAY(SELECT jsonb_each_text(last_name)->>1 WHERE last_name IS NOT NULL), ' '), '')), 'B')`,
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
