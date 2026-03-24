import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { DEFAULT_ROLE_ABILITIES, DefaultRoles } from '@roviq/common-types';
import type { DrizzleDB } from '@roviq/database';
import {
  authProviders,
  instituteNotificationConfigs,
  institutes,
  memberships,
  platformMemberships,
  resellerMemberships,
  resellers,
  roles,
  SYSTEM_USER_ID,
  users,
  withAdmin,
} from '@roviq/database';
import { plans } from '@roviq/ee-database';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { SEED_IDS } from './seed-ids';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATE || process.env.DATABASE_URL,
  });
  const db = drizzle({ client: pool }) as unknown as DrizzleDB;

  // Skip if already seeded (idempotency for Tilt auto-run)
  const existing = await withAdmin(db, async (tx) => {
    const rows = await tx
      .select()
      .from(institutes)
      .where(eq(institutes.slug, 'demo-institute'))
      .limit(1);
    return rows[0] ?? null;
  });

  if (existing) {
    console.log('Database already seeded, skipping.');
    await pool.end();
    process.exit(0);
  }

  console.log('Seeding database...');

  await withAdmin(db, async (tx) => {
    // 0. Seed system reseller "Roviq Direct"
    const [reseller] = await tx
      .insert(resellers)
      .values({
        id: SEED_IDS.RESELLER_DIRECT,
        name: 'Roviq Direct',
        slug: 'roviq-direct',
        isSystem: true,
        tier: 'full_management',
      })
      .onConflictDoUpdate({
        target: resellers.slug,
        set: { updatedAt: new Date() },
      })
      .returning();
    console.log(`Reseller: ${reseller.name} (${reseller.id})`);

    // 1. Create test institutes
    const [institute] = await tx
      .insert(institutes)
      .values({
        id: SEED_IDS.INSTITUTE_1,
        name: { en: 'Demo Institute' },
        slug: 'demo-institute',
        status: 'ACTIVE',
        setupStatus: 'COMPLETED',
        isDemo: false,
        departments: ['PRIMARY', 'UPPER_PRIMARY', 'SECONDARY', 'SENIOR_SECONDARY'],
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        settings: {},
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .onConflictDoUpdate({
        target: institutes.slug,
        set: { updatedAt: new Date() },
      })
      .returning();
    console.log(`Institute: ${(institute.name as Record<string, string>).en} (${institute.id})`);

    const [institute2] = await tx
      .insert(institutes)
      .values({
        id: SEED_IDS.INSTITUTE_2,
        name: { en: 'Second Institute' },
        slug: 'second-institute',
        status: 'ACTIVE',
        setupStatus: 'COMPLETED',
        isDemo: false,
        departments: ['PRIMARY', 'UPPER_PRIMARY', 'SECONDARY'],
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        settings: {},
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .onConflictDoUpdate({
        target: institutes.slug,
        set: { updatedAt: new Date() },
      })
      .returning();
    console.log(`Institute: ${(institute2.name as Record<string, string>).en} (${institute2.id})`);

    // Seed default notification configs for each institute
    const notificationTypes = ['FEE', 'ATTENDANCE', 'APPROVAL'];
    for (const createdInstitute of [institute, institute2]) {
      for (const type of notificationTypes) {
        await tx
          .insert(instituteNotificationConfigs)
          .values({
            tenantId: createdInstitute.id,
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
        `  Notification configs seeded for ${(createdInstitute.name as Record<string, string>).en}`,
      );
    }

    // 1.5 Seed system roles (platform + reseller only — institute roles are per-tenant)
    const systemRoles = [
      // Platform scope
      {
        id: SEED_IDS.ROLE_PLATFORM_ADMIN,
        scope: 'platform',
        name: 'platform_admin',
        abilities: [{ action: 'manage', subject: 'all' }],
      },
      {
        id: SEED_IDS.ROLE_PLATFORM_SUPPORT,
        scope: 'platform',
        name: 'platform_support',
        abilities: [
          { action: 'read', subject: 'all' },
          { action: 'impersonate', subject: 'User' },
        ],
      },
      // Reseller scope (linked to system reseller)
      {
        id: SEED_IDS.ROLE_RESELLER_FULL_ADMIN,
        scope: 'reseller',
        name: 'reseller_full_admin',
        resellerId: SEED_IDS.RESELLER_DIRECT,
        abilities: [
          // Institute: create (with approval), read, update info/status, suspend/reactivate, stats, impersonate
          // NOTE: No delete:Institute — only platform admin can delete (PRD §9.5)
          { action: 'create', subject: 'Institute' },
          { action: 'read', subject: 'Institute' },
          { action: 'update', subject: 'Institute' },
          { action: 'update_status', subject: 'Institute' },
          { action: 'view_statistics', subject: 'Institute' },
          { action: 'impersonate', subject: 'User' },
          // InstituteGroup: full CRUD
          { action: 'manage', subject: 'InstituteGroup' },
          // Read-only on academic structure (via reseller RLS)
          { action: 'read', subject: 'AcademicYear' },
          { action: 'read', subject: 'Standard' },
          { action: 'read', subject: 'Section' },
          { action: 'read', subject: 'Subject' },
          // Billing: full CRUD for reseller admin
          { action: 'manage', subject: 'SubscriptionPlan' },
          { action: 'manage', subject: 'Subscription' },
          { action: 'manage', subject: 'Invoice' },
          { action: 'manage', subject: 'Payment' },
          { action: 'manage', subject: 'PaymentGatewayConfig' },
          { action: 'read', subject: 'BillingDashboard' },
          // Platform entities
          { action: 'read', subject: 'AuditLog' },
        ],
      },
      {
        id: SEED_IDS.ROLE_RESELLER_SUPPORT_ADMIN,
        scope: 'reseller',
        name: 'reseller_support_admin',
        resellerId: SEED_IDS.RESELLER_DIRECT,
        abilities: [
          // Read-only on all + impersonate (read-only impersonation)
          { action: 'read', subject: 'all' },
          { action: 'impersonate', subject: 'User' },
        ],
      },
      {
        id: SEED_IDS.ROLE_RESELLER_VIEWER,
        scope: 'reseller',
        name: 'reseller_viewer',
        resellerId: SEED_IDS.RESELLER_DIRECT,
        abilities: [
          // Read-only access for reporting
          { action: 'read', subject: 'all' },
        ],
      },
    ];

    for (const sr of systemRoles) {
      await tx
        .insert(roles)
        .values({
          id: sr.id,
          scope: sr.scope,
          resellerId: sr.resellerId ?? null,
          name: { en: sr.name },
          abilities: JSON.parse(JSON.stringify(sr.abilities)),
          isSystem: true,
          isDefault: false,
          createdBy: SYSTEM_USER_ID,
          updatedBy: SYSTEM_USER_ID,
        })
        .onConflictDoUpdate({
          target: roles.id,
          set: { updatedAt: new Date() },
        });
      console.log(`  System role: ${sr.name} (${sr.scope})`);
    }

    // 2. Seed default roles for both institutes
    const roleIds: Record<string, string> = {};
    const roleIds2: Record<string, string> = {};
    for (const [, roleName] of Object.entries(DefaultRoles)) {
      const abilities = DEFAULT_ROLE_ABILITIES[roleName];

      const [role] = await tx
        .insert(roles)
        .values({
          tenantId: institute.id,
          scope: 'institute',
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
          tenantId: institute2.id,
          scope: 'institute',
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
        `  Role: ${(role.name as Record<string, string>).en} (institute1: ${role.id}, institute2: ${role2.id})`,
      );
    }

    // 3. Create test users
    const adminPassword = await hash('admin123');
    const resellerPassword = await hash('reseller123');
    const teacherPassword = await hash('teacher123');
    const studentPassword = await hash('student123');

    const [admin] = await tx
      .insert(users)
      .values({
        id: SEED_IDS.USER_ADMIN,
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
        id: SEED_IDS.USER_TEACHER,
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
        id: SEED_IDS.USER_STUDENT,
        username: 'student1',
        email: 'student1@demo-institute.com',
        passwordHash: studentPassword,
      })
      .onConflictDoUpdate({
        target: users.username,
        set: { updatedAt: new Date() },
      })
      .returning();

    const [resellerUser] = await tx
      .insert(users)
      .values({
        id: SEED_IDS.USER_RESELLER,
        username: 'reseller1',
        email: 'reseller1@roviq.com',
        passwordHash: resellerPassword,
      })
      .onConflictDoUpdate({
        target: users.username,
        set: { updatedAt: new Date() },
      })
      .returning();

    // 4. Create memberships (link users to institutes with roles)

    // admin — member of BOTH institutes (tests multi-institute flow + institute picker)
    await tx
      .insert(memberships)
      .values({
        userId: admin.id,
        tenantId: institute.id,
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
        tenantId: institute2.id,
        roleId: roleIds2.institute_admin,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .onConflictDoUpdate({
        target: [memberships.userId, memberships.tenantId],
        set: { updatedAt: new Date() },
      });
    await tx
      .insert(platformMemberships)
      .values({
        userId: admin.id,
        roleId: SEED_IDS.ROLE_PLATFORM_ADMIN,
      })
      .onConflictDoUpdate({
        target: platformMemberships.userId,
        set: { updatedAt: new Date() },
      });
    console.log(`  User: ${admin.username} / admin123 (institute_admin in both institutes)`);

    // reseller — linked to "Roviq Direct" reseller
    await tx
      .insert(resellerMemberships)
      .values({
        userId: resellerUser.id,
        resellerId: SEED_IDS.RESELLER_DIRECT,
        roleId: SEED_IDS.ROLE_RESELLER_FULL_ADMIN,
      })
      .onConflictDoUpdate({
        target: [resellerMemberships.userId, resellerMemberships.resellerId],
        set: { updatedAt: new Date() },
      });
    // Auth provider for reseller
    await tx
      .insert(authProviders)
      .values({
        userId: resellerUser.id,
        provider: 'password',
        providerUserId: resellerUser.id,
      })
      .onConflictDoUpdate({
        target: [authProviders.provider, authProviders.providerUserId],
        set: { updatedAt: new Date() },
      });
    console.log(`  User: ${resellerUser.username} / reseller123 (reseller_full_admin)`);

    // teacher — single institute (tests direct login)
    await tx
      .insert(memberships)
      .values({
        userId: teacher.id,
        tenantId: institute.id,
        roleId: roleIds.teacher,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .onConflictDoUpdate({
        target: [memberships.userId, memberships.tenantId],
        set: { updatedAt: new Date() },
      });
    console.log(`  User: ${teacher.username} / teacher123 (teacher in Demo Institute)`);

    // student — single institute (tests direct login)
    await tx
      .insert(memberships)
      .values({
        userId: student.id,
        tenantId: institute.id,
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

    // 6. Seed billing plans (EE)
    await seedBillingData(tx);
  });

  console.log('\nSeed complete!');
  console.log('\nTest login with:');
  console.log('  Admin portal   (admin.localhost):     admin / admin123');
  console.log('  Reseller portal (reseller.localhost):  reseller1 / reseller123');
  console.log('  Institute portal (localhost):');
  console.log('    admin / admin123       (multi-institute picker)');
  console.log('    teacher1 / teacher123  (single institute)');
  console.log('    student1 / student123  (single institute)');

  await pool.end();
  process.exit(0);
}

async function seedBillingData(tx: DrizzleDB) {
  const [freePlan] = await tx
    .insert(plans)
    .values({
      id: SEED_IDS.PLAN_FREE,
      resellerId: SEED_IDS.RESELLER_DIRECT,
      name: { en: 'Free' },
      description: { en: 'Free tier for evaluation' },
      code: 'FREE',
      interval: 'MONTHLY',
      amount: 0n,
      currency: 'INR',
      entitlements: {
        maxStudents: 10,
        maxStaff: 5,
        maxStorageMb: 512,
        auditLogRetentionDays: 90,
        features: [],
      },
      createdBy: SYSTEM_USER_ID,
      updatedBy: SYSTEM_USER_ID,
    })
    .onConflictDoUpdate({
      target: plans.id,
      set: { updatedAt: new Date() },
    })
    .returning();
  console.log(`  Plan: ${(freePlan.name as Record<string, string>).en} (${freePlan.id})`);

  const [proPlan] = await tx
    .insert(plans)
    .values({
      id: SEED_IDS.PLAN_PRO,
      resellerId: SEED_IDS.RESELLER_DIRECT,
      name: { en: 'Pro' },
      description: { en: 'Professional plan for growing institutes' },
      code: 'PRO',
      interval: 'MONTHLY',
      amount: 99900n,
      currency: 'INR',
      entitlements: {
        maxStudents: 500,
        maxStaff: 50,
        maxStorageMb: 5120,
        auditLogRetentionDays: 365,
        features: ['advanced_timetable', 'bulk_sms'],
      },
      createdBy: SYSTEM_USER_ID,
      updatedBy: SYSTEM_USER_ID,
    })
    .onConflictDoUpdate({
      target: plans.id,
      set: { updatedAt: new Date() },
    })
    .returning();
  console.log(`  Plan: ${(proPlan.name as Record<string, string>).en} (${proPlan.id})`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
