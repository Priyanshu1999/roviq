import { DEFAULT_ROLE_ABILITIES, DefaultRoles, NAV_SLUGS, type NavSlug } from '@roviq/common-types';
import { type DrizzleDB, roles, SYSTEM_USER_ID, withAdmin } from '@roviq/database';
import { and, eq } from 'drizzle-orm';

/**
 * Curated bottom-tab-bar slug lists (max 4) for the system-seeded institute roles.
 * Roles not in this map are seeded with an empty `primaryNavSlugs`; the frontend
 * falls back to the per-portal `defaultSlugs` for those.
 */
const DEFAULT_PRIMARY_NAV_SLUGS: Record<string, NavSlug[]> = {
  institute_admin: [
    NAV_SLUGS.dashboard,
    NAV_SLUGS.students,
    NAV_SLUGS.enquiries,
    NAV_SLUGS.academics,
  ],
  principal: [NAV_SLUGS.dashboard, NAV_SLUGS.students, NAV_SLUGS.academics, NAV_SLUGS.audit],
  vice_principal: [NAV_SLUGS.dashboard, NAV_SLUGS.students, NAV_SLUGS.academics, NAV_SLUGS.audit],
  academic_coordinator: [
    NAV_SLUGS.dashboard,
    NAV_SLUGS.academics,
    NAV_SLUGS.standards,
    NAV_SLUGS.timetable,
  ],
  admin_clerk: [
    NAV_SLUGS.dashboard,
    NAV_SLUGS.enquiries,
    NAV_SLUGS.students,
    NAV_SLUGS.applications,
  ],
  accountant: [
    NAV_SLUGS.dashboard,
    NAV_SLUGS.subscriptions,
    NAV_SLUGS.invoices,
    NAV_SLUGS.payments,
  ],
  class_teacher: [NAV_SLUGS.dashboard, NAV_SLUGS.timetable, NAV_SLUGS.students, NAV_SLUGS.groups],
  subject_teacher: [NAV_SLUGS.dashboard, NAV_SLUGS.timetable, NAV_SLUGS.students, NAV_SLUGS.groups],
  activity_teacher: [
    NAV_SLUGS.dashboard,
    NAV_SLUGS.groups,
    NAV_SLUGS.students,
    NAV_SLUGS.timetable,
  ],
};

export async function seedDefaultRoles(db: DrizzleDB, tenantId: string): Promise<void> {
  await withAdmin(db, async (tx) => {
    for (const [, roleName] of Object.entries(DefaultRoles)) {
      const abilities = DEFAULT_ROLE_ABILITIES[roleName];
      const primaryNavSlugs = DEFAULT_PRIMARY_NAV_SLUGS[roleName] ?? [];

      const [existing] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.tenantId, tenantId), eq(roles.name, { en: roleName })))
        .limit(1);

      if (existing) {
        await tx
          .update(roles)
          .set({ primaryNavSlugs, updatedBy: SYSTEM_USER_ID })
          .where(eq(roles.id, existing.id));
        continue;
      }

      await tx.insert(roles).values({
        tenantId,
        name: { en: roleName },
        abilities,
        primaryNavSlugs,
        isDefault: true,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      });
    }
  });
}
