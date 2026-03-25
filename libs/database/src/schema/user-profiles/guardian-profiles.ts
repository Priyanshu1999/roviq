import { sql } from 'drizzle-orm';
import { bigint, check, foreignKey, index, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from '../auth/users';
import { tenantColumns } from '../common/columns';
import { tenantPolicies } from '../common/rls-policies';
import { institutes } from '../tenant/institutes';
import { memberships } from '../tenant/memberships';

/**
 * Tenant-scoped guardian domain data — one row per membership (one guardian per institute).
 *
 * Three-tier RLS enforced. Annual income stored in paise (BIGINT)
 * for RTE eligibility verification — no decimal truncation.
 */
export const guardianProfiles = pgTable(
  'guardian_profiles',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    membershipId: uuid('membership_id')
      .notNull()
      .unique()
      .references(() => memberships.id, { onDelete: 'restrict', onUpdate: 'cascade' }),

    occupation: varchar('occupation', { length: 100 }),
    /** Employer name */
    organization: varchar('organization', { length: 200 }),
    /** Job title */
    designation: varchar('designation', { length: 100 }),
    /**
     * Annual household income in **paise** (1/100th of ₹).
     * BIGINT to avoid decimal truncation for RTE income threshold verification.
     * Example: ₹3,00,000 = 30000000 paise.
     */
    annualIncome: bigint('annual_income', { mode: 'bigint' }),
    /**
     * Highest education level:
     * - `illiterate`: no formal education
     * - `primary`: up to Class 5
     * - `secondary`: up to Class 10/12
     * - `graduate`: bachelor's degree
     * - `post_graduate`: master's degree
     * - `professional`: professional degree (MBBS, LLB, CA, etc.)
     */
    educationLevel: varchar('education_level', { length: 50 }),

    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    check(
      'chk_education_level',
      sql`${table.educationLevel} IS NULL OR ${table.educationLevel} IN (
        'illiterate', 'primary', 'secondary', 'graduate', 'post_graduate', 'professional'
      )`,
    ),

    index('idx_guardian_profiles_tenant').on(table.tenantId).where(sql`${table.deletedAt} IS NULL`),

    ...tenantPolicies('guardian_profiles'),
  ],
).enableRLS();
