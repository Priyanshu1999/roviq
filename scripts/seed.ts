import { hash } from '@node-rs/argon2';
import { DEFAULT_ROLE_ABILITIES, DefaultRoles } from '@roviq/common-types';
import type { DrizzleDB } from '@roviq/database';
import {
  authProviders,
  instituteNotificationConfigs,
  memberships,
  organizations,
  paymentGatewayConfigs,
  roles,
  SYSTEM_USER_ID,
  subscriptionPlans,
  users,
  withAdmin,
} from '@roviq/database';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATE || process.env.DATABASE_URL,
  });
  const db = drizzle({ client: pool }) as unknown as DrizzleDB;

  // Skip if already seeded (idempotency for Tilt auto-run)
  const existing = await withAdmin(db, async (tx) => {
    const rows = await tx
      .select()
      .from(organizations)
      .where(eq(organizations.slug, 'demo-institute'))
      .limit(1);
    return rows[0] ?? null;
  });

  if (existing) {
    await withAdmin(db, async (tx) => {
      await seedBillingData(tx, existing.id, (existing.name as Record<string, string>).en);
    });
    console.log('Database already seeded (billing data updated), skipping.');
    await pool.end();
    process.exit(0);
  }

  console.log('Seeding database...');

  await withAdmin(db, async (tx) => {
    // 1. Create test organizations
    const [org] = await tx
      .insert(organizations)
      .values({
        name: { en: 'Demo Institute' },
        slug: 'demo-institute',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        settings: {},
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .onConflictDoUpdate({
        target: organizations.slug,
        set: { updatedAt: new Date() },
      })
      .returning();
    console.log(`Organization: ${(org.name as Record<string, string>).en} (${org.id})`);

    const [org2] = await tx
      .insert(organizations)
      .values({
        name: { en: 'Second Institute' },
        slug: 'second-institute',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        settings: {},
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .onConflictDoUpdate({
        target: organizations.slug,
        set: { updatedAt: new Date() },
      })
      .returning();
    console.log(`Organization: ${(org2.name as Record<string, string>).en} (${org2.id})`);

    // Seed default notification configs for each organization
    const notificationTypes = ['FEE', 'ATTENDANCE', 'APPROVAL'];
    for (const createdOrg of [org, org2]) {
      for (const type of notificationTypes) {
        await tx
          .insert(instituteNotificationConfigs)
          .values({
            tenantId: createdOrg.id,
            notificationType: type,
            inAppEnabled: true,
            whatsappEnabled: true,
            emailEnabled: true,
            pushEnabled: false,
            digestEnabled: false,
            createdBy: SYSTEM_USER_ID,
            updatedBy: SYSTEM_USER_ID,
          })
          .onConflictDoUpdate({
            target: [
              instituteNotificationConfigs.tenantId,
              instituteNotificationConfigs.notificationType,
            ],
            set: { updatedAt: new Date() },
          });
      }
      console.log(
        `  Notification configs seeded for ${(createdOrg.name as Record<string, string>).en}`,
      );
    }

    // 2. Seed default roles for both orgs
    const roleIds: Record<string, string> = {};
    const roleIds2: Record<string, string> = {};
    for (const [, roleName] of Object.entries(DefaultRoles)) {
      const abilities = DEFAULT_ROLE_ABILITIES[roleName];

      const [role] = await tx
        .insert(roles)
        .values({
          tenantId: org.id,
          name: { en: roleName },
          abilities: JSON.parse(JSON.stringify(abilities)),
          isDefault: true,
          createdBy: SYSTEM_USER_ID,
          updatedBy: SYSTEM_USER_ID,
        })
        .onConflictDoUpdate({
          target: [roles.tenantId, roles.name],
          set: { updatedAt: new Date() },
        })
        .returning();
      roleIds[roleName] = role.id;

      const [role2] = await tx
        .insert(roles)
        .values({
          tenantId: org2.id,
          name: { en: roleName },
          abilities: JSON.parse(JSON.stringify(abilities)),
          isDefault: true,
          createdBy: SYSTEM_USER_ID,
          updatedBy: SYSTEM_USER_ID,
        })
        .onConflictDoUpdate({
          target: [roles.tenantId, roles.name],
          set: { updatedAt: new Date() },
        })
        .returning();
      roleIds2[roleName] = role2.id;

      console.log(
        `  Role: ${(role.name as Record<string, string>).en} (org1: ${role.id}, org2: ${role2.id})`,
      );
    }

    // 3. Create test users (platform-level, no tenantId/roleId)
    const adminPassword = await hash('admin123');
    const teacherPassword = await hash('teacher123');
    const studentPassword = await hash('student123');

    const [admin] = await tx
      .insert(users)
      .values({
        username: 'admin',
        email: 'admin@demo-institute.com',
        passwordHash: adminPassword,
      })
      .onConflictDoUpdate({
        target: users.username,
        set: { updatedAt: new Date() },
      })
      .returning();

    const [teacher] = await tx
      .insert(users)
      .values({
        username: 'teacher1',
        email: 'teacher1@demo-institute.com',
        passwordHash: teacherPassword,
      })
      .onConflictDoUpdate({
        target: users.username,
        set: { updatedAt: new Date() },
      })
      .returning();

    const [student] = await tx
      .insert(users)
      .values({
        username: 'student1',
        email: 'student1@demo-institute.com',
        passwordHash: studentPassword,
      })
      .onConflictDoUpdate({
        target: users.username,
        set: { updatedAt: new Date() },
      })
      .returning();

    // 4. Create memberships (link users to orgs with roles)

    // admin — member of BOTH orgs (tests multi-org flow + org picker)
    await tx
      .insert(memberships)
      .values({
        userId: admin.id,
        tenantId: org.id,
        roleId: roleIds.institute_admin,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .onConflictDoUpdate({
        target: [memberships.userId, memberships.tenantId],
        set: { updatedAt: new Date() },
      });
    await tx
      .insert(memberships)
      .values({
        userId: admin.id,
        tenantId: org2.id,
        roleId: roleIds2.institute_admin,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .onConflictDoUpdate({
        target: [memberships.userId, memberships.tenantId],
        set: { updatedAt: new Date() },
      });
    console.log(`  User: ${admin.username} / admin123 (institute_admin in both orgs)`);

    // teacher — single org (tests direct login)
    await tx
      .insert(memberships)
      .values({
        userId: teacher.id,
        tenantId: org.id,
        roleId: roleIds.teacher,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .onConflictDoUpdate({
        target: [memberships.userId, memberships.tenantId],
        set: { updatedAt: new Date() },
      });
    console.log(`  User: ${teacher.username} / teacher123 (teacher in Demo Institute)`);

    // student — single org (tests direct login)
    await tx
      .insert(memberships)
      .values({
        userId: student.id,
        tenantId: org.id,
        roleId: roleIds.student,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .onConflictDoUpdate({
        target: [memberships.userId, memberships.tenantId],
        set: { updatedAt: new Date() },
      });
    console.log(`  User: ${student.username} / student123 (student in Demo Institute)`);

    // 5. Create auth providers (password-based)
    for (const user of [admin, teacher, student]) {
      await tx
        .insert(authProviders)
        .values({
          userId: user.id,
          provider: 'password',
          providerUserId: user.id,
        })
        .onConflictDoUpdate({
          target: [authProviders.provider, authProviders.providerUserId],
          set: { updatedAt: new Date() },
        });
    }

    // 6. Seed billing data (plans + gateway config) — EE only
    if (process.env.ROVIQ_EE === 'true') {
      await seedBillingData(tx, org.id, (org.name as Record<string, string>).en);
    }
  });

  console.log('\nSeed complete!');
  console.log('\nTest login with:');
  console.log('  username: admin      password: admin123   (2 orgs — shows org picker)');
  console.log('  username: teacher1   password: teacher123 (1 org — direct login)');
  console.log('  username: student1   password: student123 (1 org — direct login)');

  await pool.end();
  process.exit(0);
}

/**
 * Seed billing plans and gateway config. Uses upserts so it's idempotent and
 * safe to call in both fresh-seed and already-seeded paths.
 */
async function seedBillingData(tx: DrizzleDB, orgId: string, orgName: string) {
  const [freePlan] = await tx
    .insert(subscriptionPlans)
    .values({
      id: '00000000-0000-4000-a000-000000000001',
      name: { en: 'Free' },
      description: { en: 'Free tier for evaluation' },
      amount: 0,
      currency: 'INR',
      billingInterval: 'MONTHLY',
      featureLimits: { maxUsers: 10, maxSections: 2 },
      createdBy: SYSTEM_USER_ID,
      updatedBy: SYSTEM_USER_ID,
    })
    .onConflictDoUpdate({
      target: subscriptionPlans.id,
      set: { updatedAt: new Date() },
    })
    .returning();
  console.log(`  Plan: ${(freePlan.name as Record<string, string>).en} (${freePlan.id})`);

  const [proPlan] = await tx
    .insert(subscriptionPlans)
    .values({
      id: '00000000-0000-4000-a000-000000000002',
      name: { en: 'Pro' },
      description: { en: 'Professional plan for growing institutes' },
      amount: 99900,
      currency: 'INR',
      billingInterval: 'MONTHLY',
      featureLimits: { maxUsers: 100, maxSections: 20 },
      createdBy: SYSTEM_USER_ID,
      updatedBy: SYSTEM_USER_ID,
    })
    .onConflictDoUpdate({
      target: subscriptionPlans.id,
      set: { updatedAt: new Date() },
    })
    .returning();
  console.log(`  Plan: ${(proPlan.name as Record<string, string>).en} (${proPlan.id})`);

  await tx
    .insert(paymentGatewayConfigs)
    .values({
      organizationId: orgId,
      provider: 'RAZORPAY',
      createdBy: SYSTEM_USER_ID,
      updatedBy: SYSTEM_USER_ID,
    })
    .onConflictDoUpdate({
      target: paymentGatewayConfigs.organizationId,
      set: { updatedAt: new Date() },
    });
  console.log(`  Gateway config: RAZORPAY for ${orgName}`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
