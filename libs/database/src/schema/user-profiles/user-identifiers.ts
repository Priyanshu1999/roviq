import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  customType,
  date,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from '../auth/users';
import { userIdentifierType } from '../common/enums';

/**
 * Drizzle custom type for BYTEA columns storing AES-256-GCM encrypted data.
 * Maps JS `Buffer` ↔ PostgreSQL `bytea`.
 */
export const encryptedBytea = customType<{
  data: Buffer;
  driverData: Buffer;
}>({
  dataType() {
    return 'bytea';
  },
  fromDriver(value: Buffer): Buffer {
    return Buffer.isBuffer(value) ? value : Buffer.from(value);
  },
  toDriver(value: Buffer): Buffer {
    return Buffer.isBuffer(value) ? value : Buffer.from(value);
  },
});

/**
 * Government-issued identity documents — platform-level, NO RLS.
 *
 * Sensitive identifiers (Aadhaar, PAN) use application-level AES-256-GCM
 * encryption via `IDENTITY_ENCRYPTION_KEY`. Non-sensitive identifiers
 * (APAAR, PEN, registration numbers) stored in `value_plain`.
 *
 * The CHECK constraint enforces that either:
 * - Encrypted path: `value_encrypted`, `value_hash`, and `value_masked` are all set, OR
 * - Plain path: `value_plain` is set
 */
export const userIdentifiers = pgTable(
  'user_identifiers',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),

    /**
     * Identifier type — determines encryption path and validation rules.
     *
     * Encrypted types (value_encrypted + value_hash + value_masked):
     * - `aadhaar`: 12-digit UIDAI number (Verhoeff checksum validated)
     * - `pan`: 10-char alphanumeric PAN card number
     *
     * Plain types (value_plain):
     * - `passport`: passport number
     * - `voter_id`: voter ID (EPIC number)
     * - `apaar`: 12-digit Automated Permanent Academic Account Registry ID
     * - `pen`: Permanent Education Number
     * - `cbse_registration`: CBSE board registration number (Class 9/11)
     * - `bseh_enrollment`: Board of School Education Haryana enrollment number
     * - `shala_darpan_id`: Rajasthan NIC Shala Darpan student/teacher ID
     * - `parivar_pehchan_patra`: 8-digit Haryana family ID
     * - `jan_aadhaar`: Rajasthan family ID
     * - `migration_certificate`: board-issued migration certificate number
     */
    type: userIdentifierType('type').notNull(),

    /** AES-256-GCM encrypted value — for Aadhaar, PAN (DPDP Act compliance) */
    valueEncrypted: encryptedBytea('value_encrypted'),
    /** SHA-256 hash for duplicate detection lookups (e.g., Aadhaar dedup during admission) */
    valueHash: varchar('value_hash', { length: 64 }),
    /** Unencrypted value — for non-sensitive identifiers (APAAR, PEN, registration numbers) */
    valuePlain: varchar('value_plain', { length: 50 }),
    /** Masked display value — e.g., "XXXX-XXXX-4532" for Aadhaar, shown in UI/exports */
    valueMasked: varchar('value_masked', { length: 20 }),

    issuingAuthority: varchar('issuing_authority', { length: 100 }),
    validFrom: date('valid_from'),
    validTo: date('valid_to'),
    /** Whether this identifier has been verified (OTP, DigiLocker, manual check) */
    isVerified: boolean('is_verified').default(false).notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: uuid('verified_by').references(() => users.id),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    /**
     * Either the encrypted path (value_encrypted + value_hash + value_masked)
     * or the plain path (value_plain) must be populated — never both empty.
     */
    check(
      'chk_identifier_value',
      sql`(
        ${table.valueEncrypted} IS NOT NULL
        AND ${table.valueHash} IS NOT NULL
        AND ${table.valueMasked} IS NOT NULL
      ) OR ${table.valuePlain} IS NOT NULL`,
    ),
    /** Only one identifier per type per user */
    uniqueIndex('uq_identifier_user_type').on(table.userId, table.type),
    /** Aadhaar lookup by hash for duplicate detection during admission */
    index('idx_identifiers_aadhaar_hash').on(table.valueHash).where(sql`type = 'AADHAAR'`),
    index('idx_user_identifiers_user_id').on(table.userId),
  ],
);
