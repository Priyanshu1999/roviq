import { DEFAULT_ROLE_ABILITIES, DefaultRoles } from '@roviq/common-types';
import type { PrismaClient } from '@roviq/prisma-client';

export async function seedDefaultRoles(prisma: PrismaClient, tenantId: string): Promise<void> {
  for (const [, roleName] of Object.entries(DefaultRoles)) {
    const abilities = DEFAULT_ROLE_ABILITIES[roleName];

    await prisma.role.upsert({
      where: { tenantId_name: { tenantId, name: roleName } },
      create: {
        tenantId,
        name: roleName,
        abilities: abilities as object,
        isDefault: true,
      },
      update: {},
    });
  }
}
