import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from '../auth/users';
import { tenantPoliciesSimple } from '../common/rls-policies';
import { institutes } from '../tenant/institutes';
import { admissionApplications } from './admission-applications';

/**
 * Documents submitted with an admission application — per-document verification tracking.
 *
 * Immutable append-only (no soft delete). Uses `tenantPoliciesSimple` (no deleted_at).
 * Three-tier RLS enforced.
 */
export const applicationDocuments = pgTable(
  'application_documents',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => admissionApplications.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tenantId: uuid('tenant_id').notNull(),
    /** Document type — same enum as user_documents.type (birth_certificate, aadhaar_card, etc.) */
    type: varchar('type', { length: 50 }).notNull(),
    /** Array of S3/MinIO file URLs — supports multi-page document scans */
    fileUrls: text('file_urls').array().notNull(),
    /** Whether this document has been verified by an admin */
    isVerified: boolean('is_verified').default(false),
    /** Admin who verified (or rejected) this document */
    verifiedBy: uuid('verified_by').references(() => users.id),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    /** Reason for rejection — populated when admin rejects a document */
    rejectionReason: varchar('rejection_reason', { length: 255 }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    index('idx_application_documents_app').on(table.applicationId),

    ...tenantPoliciesSimple('application_documents'),
  ],
).enableRLS();
