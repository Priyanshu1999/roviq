import { bigint, foreignKey, pgTable, primaryKey, uuid, varchar } from 'drizzle-orm/pg-core';
import { tenantPoliciesSimple } from '../common/rls-policies';
import { institutes } from '../tenant/institutes';

/**
 * Atomic per-tenant sequence generator.
 *
 * Eliminates the `COUNT(*) + 1` race condition by using a single UPDATE + RETURNING
 * via the `next_sequence_value()` PostgreSQL function. Each row tracks one named
 * counter scoped to a tenant.
 *
 * Sequence name patterns:
 * - `adm_no` — admission numbers
 * - `roll_no:{section_id}:{academic_year_id}` — roll numbers per section per year
 * - `tc_no:{academic_year_id}` — TC serial numbers per year
 * - `cert_no:{type}:{academic_year_id}` — certificate serial numbers
 * - `enquiry_no` — enquiry sequential numbers
 * - `employee_id` — staff employee IDs
 */
export const tenantSequences = pgTable(
  'tenant_sequences',
  {
    tenantId: uuid('tenant_id').notNull(),
    /** Identifies the counter, e.g. `adm_no`, `roll_no:{section}:{year}` */
    sequenceName: varchar('sequence_name', { length: 80 }).notNull(),
    /** Last issued value — incremented atomically by `next_sequence_value()` */
    currentValue: bigint('current_value', { mode: 'bigint' }).default(0n).notNull(),
    /** Optional prefix prepended in the formatted output, e.g. `N-` */
    prefix: varchar({ length: 20 }),
    /**
     * Format template for human-readable output.
     * Placeholders: `{prefix}` → prefix column, `{value:04d}` → zero-padded current_value.
     * Example: `{prefix}2025/{value:04d}` → `N-2025/0001`
     */
    formatTemplate: varchar('format_template', { length: 50 }),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.sequenceName] }),
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    ...tenantPoliciesSimple('tenant_sequences'),
  ],
).enableRLS();
