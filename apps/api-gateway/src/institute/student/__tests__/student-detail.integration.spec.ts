/**
 * ROV-167 — Integration tests for student detail operations.
 *
 * Covers getStudent, updateStudent optimistic concurrency,
 * transitionStudentStatus (valid + invalid), listStudentAcademics,
 * listStudentDocuments, and listStudentGuardians against a fresh
 * test institute with a minimal student fixture.
 */
import { randomUUID } from 'node:crypto';
import {
  academicYears,
  type DrizzleDB,
  memberships,
  roles,
  SYSTEM_USER_ID,
  sections,
  standards,
  studentAcademics,
  studentProfiles,
  userProfiles,
  users,
  withAdmin,
} from '@roviq/database';
import {
  createInstituteToken,
  createIntegrationApp,
  createTestInstitute,
  gqlRequest,
  type IntegrationAppResult,
} from '@roviq/testing/integration';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../app/app.module';

interface StudentFixture {
  studentProfileId: string;
  admissionNumber: string;
  academicYearId: string;
}

/**
 * Insert the minimum viable rows to satisfy:
 *   student_profiles → users, memberships, user_profiles
 *   student_academics → student_profiles, academic_years, standards, sections
 *
 * Uses `withAdmin` to bypass RLS — same pattern production admin tooling uses.
 */
