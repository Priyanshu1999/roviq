import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenantPoliciesSimple } from '../common/rls-policies';
import { institutes } from '../tenant/institutes';

/**
 * Versioned privacy notices per institute per language.
 *
 * DPDP Section 5 and Rule 3 require privacy notices to be:
 * - Standalone and independently understandable
 * - Available in at least English and Hindi
 * - Versioned (new version doesn't invalidate old consents)
 *
 * No soft delete (tenantPoliciesSimple). Three-tier RLS enforced.
 */
export const privacyNotices = pgTable(
  'privacy_notices',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    /** Version number — monotonically increasing per tenant */
    version: integer('version').notNull(),
    /** Language code — 'en', 'hi', 'ur', etc. At least English and Hindi required */
    language: varchar('language', { length: 10 }).notNull().default('en'),
    /** Full text of the privacy notice */
    content: text('content').notNull(),
    /** Whether this is the currently active notice (shown to new guardians) */
    isActive: boolean('is_active').notNull().default(false),
    /** When this notice version was published */
    publishedAt: timestamp('published_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /** One version per language per tenant */
    uniqueIndex('uq_notice_version').on(table.tenantId, table.version, table.language),

    ...tenantPoliciesSimple('privacy_notices'),
  ],
).enableRLS();
