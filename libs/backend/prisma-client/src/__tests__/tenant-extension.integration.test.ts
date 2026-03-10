import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../generated/prisma/client';
import { createAdminClient, createTenantClient, tenantContext } from '../tenant-extension';
import { tenantTransaction } from '../tenant-transaction';

config({ path: resolve(__dirname, '../../../../../.env') });

/* ------------------------------------------------------------------ */
/*  Deterministic fixture IDs                                         */
/* ------------------------------------------------------------------ */
const TENANT_A = '00000000-0000-4000-a000-000000000001';
const TENANT_B = '00000000-0000-4000-a000-000000000002';
const USER_A = '00000000-0000-4000-b000-000000000001';
const USER_B = '00000000-0000-4000-b000-000000000002';
const ROLE_A = '00000000-0000-4000-c000-000000000001';
const ROLE_B = '00000000-0000-4000-c000-000000000002';
const MEMBER_A = '00000000-0000-4000-d000-000000000001';
const MEMBER_B = '00000000-0000-4000-d000-000000000002';
const PROFILE_A_STUDENT = '00000000-0000-4000-e000-000000000001';
const PROFILE_B_STUDENT = '00000000-0000-4000-e000-000000000002';
const PROFILE_A_GUARDIAN = '00000000-0000-4000-e000-000000000003';
const GUARDIAN_LINK = '00000000-0000-4000-f000-000000000001';
const TOKEN_A = '00000000-0000-4000-a100-000000000001';
const TOKEN_B = '00000000-0000-4000-a100-000000000002';
const NONEXISTENT_TENANT = '00000000-0000-4000-a000-ffffffffffff';

let basePrisma: PrismaClient;
let tenantPrisma: ReturnType<typeof createTenantClient>;
let adminPrisma: ReturnType<typeof createAdminClient>;

/* ------------------------------------------------------------------ */
/*  Seed & cleanup helpers                                            */
/* ------------------------------------------------------------------ */
async function cleanup() {
  // Reverse FK order — delete by tenantId to catch any orphaned test data
  // from previous failed runs. Admin client bypasses RLS.
  const tenantFilter = { where: { tenantId: { in: [TENANT_A, TENANT_B] } } };
  await adminPrisma.studentGuardian.deleteMany(tenantFilter);
  await adminPrisma.refreshToken.deleteMany(tenantFilter);
  await adminPrisma.profile.deleteMany(tenantFilter);
  await adminPrisma.membership.deleteMany(tenantFilter);
  await adminPrisma.role.deleteMany(tenantFilter);
  // Platform tables — no RLS
  await basePrisma.user.deleteMany({
    where: { id: { in: [USER_A, USER_B] } },
  });
  await basePrisma.organization.deleteMany({
    where: { id: { in: [TENANT_A, TENANT_B] } },
  });
}

async function seed() {
  // --- Platform tables (no RLS) ---
  await basePrisma.organization.createMany({
    data: [
      { id: TENANT_A, name: 'Institute A', slug: 'test-inst-a' },
      { id: TENANT_B, name: 'Institute B', slug: 'test-inst-b' },
    ],
  });

  await basePrisma.user.createMany({
    data: [
      {
        id: USER_A,
        username: 'test-user-a',
        email: 'a@test.local',
        passwordHash: 'hash-a',
      },
      {
        id: USER_B,
        username: 'test-user-b',
        email: 'b@test.local',
        passwordHash: 'hash-b',
      },
    ],
  });

  // --- Tenant-scoped tables (via admin client to bypass RLS) ---
  await adminPrisma.role.createMany({
    data: [
      { id: ROLE_A, tenantId: TENANT_A, name: 'teacher' },
      { id: ROLE_B, tenantId: TENANT_B, name: 'teacher' },
    ],
  });

  await adminPrisma.membership.createMany({
    data: [
      { id: MEMBER_A, userId: USER_A, tenantId: TENANT_A, roleId: ROLE_A },
      { id: MEMBER_B, userId: USER_B, tenantId: TENANT_B, roleId: ROLE_B },
    ],
  });

  await adminPrisma.profile.createMany({
    data: [
      { id: PROFILE_A_STUDENT, membershipId: MEMBER_A, tenantId: TENANT_A, type: 'student' },
      { id: PROFILE_A_GUARDIAN, membershipId: MEMBER_A, tenantId: TENANT_A, type: 'guardian' },
      { id: PROFILE_B_STUDENT, membershipId: MEMBER_B, tenantId: TENANT_B, type: 'student' },
    ],
  });

  await adminPrisma.studentGuardian.create({
    data: {
      id: GUARDIAN_LINK,
      studentProfileId: PROFILE_A_STUDENT,
      guardianProfileId: PROFILE_A_GUARDIAN,
      tenantId: TENANT_A,
      relationship: 'parent',
      isPrimary: true,
    },
  });

  const futureDate = new Date(Date.now() + 86_400_000);
  await adminPrisma.refreshToken.createMany({
    data: [
      {
        id: TOKEN_A,
        tenantId: TENANT_A,
        userId: USER_A,
        membershipId: MEMBER_A,
        tokenHash: 'test-hash-a',
        expiresAt: futureDate,
      },
      {
        id: TOKEN_B,
        tenantId: TENANT_B,
        userId: USER_B,
        membershipId: MEMBER_B,
        tokenHash: 'test-hash-b',
        expiresAt: futureDate,
      },
    ],
  });
}

