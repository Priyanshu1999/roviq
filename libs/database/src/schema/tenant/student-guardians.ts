import { boolean, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenantColumns } from '../common/columns';
import { tenantPolicies } from '../common/rls-policies';
import { profiles } from './profiles';

export const studentGuardians = pgTable(
  'student_guardians',
  {
    id: uuid().defaultRandom().primaryKey(),
    studentProfileId: uuid('student_profile_id')
      .notNull()
      .references(() => profiles.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    guardianProfileId: uuid('guardian_profile_id')
      .notNull()
      .references(() => profiles.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    relationship: text().notNull(),
    isPrimary: boolean('is_primary').default(false).notNull(),
    ...tenantColumns,
  },
  (table) => [
    uniqueIndex('student_guardians_student_profile_id_guardian_profile_id_key').using(
      'btree',
      table.studentProfileId.asc().nullsLast(),
      table.guardianProfileId.asc().nullsLast(),
    ),
    index('student_guardians_tenant_id_idx').using('btree', table.tenantId.asc().nullsLast()),
    ...tenantPolicies('student_guardians'),
  ],
);
