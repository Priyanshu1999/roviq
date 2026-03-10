import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../libs/backend/prisma-client/src/generated/prisma/client';
import { createAdminClient } from '../libs/backend/prisma-client/src/tenant-extension';
import {
  DEFAULT_ROLE_ABILITIES,
  DefaultRoles,
} from '../libs/shared/common-types/src/lib/common-types';

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL_ADMIN,
  });
  const prisma = createAdminClient(new PrismaClient({ adapter }));

  // Skip if already seeded (idempotency for Tilt auto-run)
  const existing = await prisma.organization.findUnique({
    where: { slug: 'demo-institute' },
  });
  if (existing) {
    console.log('Database already seeded, skipping.');
    process.exit(0);
  }

  console.log('Seeding database...');

  // 1. Create test organizations
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-institute' },
    create: {
      name: 'Demo Institute',
      slug: 'demo-institute',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      settings: {},
      isActive: true,
    },
    update: {},
  });
  console.log(`Organization: ${org.name} (${org.id})`);

  const org2 = await prisma.organization.upsert({
    where: { slug: 'second-institute' },
    create: {
      name: 'Second Institute',
      slug: 'second-institute',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      settings: {},
      isActive: true,
    },
    update: {},
  });
  console.log(`Organization: ${org2.name} (${org2.id})`);

  // 2. Seed default roles for both orgs
  const roles: Record<string, string> = {};
  const roles2: Record<string, string> = {};
  for (const [, roleName] of Object.entries(DefaultRoles)) {
    const abilities = DEFAULT_ROLE_ABILITIES[roleName];
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: org.id, name: roleName } },
      create: {
        tenantId: org.id,
        name: roleName,
        abilities: JSON.parse(JSON.stringify(abilities)),
        isDefault: true,
      },
      update: {},
    });
    roles[roleName] = role.id;

    const role2 = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: org2.id, name: roleName } },
      create: {
        tenantId: org2.id,
        name: roleName,
        abilities: JSON.parse(JSON.stringify(abilities)),
        isDefault: true,
      },
      update: {},
    });
    roles2[roleName] = role2.id;

    console.log(`  Role: ${role.name} (org1: ${role.id}, org2: ${role2.id})`);
  }

  // 3. Create test users (platform-level, no tenantId/roleId)
  const adminPassword = await hash('admin123');
  const teacherPassword = await hash('teacher123');
  const studentPassword = await hash('student123');

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    create: {
      username: 'admin',
      email: 'admin@demo-institute.com',
      passwordHash: adminPassword,
      isActive: true,
    },
    update: {},
  });

  const teacher = await prisma.user.upsert({
    where: { username: 'teacher1' },
    create: {
      username: 'teacher1',
      email: 'teacher1@demo-institute.com',
      passwordHash: teacherPassword,
      isActive: true,
    },
    update: {},
  });

  const student = await prisma.user.upsert({
    where: { username: 'student1' },
    create: {
      username: 'student1',
      email: 'student1@demo-institute.com',
      passwordHash: studentPassword,
      isActive: true,
    },
    update: {},
  });

  // 4. Create memberships (link users to orgs with roles)

  // admin — member of BOTH orgs (tests multi-org flow + org picker)
  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: admin.id, tenantId: org.id } },
    create: { userId: admin.id, tenantId: org.id, roleId: roles.institute_admin! },
    update: {},
  });
  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: admin.id, tenantId: org2.id } },
    create: { userId: admin.id, tenantId: org2.id, roleId: roles2.institute_admin! },
    update: {},
  });
  console.log(`  User: ${admin.username} / admin123 (institute_admin in both orgs)`);

  // teacher — single org (tests direct login)
  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: teacher.id, tenantId: org.id } },
    create: { userId: teacher.id, tenantId: org.id, roleId: roles.teacher! },
    update: {},
  });
  console.log(`  User: ${teacher.username} / teacher123 (teacher in Demo Institute)`);

  // student — single org (tests direct login)
  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: student.id, tenantId: org.id } },
    create: { userId: student.id, tenantId: org.id, roleId: roles.student! },
    update: {},
  });
  console.log(`  User: ${student.username} / student123 (student in Demo Institute)`);

  // 5. Create auth providers (password-based)
  for (const user of [admin, teacher, student]) {
    await prisma.authProvider.upsert({
      where: { provider_providerUserId: { provider: 'password', providerUserId: user.id } },
      create: { userId: user.id, provider: 'password', providerUserId: user.id },
      update: {},
    });
  }

  console.log('\nSeed complete!');
  console.log('\nTest login with:');
  console.log('  username: admin      password: admin123   (2 orgs — shows org picker)');
  console.log('  username: teacher1   password: teacher123 (1 org — direct login)');
  console.log('  username: student1   password: student123 (1 org — direct login)');

  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