/* ------------------------------------------------------------------ */
/*  Suite                                                             */
/* ------------------------------------------------------------------ */
describe('Tenant Extension — Integration', () => {
  beforeAll(async () => {
    const connectionString = process.env['DATABASE_URL'];
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for integration tests');
    }

    const adapter = new PrismaPg({ connectionString });
    basePrisma = new PrismaClient({ adapter });
    tenantPrisma = createTenantClient(basePrisma);
    adminPrisma = createAdminClient(basePrisma);

    await cleanup();
    await seed();
  }, 30_000);

  afterAll(async () => {
    await cleanup();
    await basePrisma.$disconnect();
  }, 30_000);

  /* ================================================================ */
  /*  1. Core Tenant Isolation                                        */
  /* ================================================================ */
  describe('Core Tenant Isolation', () => {
    it('tenant A context returns only tenant A rows across all models', async () => {
      await tenantContext.run({ tenantId: TENANT_A }, async () => {
        const roles = await tenantPrisma.role.findMany({
          where: { id: { in: [ROLE_A, ROLE_B] } },
        });
        const memberships = await tenantPrisma.membership.findMany({
          where: { id: { in: [MEMBER_A, MEMBER_B] } },
        });
        const profiles = await tenantPrisma.profile.findMany({
          where: { id: { in: [PROFILE_A_STUDENT, PROFILE_A_GUARDIAN, PROFILE_B_STUDENT] } },
        });
        const tokens = await tenantPrisma.refreshToken.findMany({
          where: { id: { in: [TOKEN_A, TOKEN_B] } },
        });
        const guardians = await tenantPrisma.studentGuardian.findMany({
          where: { id: { in: [GUARDIAN_LINK] } },
        });

        expect(roles).toHaveLength(1);
        expect(roles[0].id).toBe(ROLE_A);
        expect(memberships).toHaveLength(1);
        expect(memberships[0].id).toBe(MEMBER_A);
        expect(profiles).toHaveLength(2); // student + guardian
        expect(tokens).toHaveLength(1);
        expect(tokens[0].id).toBe(TOKEN_A);
        expect(guardians).toHaveLength(1);
        expect(guardians[0].id).toBe(GUARDIAN_LINK);
      });
    });

    it('tenant B context returns zero tenant A rows', async () => {
      await tenantContext.run({ tenantId: TENANT_B }, async () => {
        const roles = await tenantPrisma.role.findMany({
          where: { id: { in: [ROLE_A, ROLE_B] } },
        });
        const memberships = await tenantPrisma.membership.findMany({
          where: { id: { in: [MEMBER_A, MEMBER_B] } },
        });
        const profiles = await tenantPrisma.profile.findMany({
          where: { id: { in: [PROFILE_A_STUDENT, PROFILE_A_GUARDIAN, PROFILE_B_STUDENT] } },
        });
        const tokens = await tenantPrisma.refreshToken.findMany({
          where: { id: { in: [TOKEN_A, TOKEN_B] } },
        });
        const guardians = await tenantPrisma.studentGuardian.findMany({
          where: { id: { in: [GUARDIAN_LINK] } },
        });

        expect(roles).toHaveLength(1);
        expect(roles[0].id).toBe(ROLE_B);
        expect(memberships).toHaveLength(1);
        expect(memberships[0].id).toBe(MEMBER_B);
        expect(profiles).toHaveLength(1);
        expect(profiles[0].id).toBe(PROFILE_B_STUDENT);
        expect(tokens).toHaveLength(1);
        expect(tokens[0].id).toBe(TOKEN_B);
        expect(guardians).toHaveLength(0);
      });
    });

    it('record created in tenant A is invisible from tenant B', async () => {
      const tmpRoleId = '00000000-0000-4000-c000-000000000099';

      try {
        await tenantContext.run({ tenantId: TENANT_A }, async () => {
          await tenantPrisma.role.create({
            data: { id: tmpRoleId, tenantId: TENANT_A, name: 'temp-role' },
          });
        });

        await tenantContext.run({ tenantId: TENANT_B }, async () => {
          const found = await tenantPrisma.role.findMany({ where: { name: 'temp-role' } });
          expect(found).toHaveLength(0);
        });
      } finally {
        await adminPrisma.role.deleteMany({ where: { id: tmpRoleId } });
      }
    });

    it('update in tenant A does not affect tenant B records', async () => {
      await tenantContext.run({ tenantId: TENANT_A }, async () => {
        await tenantPrisma.role.update({
          where: { tenantId_name: { tenantId: TENANT_A, name: 'teacher' } },
          data: { abilities: ['manage_students'] },
        });
      });

      await tenantContext.run({ tenantId: TENANT_B }, async () => {
        const roleB = await tenantPrisma.role.findFirst({ where: { id: ROLE_B } });
        expect(roleB?.abilities).toEqual([]);
      });

      // Restore original
      await tenantContext.run({ tenantId: TENANT_A }, async () => {
        await tenantPrisma.role.update({
          where: { tenantId_name: { tenantId: TENANT_A, name: 'teacher' } },
          data: { abilities: [] },
        });
      });
    });

    it('delete in tenant A does not touch tenant B data', async () => {
      const tmpRoleId = '00000000-0000-4000-c000-000000000098';

      await tenantContext.run({ tenantId: TENANT_A }, async () => {
        await tenantPrisma.role.create({
          data: { id: tmpRoleId, tenantId: TENANT_A, name: 'to-delete' },
        });
        await tenantPrisma.role.delete({
          where: { tenantId_name: { tenantId: TENANT_A, name: 'to-delete' } },
        });
      });

      await tenantContext.run({ tenantId: TENANT_B }, async () => {
        const roles = await tenantPrisma.role.findMany({
          where: { id: { in: [ROLE_A, ROLE_B] } },
        });
        expect(roles).toHaveLength(1);
        expect(roles[0].id).toBe(ROLE_B);
      });
    });
  });

  /* ================================================================ */
  /*  2. Context Enforcement                                          */
  /* ================================================================ */
  describe('Context Enforcement', () => {
    it('throws when tenant context is not set', async () => {
      await expect(tenantPrisma.role.findMany()).rejects.toThrow('Tenant context is not set');
    });

    it('throws on invalid tenant ID format', async () => {
      await tenantContext.run({ tenantId: 'not-a-uuid' }, async () => {
        await expect(tenantPrisma.role.findMany()).rejects.toThrow('Invalid tenant ID format');
      });
    });

    it('throws on empty string tenant ID', async () => {
      await tenantContext.run({ tenantId: '' }, async () => {
        await expect(tenantPrisma.role.findMany()).rejects.toThrow('Tenant context is not set');
      });
    });

    it('throws on SQL injection attempt in tenant ID', async () => {
      const injection = "'; DROP TABLE roles; --";
      await tenantContext.run({ tenantId: injection }, async () => {
        await expect(tenantPrisma.role.findMany()).rejects.toThrow('Invalid tenant ID format');
      });
    });
  });

  /* ================================================================ */
  /*  3. Concurrent Request Isolation                                 */
  /* ================================================================ */
  describe('Concurrent Request Isolation', () => {
    it('simultaneous tenantContext.run() calls return correct isolated data', async () => {
      const filter = { where: { id: { in: [ROLE_A, ROLE_B] } } };
      const [rolesA, rolesB] = await Promise.all([
        tenantContext.run({ tenantId: TENANT_A }, async () => {
          return tenantPrisma.role.findMany(filter);
        }),
        tenantContext.run({ tenantId: TENANT_B }, async () => {
          return tenantPrisma.role.findMany(filter);
        }),
      ]);

      expect(rolesA).toHaveLength(1);
      expect(rolesA[0].id).toBe(ROLE_A);
      expect(rolesB).toHaveLength(1);
      expect(rolesB[0].id).toBe(ROLE_B);
    });

    it('rapid context switching does not leak state', async () => {
      const results: string[] = [];

      for (let i = 0; i < 20; i++) {
        const tid = i % 2 === 0 ? TENANT_A : TENANT_B;
        const expectedId = i % 2 === 0 ? ROLE_A : ROLE_B;

        await tenantContext.run({ tenantId: tid }, async () => {
          const roles = await tenantPrisma.role.findMany({
            where: { id: { in: [ROLE_A, ROLE_B] } },
          });
          expect(roles).toHaveLength(1);
          results.push(roles[0].id);
          expect(roles[0].id).toBe(expectedId);
        });
      }

      expect(results).toHaveLength(20);
    });

    it('nested tenantContext.run() uses the innermost context', async () => {
      const filter = { where: { id: { in: [ROLE_A, ROLE_B] } } };
      await tenantContext.run({ tenantId: TENANT_A }, async () => {
        const outerRoles = await tenantPrisma.role.findMany(filter);
        expect(outerRoles).toHaveLength(1);
        expect(outerRoles[0].id).toBe(ROLE_A);

        await tenantContext.run({ tenantId: TENANT_B }, async () => {
          const innerRoles = await tenantPrisma.role.findMany(filter);
          expect(innerRoles).toHaveLength(1);
          expect(innerRoles[0].id).toBe(ROLE_B);
        });

        // Outer context restored
        const restored = await tenantPrisma.role.findMany(filter);
        expect(restored).toHaveLength(1);
        expect(restored[0].id).toBe(ROLE_A);
      });
    });
  });

  /* ================================================================ */
  /*  4. Transaction Wrapper (tenantTransaction)                      */
  /* ================================================================ */
  describe('tenantTransaction', () => {
    it('sets correct tenant context inside the transaction', async () => {
      await tenantContext.run({ tenantId: TENANT_A }, async () => {
        const roles = await tenantTransaction(basePrisma, async (tx) => {
          return tx.role.findMany();
        });
        expect(roles).toHaveLength(1);
        expect(roles[0].id).toBe(ROLE_A);
      });
    });

    it('rollback does not leak partially written data to other tenants', async () => {
      const tmpId = '00000000-0000-4000-c000-000000000097';

      await tenantContext.run({ tenantId: TENANT_A }, async () => {
        await expect(
          tenantTransaction(basePrisma, async (tx) => {
            await tx.role.create({
              data: { id: tmpId, tenantId: TENANT_A, name: 'rollback-role' },
            });
            throw new Error('deliberate rollback');
          }),
        ).rejects.toThrow('deliberate rollback');
      });

      // Verify the role doesn't exist in any tenant
      const leaked = await adminPrisma.role.findMany({ where: { id: tmpId } });
      expect(leaked).toHaveLength(0);
    });

    it('multiple queries inside a single transaction see the same tenant scope', async () => {
      await tenantContext.run({ tenantId: TENANT_A }, async () => {
        await tenantTransaction(basePrisma, async (tx) => {
          const roles = await tx.role.findMany();
          const memberships = await tx.membership.findMany();
          const profiles = await tx.profile.findMany();

          expect(roles).toHaveLength(1);
          expect(roles[0].tenantId).toBe(TENANT_A);
          expect(memberships).toHaveLength(1);
          expect(memberships[0].tenantId).toBe(TENANT_A);
          expect(profiles).toHaveLength(2);
          for (const p of profiles) {
            expect(p.tenantId).toBe(TENANT_A);
          }
        });
      });
    });

    it('transaction with error rolls back completely — no partial writes', async () => {
      const tmpRole = '00000000-0000-4000-c000-000000000096';
      const tmpMember = '00000000-0000-4000-d000-000000000096';

      await tenantContext.run({ tenantId: TENANT_A }, async () => {
        await expect(
          tenantTransaction(basePrisma, async (tx) => {
            await tx.role.create({
              data: { id: tmpRole, tenantId: TENANT_A, name: 'partial-role' },
            });
            // This will fail — duplicate user+tenant membership
            await tx.membership.create({
              data: {
                id: tmpMember,
                userId: USER_A,
                tenantId: TENANT_A,
                roleId: tmpRole,
              },
            });
          }),
        ).rejects.toThrow(); // unique constraint violation
      });

      // Neither the role nor the membership should exist
      const roles = await adminPrisma.role.findMany({ where: { id: tmpRole } });
      expect(roles).toHaveLength(0);
    });

    it('concurrent transactions for different tenants do not interfere', async () => {
      const tmpA = '00000000-0000-4000-c000-000000000094';
      const tmpB = '00000000-0000-4000-c000-000000000095';

      try {
        await Promise.all([
          tenantContext.run({ tenantId: TENANT_A }, () =>
            tenantTransaction(basePrisma, async (tx) => {
              await tx.role.create({
                data: { id: tmpA, tenantId: TENANT_A, name: 'concurrent-a' },
              });
              const roles = await tx.role.findMany();
              // Only tenant A roles visible
              for (const r of roles) {
                expect(r.tenantId).toBe(TENANT_A);
              }
            }),
          ),
          tenantContext.run({ tenantId: TENANT_B }, () =>
            tenantTransaction(basePrisma, async (tx) => {
              await tx.role.create({
                data: { id: tmpB, tenantId: TENANT_B, name: 'concurrent-b' },
              });
              const roles = await tx.role.findMany();
              for (const r of roles) {
                expect(r.tenantId).toBe(TENANT_B);
              }
            }),
          ),
        ]);
      } finally {
        await adminPrisma.role.deleteMany({ where: { id: { in: [tmpA, tmpB] } } });
      }
    });
  });

  /* ================================================================ */
  /*  5. Admin Client (createAdminClient)                             */
  /* ================================================================ */
  describe('Admin Client', () => {
    it('sees rows across all tenants', async () => {
      const roles = await adminPrisma.role.findMany({
        where: { id: { in: [ROLE_A, ROLE_B] } },
      });
      expect(roles).toHaveLength(2);

      const tenantIds = roles.map((r) => r.tenantId).sort();
      expect(tenantIds).toEqual([TENANT_A, TENANT_B].sort());
    });

    it('can read and write to any tenant data', async () => {
      const tmpId = '00000000-0000-4000-c000-000000000093';

      try {
        await adminPrisma.role.create({
          data: { id: tmpId, tenantId: TENANT_B, name: 'admin-created' },
        });

        const found = await adminPrisma.role.findFirst({ where: { id: tmpId } });
        expect(found).not.toBeNull();
        expect(found!.tenantId).toBe(TENANT_B);
      } finally {
        await adminPrisma.role.deleteMany({ where: { id: tmpId } });
      }
    });

    it('works on platform-level tables (users, organizations)', async () => {
      const users = await adminPrisma.user.findMany({
        where: { id: { in: [USER_A, USER_B] } },
      });
      expect(users).toHaveLength(2);

      const orgs = await adminPrisma.organization.findMany({
        where: { id: { in: [TENANT_A, TENANT_B] } },
      });
      expect(orgs).toHaveLength(2);
    });

    it('is_platform_admin does not leak to subsequent connections', async () => {
      // Run an admin query to set the session var
      await adminPrisma.role.findMany();

      // Immediately check via base client raw query — the var should NOT persist
      const result = await basePrisma.$queryRawUnsafe<{ val: string | null }[]>(
        "SELECT current_setting('app.is_platform_admin', true) AS val",
      );
      // Should be null or empty — not 'true'
      expect(result[0].val).not.toBe('true');
    });
  });

  /* ================================================================ */
  /*  6. Connection Pool Safety                                       */
  /* ================================================================ */
  describe('Connection Pool Safety', () => {
    it('SET LOCAL does not persist across different queries', async () => {
      // Run a tenant-scoped query (sets app.current_tenant_id locally)
      await tenantContext.run({ tenantId: TENANT_A }, async () => {
        await tenantPrisma.role.findMany();
      });

      // Check via raw query — the setting should not persist
      const result = await basePrisma.$queryRawUnsafe<{ val: string | null }[]>(
        "SELECT current_setting('app.current_tenant_id', true) AS val",
      );
      // null or empty string means the config did not leak
      const val = result[0].val;
      expect(!val || val !== TENANT_A).toBe(true);
    });

    it('admin set_config does not persist to subsequent queries', async () => {
      await adminPrisma.role.findMany();

      const result = await basePrisma.$queryRawUnsafe<{ val: string | null }[]>(
        "SELECT current_setting('app.is_platform_admin', true) AS val",
      );
      expect(result[0].val).not.toBe('true');
    });
  });

  /* ================================================================ */
  /*  7. Platform-Level Tables (No RLS)                               */
  /* ================================================================ */
  describe('Platform-Level Tables (No RLS)', () => {
    it('users table is accessible without tenant context', async () => {
      const users = await basePrisma.user.findMany({
        where: { id: { in: [USER_A, USER_B] } },
      });
      expect(users).toHaveLength(2);
    });

    it('organizations table is accessible without tenant context', async () => {
      const orgs = await basePrisma.organization.findMany({
        where: { id: { in: [TENANT_A, TENANT_B] } },
      });
      expect(orgs).toHaveLength(2);
    });

    it('platform queries do not require tenantContext.run()', async () => {
      // No tenantContext.run() wrapper — should work fine
      const user = await basePrisma.user.findFirst({ where: { id: USER_A } });
      expect(user).not.toBeNull();
      expect(user!.username).toBe('test-user-a');
    });
  });

  /* ================================================================ */
  /*  8. Edge Cases                                                   */
  /* ================================================================ */
  describe('Edge Cases', () => {
    it('valid UUID with no matching organization returns empty results', async () => {
      await tenantContext.run({ tenantId: NONEXISTENT_TENANT }, async () => {
        const roles = await tenantPrisma.role.findMany();
        expect(roles).toHaveLength(0);
      });
    });

    it('long running query maintains correct tenant context throughout', async () => {
      await tenantContext.run({ tenantId: TENANT_A }, async () => {
        const roles = await tenantTransaction(basePrisma, async (tx) => {
          // Simulate a long-running operation within the tenant transaction
          await tx.$executeRawUnsafe('SELECT pg_sleep(0.5)');
          return tx.role.findMany({ where: { id: ROLE_A } });
        });
        expect(roles).toHaveLength(1);
        expect(roles[0].id).toBe(ROLE_A);
      });
    }, 10_000);

    it('findFirst respects RLS', async () => {
      await tenantContext.run({ tenantId: TENANT_A }, async () => {
        const role = await tenantPrisma.role.findFirst();
        expect(role).not.toBeNull();
        expect(role!.tenantId).toBe(TENANT_A);
      });
    });

    it('count respects RLS', async () => {
      await tenantContext.run({ tenantId: TENANT_A }, async () => {
        const count = await tenantPrisma.role.count({ where: { id: ROLE_A } });
        expect(count).toBe(1);
      });

      // Cross-tenant: tenant B cannot count tenant A's role
      await tenantContext.run({ tenantId: TENANT_B }, async () => {
        const count = await tenantPrisma.role.count({ where: { id: ROLE_A } });
        expect(count).toBe(0);
      });
    });

    it('aggregate respects RLS', async () => {
      await tenantContext.run({ tenantId: TENANT_A }, async () => {
        const result = await tenantPrisma.profile.aggregate({
          _count: true,
          where: { id: { in: [PROFILE_A_STUDENT, PROFILE_A_GUARDIAN] } },
        });
        expect(result._count).toBe(2); // student + guardian in tenant A
      });
    });

    it('groupBy respects RLS', async () => {
      await tenantContext.run({ tenantId: TENANT_A }, async () => {
        const groups = await tenantPrisma.profile.groupBy({
          by: ['type'],
          _count: true,
        });
        const types = groups.map((g) => g.type).sort();
        expect(types).toEqual(['guardian', 'student']);
      });
    });

    it('raw queries inside tenantTransaction respect RLS', async () => {
      await tenantContext.run({ tenantId: TENANT_A }, async () => {
        const rows = await tenantTransaction(basePrisma, async (tx) => {
          return tx.$queryRawUnsafe<{ id: string; tenant_id: string }[]>(
            'SELECT id, tenant_id FROM roles',
          );
        });

        expect(rows.length).toBeGreaterThanOrEqual(1);
        for (const row of rows) {
          expect(row.tenant_id).toBe(TENANT_A);
        }
      });
    });

    it('upsert respects tenant isolation', async () => {
      const tmpId = '00000000-0000-4000-c000-000000000092';

      try {
        // Upsert in tenant A — should create since this name doesn't exist in A
        await tenantContext.run({ tenantId: TENANT_A }, async () => {
          const result = await tenantPrisma.role.upsert({
            where: { tenantId_name: { tenantId: TENANT_A, name: 'upsert-test' } },
            create: { id: tmpId, tenantId: TENANT_A, name: 'upsert-test' },
            update: { abilities: ['updated'] },
          });
          expect(result.id).toBe(tmpId);
        });

        // Verify tenant B is untouched
        await tenantContext.run({ tenantId: TENANT_B }, async () => {
          const found = await tenantPrisma.role.findMany({ where: { name: 'upsert-test' } });
          expect(found).toHaveLength(0);
        });
      } finally {
        await adminPrisma.role.deleteMany({ where: { id: tmpId } });
      }
    });
  });
});
