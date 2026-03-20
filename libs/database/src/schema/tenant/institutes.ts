import { sql } from 'drizzle-orm';
import { index, jsonb, pgPolicy, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { entityColumns, i18nText } from '../common/columns';
import { instituteStatus, instituteType, setupStatus, structureFramework } from '../common/enums';
import { entityPolicies, roviqReseller } from '../common/rls-policies';
import { resellers } from '../reseller/resellers';

// ── JSONB type definitions ─────────────────────────────

export type InstitutePhone = {
  countryCode: string;
  number: string;
  isPrimary: boolean;
  isWhatsappEnabled: boolean;
  label: string;
};

export type InstituteEmail = {
  address: string;
  isPrimary: boolean;
  label: string;
};

export type InstituteContact = {
  phones: InstitutePhone[];
  emails: InstituteEmail[];
};

export type InstituteAddress = {
  line1: string;
  line2?: string;
  line3?: string;
  city: string;
  district: string;
  state: string;
  postalCode: string;
  country: string;
  coordinates?: { lat: number; lng: number };
};

// ── Table definition ───────────────────────────────────

export const institutes = pgTable(
  'institutes',
  {
    id: uuid().defaultRandom().primaryKey(),
    name: i18nText('name').notNull(),
    slug: text().notNull(),
    code: text(),
    type: instituteType().default('SCHOOL').notNull(),
    structureFramework: structureFramework('structure_framework').default('TRADITIONAL').notNull(),
    setupStatus: setupStatus('setup_status').default('PENDING').notNull(),
    contact: jsonb().$type<InstituteContact>().default({ phones: [], emails: [] }).notNull(),
    address: jsonb().$type<InstituteAddress>(),
    // Deprecated: use institute_branding.logoUrl instead (kept for backward compatibility)
    logoUrl: text('logo_url'),
    timezone: text().default('Asia/Kolkata').notNull(),
    currency: text().default('INR').notNull(),
    settings: jsonb().default({}).notNull(),
    status: instituteStatus().default('ACTIVE').notNull(),
    resellerId: uuid('reseller_id')
      .default(sql`'00000000-0000-0000-0000-000000000001'`)
      .notNull()
      .references(() => resellers.id),
    groupId: uuid('group_id'),
    ...entityColumns,
  },
  (table) => [
    uniqueIndex('institutes_slug_key').using('btree', table.slug.asc().nullsLast()),
    index('institutes_group_id_idx').on(table.groupId),
    uniqueIndex('institutes_code_key')
      .on(table.code)
      .where(sql`${table.deletedAt} IS NULL AND ${table.code} IS NOT NULL`),
    index('institutes_type_idx').on(table.type),
    index('institutes_reseller_id_idx').on(table.resellerId),
    index('institutes_status_idx').on(table.status),
    ...entityPolicies('institutes'),
    // roviq_reseller: ALL for their reseller's institutes
    pgPolicy('institutes_reseller_all', {
      for: 'all',
      to: roviqReseller,
      using: sql`reseller_id = current_setting('app.current_reseller_id', true)::uuid`,
      withCheck: sql`reseller_id = current_setting('app.current_reseller_id', true)::uuid`,
    }),
  ],
);
