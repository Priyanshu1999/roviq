import { sql } from 'drizzle-orm';
import { boolean, date, foreignKey, index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { i18nText, tenantColumns } from '../common/columns';
import { holidayType } from '../common/enums';
import { tenantPolicies } from '../common/rls-policies';
import { institutes } from './institutes';

/**
 * Institute-published holidays and breaks.
 *
 * The attendance module consults this table at session-open time: if any row
 * spans the session date (startDate <= date <= endDate), session creation is
 * refused so no classes are accidentally recorded on a holiday.
 *
 * A single-day holiday sets `startDate = endDate`. Multi-day observances
 * (summer / winter breaks, week-long festivals) use the full range.
 */
export const holidays = pgTable(
  'holidays',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    /** Localised holiday name — e.g. { en: "Diwali", hi: "दिवाली" }. */
    name: i18nText('name').notNull(),
    /** Optional free-text notes (history, circular reference, etc.). */
    description: text('description'),
    /** Classification of the holiday — drives UI badges and downstream reports. */
    type: holidayType('type').notNull(),
    /** Inclusive start date (YYYY-MM-DD). */
    startDate: date('start_date').notNull(),
    /** Inclusive end date (YYYY-MM-DD). Single-day holidays set startDate = endDate. */
    endDate: date('end_date').notNull(),
    /** Free-form tags for filtering and theming (e.g. ["gazetted", "restricted"]). */
    tags: jsonb('tags').$type<string[]>().default([]).notNull(),
    /**
     * Whether the holiday is visible to non-admin users. `false` means
     * draft/admin-only — still blocks attendance sessions, not yet published
     * on guardian/student calendars.
     */
    isPublic: boolean('is_public').default(true).notNull(),
    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    index('holidays_tenant_id_idx').on(table.tenantId),
    index('holidays_start_date_idx').on(table.startDate),
    index('holidays_type_idx').on(table.type),
    // Typical lookup: "is `date` inside any holiday range?" — covered by
    // a composite (start_date, end_date) index.
    index('holidays_range_idx').on(table.startDate, table.endDate),
    ...tenantPolicies('holidays'),
  ],
);