async function createStudentFixture(db: DrizzleDB, tenantId: string): Promise<StudentFixture> {
  const suffix = randomUUID().slice(0, 8);
  const admissionNumber = `ADM-${suffix}`;

  return withAdmin(db, async (tx) => {
    // Academic year (active).
    const [year] = await tx
      .insert(academicYears)
      .values({
        tenantId,
        label: `2025-26 ${suffix}`,
        startDate: '2025-04-01',
        endDate: '2026-03-31',
        isActive: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .returning({ id: academicYears.id });

    // Standard.
    const [std] = await tx
      .insert(standards)
      .values({
        tenantId,
        academicYearId: year.id,
        name: 'Class 5',
        numericOrder: 5,
        level: 'PRIMARY',
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .returning({ id: standards.id });

    // Section.
    const [sec] = await tx
      .insert(sections)
      .values({
        tenantId,
        standardId: std.id,
        academicYearId: year.id,
        name: 'A',
        displayLabel: 'Class 5-A',
        capacity: 40,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .returning({ id: sections.id });

    // User + user_profile.
    const [user] = await tx
      .insert(users)
      .values({
        email: `student_${suffix}@test.local`,
        username: `stu_${suffix}`,
        passwordHash: 'not-a-real-hash',
      })
      .returning({ id: users.id });

    await tx.insert(userProfiles).values({
      userId: user.id,
      firstName: { en: `Student ${suffix}` },
      lastName: { en: 'Kumar' },
      gender: 'male',
      createdBy: SYSTEM_USER_ID,
      updatedBy: SYSTEM_USER_ID,
    });

    // Student role + membership (required by student_profiles.membership_id FK).
    const [role] = await tx
      .insert(roles)
      .values({
        name: { en: `Student Role ${suffix}` },
        scope: 'institute',
        tenantId,
        abilities: [],
        isDefault: false,
        isSystem: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .returning({ id: roles.id });

    const [membership] = await tx
      .insert(memberships)
      .values({
        userId: user.id,
        roleId: role.id,
        tenantId,
        abilities: [],
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .returning({ id: memberships.id });

    // student_profiles row.
    const [profile] = await tx
      .insert(studentProfiles)
      .values({
        tenantId,
        userId: user.id,
        membershipId: membership.id,
        admissionNumber,
        admissionDate: '2025-04-01',
        admissionType: 'new',
        academicStatus: 'enrolled',
        socialCategory: 'general',
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .returning({ id: studentProfiles.id });

    // student_academics row so listStudentAcademics returns >= 1.
    await tx.insert(studentAcademics).values({
      tenantId,
      studentProfileId: profile.id,
      academicYearId: year.id,
      standardId: std.id,
      sectionId: sec.id,
      createdBy: SYSTEM_USER_ID,
      updatedBy: SYSTEM_USER_ID,
    });

    return { studentProfileId: profile.id, admissionNumber, academicYearId: year.id };
  });
}

describe('Student detail operations (integration)', () => {
  let result: IntegrationAppResult;
  let instituteToken: string;
  let fixture: StudentFixture;

  beforeAll(async () => {
    result = await createIntegrationApp({ modules: [AppModule] });
    const institute = await createTestInstitute(result.db);
    instituteToken = createInstituteToken({
      sub: institute.userId,
      tenantId: institute.tenantId,
      membershipId: institute.membershipId,
      roleId: institute.roleId,
    });
    fixture = await createStudentFixture(result.db, institute.tenantId);
  });

  afterAll(async () => {
    await result?.close();
  });

  it('getStudent returns the student with joined fields', async () => {
    const response = await gqlRequest<{ getStudent: { id: string; admissionNumber: string } }>(
      result.httpServer,
      {
        query: /* GraphQL */ `
          query GetStudent($id: ID!) {
            getStudent(id: $id) {
              id
              admissionNumber
              academicStatus
              firstName
              version
            }
          }
        `,
        token: instituteToken,
        variables: { id: fixture.studentProfileId },
      },
    );
    expect(response.errors).toBeUndefined();
    expect(response.data?.getStudent.id).toBe(fixture.studentProfileId);
    expect(response.data?.getStudent.admissionNumber).toBe(fixture.admissionNumber);
  });

  it('updateStudent with stale version throws CONCURRENT_MODIFICATION', async () => {
    const response = await gqlRequest(result.httpServer, {
      query: /* GraphQL */ `
        mutation UpdateStudent($id: ID!, $input: UpdateStudentInput!) {
          updateStudent(id: $id, input: $input) {
            id
          }
        }
      `,
      token: instituteToken,
      variables: {
        id: fixture.studentProfileId,
        input: { version: 9999, firstName: { en: 'Stale Update' } },
      },
    });
    expect(response.errors).toBeDefined();
    expect(response.errors?.[0]?.extensions?.code).toBe('CONCURRENT_MODIFICATION');
  });

  it('transitionStudentStatus enrolled→promoted succeeds', async () => {
    const response = await gqlRequest<{
      transitionStudentStatus: { id: string; academicStatus: string };
    }>(result.httpServer, {
      query: /* GraphQL */ `
          mutation Transition($id: ID!, $newStatus: String!) {
            transitionStudentStatus(id: $id, newStatus: $newStatus) {
              id
              academicStatus
            }
          }
        `,
      token: instituteToken,
      variables: { id: fixture.studentProfileId, newStatus: 'promoted' },
    });
    expect(response.errors).toBeUndefined();
    expect(response.data?.transitionStudentStatus.academicStatus).toBe('promoted');
  });

  it('transitionStudentStatus promoted→detained is rejected with INVALID_STATUS_TRANSITION', async () => {
    // Previous test left the fixture student in `promoted`. Only `enrolled`
    // is a valid next state — `detained` is NOT.
    const response = await gqlRequest(result.httpServer, {
      query: /* GraphQL */ `
        mutation Transition($id: ID!, $newStatus: String!) {
          transitionStudentStatus(id: $id, newStatus: $newStatus) {
            id
          }
        }
      `,
      token: instituteToken,
      variables: { id: fixture.studentProfileId, newStatus: 'detained' },
    });
    expect(response.errors).toBeDefined();
    expect(response.errors?.[0]?.extensions?.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('listStudentAcademics returns at least one row for the fixture student', async () => {
    const response = await gqlRequest<{ listStudentAcademics: ReadonlyArray<{ id: string }> }>(
      result.httpServer,
      {
        query: /* GraphQL */ `
          query ListAcademics($studentProfileId: ID!) {
            listStudentAcademics(studentProfileId: $studentProfileId) {
              id
              academicYearId
            }
          }
        `,
        token: instituteToken,
        variables: { studentProfileId: fixture.studentProfileId },
      },
    );
    expect(response.errors).toBeUndefined();
    expect(response.data?.listStudentAcademics.length).toBeGreaterThanOrEqual(1);
  });

  it('listStudentDocuments returns [] for a student with no docs', async () => {
    // This exercises the withTenant → withAdmin bridge (documents live on
    // platform-level user_documents) without any real document rows.
    const response = await gqlRequest<{ listStudentDocuments: ReadonlyArray<unknown> }>(
      result.httpServer,
      {
        query: /* GraphQL */ `
          query ListDocs($studentProfileId: ID!) {
            listStudentDocuments(studentProfileId: $studentProfileId) {
              id
            }
          }
        `,
        token: instituteToken,
        variables: { studentProfileId: fixture.studentProfileId },
      },
    );
    expect(response.errors).toBeUndefined();
    expect(response.data?.listStudentDocuments).toEqual([]);
  });

  it('listStudentGuardians returns linked guardians (empty array when none)', async () => {
    const response = await gqlRequest<{ listStudentGuardians: ReadonlyArray<unknown> }>(
      result.httpServer,
      {
        query: /* GraphQL */ `
          query ListGuardians($studentProfileId: ID!) {
            listStudentGuardians(studentProfileId: $studentProfileId) {
              id
            }
          }
        `,
        token: instituteToken,
        variables: { studentProfileId: fixture.studentProfileId },
      },
    );
    expect(response.errors).toBeUndefined();
    expect(Array.isArray(response.data?.listStudentGuardians)).toBe(true);
  });
});
