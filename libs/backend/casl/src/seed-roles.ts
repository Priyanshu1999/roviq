import {
  DEFAULT_PRIMARY_NAV_SLUGS,
  DEFAULT_ROLE_ABILITIES,
  DefaultRoles,
} from '@roviq/common-types';
import { type DrizzleDB, mkAdminCtx, roles, SYSTEM_USER_ID, withAdmin } from '@roviq/database';
import { and, eq } from 'drizzle-orm';

export async function seedDefaultRoles(db: DrizzleDB, tenantId: string): Promise<void> {
  await withAdmin(db, mkAdminCtx(), async (tx) => {
    for (const [, roleName] of Object.entries(DefaultRoles)) {
      const abilities = DEFAULT_ROLE_ABILITIES[roleName];
      // Spread to a mutable array — Drizzle's jsonb<string[]> doesn't accept
      // the shared `readonly NavSlug[]` directly.
      const primaryNavSlugs = [...(DEFAULT_PRIMARY_NAV_SLUGS[roleName] ?? [])];

      const [existing] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.tenantId, tenantId), eq(roles.name, { en: roleName })))
        .limit(1);

      if (existing) {
        // CR-002: refresh BOTH `abilities` and `primaryNavSlugs` so an
        // existing tenant doesn't drift behind code-only ability updates.
        // The seed is the source of truth for default-role abilities; tenant
        // operators who want to diverge can switch the role to non-default
        // and edit independently.
        await tx
          .update(roles)
          .set({ abilities, primaryNavSlugs, updatedBy: SYSTEM_USER_ID })
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
