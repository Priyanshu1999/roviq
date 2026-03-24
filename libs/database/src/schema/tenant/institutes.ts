import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { entityColumns, i18nText } from '../common/columns';
import {
  educationLevel,
  instituteStatus,
  instituteType,
  setupStatus,
  structureFramework,
} from '../common/enums';
import { roviqAdmin, roviqApp, roviqReseller } from '../common/rls-policies';
import { resellers } from '../reseller/resellers';
import { instituteGroups } from './institute-groups';

/** Derived type from the pgEnum — 'PENDING_APPROVAL' | 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'REJECTED' */
export type InstituteStatus = (typeof instituteStatus.enumValues)[number];

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
    code: varchar({ length: 50 }),
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
    /** Whether this is a demo institute — sample data seeded, notifications disabled */
    isDemo: boolean('is_demo').default(false).notNull(),
    /** Education levels offered by this institute (e.g., primary + secondary) */
    departments: educationLevel().array().notNull().default(sql`'{}'::\"EducationLevel\"[]`),
    status: instituteStatus().default('ACTIVE').notNull(),
    resellerId: uuid('reseller_id')
      .default(sql`'00000000-0000-0000-0000-000000000001'`)
      .notNull()
      .references(() => resellers.id),
    groupId: uuid('group_id').references(() => instituteGroups.id),
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
    // ── RLS policies (PRD §9.3 — institutes is the tenant root, special case) ──

    // roviq_app: SELECT only — institute users can read their own institute
    pgPolicy('institutes_app_select', {
      for: 'select',
      to: roviqApp,
      using: sql`id = current_setting('app.current_tenant_id', true)::uuid AND deleted_at IS NULL`,
    }),

    // roviq_app: trash view (admin-only via CASL, RLS allows when app.include_deleted is set)
    pgPolicy('institutes_app_select_trash', {
      for: 'select',
      to: roviqApp,
      using: sql`
        id = current_setting('app.current_tenant_id', true)::uuid
        AND deleted_at IS NOT NULL
        AND current_setting('app.include_deleted', true) = 'true'
      `,
    }),

    // roviq_reseller: ALL on their reseller's institutes (GRANTs limit to SELECT + INSERT + UPDATE)
    pgPolicy('institutes_reseller_all', {
      for: 'all',
      to: roviqReseller,
      using: sql`reseller_id = current_setting('app.current_reseller_id', true)::uuid`,
      withCheck: sql`reseller_id = current_setting('app.current_reseller_id', true)::uuid`,
    }),

    // roviq_admin: full access
    pgPolicy('institutes_admin_all', {
      for: 'all',
      to: roviqAdmin,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
);
