import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
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
 * Uploaded scans/photos of identity and academic documents — platform-level, NO RLS.
 *
 * Stores references to S3/MinIO file URLs. Document verification workflow
 * tracks approval/rejection status.
 */
export const userDocuments = pgTable(
  'user_documents',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),

    /**
     * Document type — determines required fields and validation rules.
     *
     * - `birth_certificate`: mandatory for admission
     * - `tc_incoming`: transfer certificate from previous institute
     * - `report_card`: previous year academic report
     * - `aadhaar_card`: scanned copy of Aadhaar card
     * - `caste_certificate`: for social category verification (SC/ST/OBC)
     * - `income_certificate`: for RTE/EWS/fee concession eligibility
     * - `ews_certificate`: Economically Weaker Section certificate
     * - `medical_certificate`: for CWSN students or medical conditions
     * - `disability_certificate`: RPWD Act 2016 disability certificate
     * - `address_proof`: utility bill, rental agreement, etc.
     * - `passport_photo`: passport-size photo (used for board registration)
     * - `family_photo`: family photograph (used for some state portals)
     * - `bpl_card`: Below Poverty Line card
     * - `transfer_order`: staff transfer order document
     * - `noc`: No Objection Certificate
     * - `affidavit`: legal affidavit (e.g., name change, single parent)
     * - `other`: catch-all for institute-specific documents
     */
    type: varchar('type', { length: 50 }).notNull(),
    description: varchar('description', { length: 255 }),
    /** Array of S3/MinIO file URLs — supports multi-page document scans */
    fileUrls: text('file_urls').array().notNull(),
    /** Document's own reference/serial number (e.g., TC number, certificate number) */
    referenceNumber: varchar('reference_number', { length: 100 }),

    /** Whether this document has been verified by an admin */
    isVerified: boolean('is_verified').default(false).notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: uuid('verified_by').references(() => users.id),
    /** Reason for rejection — populated when admin rejects a document upload */
    rejectionReason: varchar('rejection_reason', { length: 255 }),
    /** Document expiry date — relevant for certificates with validity periods */
    expiryDate: date('expiry_date'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    check(
      'chk_document_type',
      sql`${table.type} IN (
        'birth_certificate', 'tc_incoming', 'report_card', 'aadhaar_card',
        'caste_certificate', 'income_certificate', 'ews_certificate',
        'medical_certificate', 'disability_certificate', 'address_proof',
        'passport_photo', 'family_photo', 'bpl_card', 'transfer_order',
        'noc', 'affidavit', 'other'
      )`,
    ),
    index('idx_user_documents_user_type').on(table.userId, table.type),
  ],
);
