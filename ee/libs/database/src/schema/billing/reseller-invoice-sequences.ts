import { resellers, roviqAdmin, roviqReseller } from '@roviq/database';
import { sql } from 'drizzle-orm';
import { integer, pgPolicy, pgTable, uuid } from 'drizzle-orm/pg-core';

export const resellerInvoiceSequences = pgTable(
  'reseller_invoice_sequences',
  {
    resellerId: uuid('reseller_id')
      .primaryKey()
      .references(() => resellers.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    currentYear: integer('current_year').notNull(),
    lastSequence: integer('last_sequence').default(0).notNull(),
  },
  () => [
    // Reseller: full access on own sequence row
    pgPolicy('seq_reseller_all', {
      for: 'all',
      to: roviqReseller,
      using: sql`reseller_id = current_setting('app.current_reseller_id', true)::uuid`,
      withCheck: sql`reseller_id = current_setting('app.current_reseller_id', true)::uuid`,
    }),
    // Admin: break-glass full access
    pgPolicy('seq_admin_all', {
      for: 'all',
      to: roviqAdmin,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
);
