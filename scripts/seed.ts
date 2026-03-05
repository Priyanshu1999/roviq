import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'argon2';
import { DEFAULT_ROLE_ABILITIES, DefaultRoles } from '../libs/common-types/src/lib/common-types';
import { PrismaClient } from '../libs/prisma-client/src/generated/prisma/client';

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL_ADMIN,
  });
  const prisma = new PrismaClient({ adapter });

  console.log('Seeding database...');

  // 1. Create test organization
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

  // 2. Seed default roles
  const roles: Record<string, string> = {};
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
    console.log(`  Role: ${role.name} (${role.id})`);
  }

  // 3. Create test users
  const adminPassword = await hash('admin123', { type: 2 }); // argon2id
  const teacherPassword = await hash('teacher123', { type: 2 });
  const studentPassword = await hash('student123', { type: 2 });

  const admin = await prisma.user.upsert({
    where: { tenantId_username: { tenantId: org.id, username: 'admin' } },
    create: {
      tenantId: org.id,
      roleId: roles.institute_admin!,
      username: 'admin',
      email: 'admin@demo-institute.com',
      passwordHash: adminPassword,
      isActive: true,
    },
    update: {},
  });
  console.log(`  User: ${admin.username} / admin123 (role: institute_admin)`);

  const teacher = await prisma.user.upsert({
    where: { tenantId_username: { tenantId: org.id, username: 'teacher1' } },
    create: {
      tenantId: org.id,
      roleId: roles.teacher!,
      username: 'teacher1',
      email: 'teacher1@demo-institute.com',
      passwordHash: teacherPassword,
      isActive: true,
    },
    update: {},
  });
  console.log(`  User: ${teacher.username} / teacher123 (role: teacher)`);

  const student = await prisma.user.upsert({
    where: { tenantId_username: { tenantId: org.id, username: 'student1' } },
    create: {
      tenantId: org.id,
      roleId: roles.student!,
      username: 'student1',
      email: 'student1@demo-institute.com',
      passwordHash: studentPassword,
      isActive: true,
    },
    update: {},
  });
  console.log(`  User: ${student.username} / student123 (role: student)`);

  console.log('\nSeed complete!');
  console.log(`\nTest login with:`);
  console.log(`  tenantId: ${org.id}`);
  console.log(`  username: admin    password: admin123`);
  console.log(`  username: teacher1 password: teacher123`);
  console.log(`  username: student1 password: student123`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
