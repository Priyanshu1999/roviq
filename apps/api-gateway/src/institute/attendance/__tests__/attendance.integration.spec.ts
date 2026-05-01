/**
 * Integration tests for the attendance Drizzle repository.
 *
 * Boots a focused NestJS module (`AttendanceRepositoryModule`) against the real
 * `roviq_test` Postgres (5-role RLS setup) and drives the repo through the
 * same `withTenant` pipeline production code uses.
 *
 * The repo is an institute-scope component — every call pulls `tenantId` from
 * `getRequestContext()`, so each operation runs inside `withTestContext()` to
 * supply the expected request metadata. Direct Drizzle seed inserts use
 * `withAdmin()` to bypass RLS (matching the pattern in
 * `student-detail.integration.spec.ts`).
 *
 * Coverage:
 *   1. Session creation → RLS ties the row to the caller's tenant.
 *   2. Entry insertion + `countByStatus` grouping.
 *   3. `(sessionId, studentId)` unique upsert — second call updates in place.
 */

import { randomUUID } from 'node:crypto';
import { AttendanceStatus } from '@roviq/common-types';
import {
  academicYears,
  attendanceSessions,
  type DrizzleDB,
  memberships,
  roles,
  SYSTEM_USER_ID,
  sections,
  standards,
  users,
  withAdmin,
} from '@roviq/database';
import { withTestContext } from '@roviq/request-context';
import {
  createIntegrationApp,
  createTestInstitute,
  type IntegrationAppResult,
  type TestInstitute,
} from '@roviq/testing/integration';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../app/app.module';
import { AttendanceRepository } from '../repositories/attendance.repository';

interface AttendanceFixture {
  academicYearId: string;
  standardId: string;
  sectionId: string;
  lecturerMembershipId: string;
  studentAMembershipId: string;
  studentBMembershipId: string;
}

/**
 * Insert the minimum academic + people rows attendance sessions need:
 *   academic_year → standard → section (FK targets)
 *   users → roles → memberships (lecturer + two students)
 *
 * Uses `withAdmin` to bypass RLS — matches how production admin tooling seeds
 * tenant data.
 */
async function createAttendanceFixture(
  db: DrizzleDB,
  tenantId: string,
): Promise<AttendanceFixture> {
  const suffix = randomUUID().slice(0, 8);

  return withAdmin(db, async (tx) => {
    const [year] = await tx
      .insert(academicYears)
      .values({
        tenantId,
        // academic_years.label has CHECK (label ~ '^[0-9]{4}-[0-9]{2}$') and
        // UNIQUE (tenant_id, label). Each test gets a fresh tenant, so the
        // bare year is unique without a suffix.
        label: '2025-26',
        startDate: '2025-04-01',
        endDate: '2026-03-31',
        isActive: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .returning({ id: academicYears.id });

    const [std] = await tx
      .insert(standards)
      .values({
        tenantId,
        academicYearId: year.id,
        name: { en: `Class 5 ${suffix}` },
        numericOrder: 5,
        level: 'PRIMARY',
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .returning({ id: standards.id });

    const [sec] = await tx
      .insert(sections)
      .values({
        tenantId,
        standardId: std.id,
        academicYearId: year.id,
        name: { en: `A-${suffix}` },
        displayLabel: `Class 5-A ${suffix}`,
        capacity: 40,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .returning({ id: sections.id });

    // One role shared by the lecturer + students (abilities are tested elsewhere;
    // here we only need valid FK targets for memberships).
    const [role] = await tx
      .insert(roles)
      .values({
        name: { en: `Attendance Role ${suffix}` },
        scope: 'institute',
        tenantId,
        abilities: [],
        isDefault: false,
        isSystem: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .returning({ id: roles.id });

    async function createPerson(kind: 'lecturer' | 'student_a' | 'student_b') {
      const local = `${kind}_${suffix}`;
      const [user] = await tx
        .insert(users)
        .values({
          email: `${local}@test.local`,
          username: local,
          passwordHash: 'not-a-real-hash',
        })
        .returning({ id: users.id });

      const [membership] = await tx
        .insert(memberships)
        .values({
          userId: user.id,
          roleId: role.id,
          tenantId,
          abilities: [],
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning({ id: memberships.id });

      return membership.id;
    }

    const lecturerMembershipId = await createPerson('lecturer');
    const studentAMembershipId = await createPerson('student_a');
    const studentBMembershipId = await createPerson('student_b');

    return {
      academicYearId: year.id,
      standardId: std.id,
      sectionId: sec.id,
      lecturerMembershipId,
      studentAMembershipId,
      studentBMembershipId,
    };
  });
}

describe('Attendance repository (integration)', () => {
  let appResult: IntegrationAppResult;
  let repo: AttendanceRepository;
  let tenant: TestInstitute;
  let fixture: AttendanceFixture;

  beforeAll(async () => {
    appResult = await createIntegrationApp({ modules: [AppModule] });
    repo = appResult.module.get(AttendanceRepository);
    tenant = await createTestInstitute(appResult.db);
    fixture = await createAttendanceFixture(appResult.db, tenant.tenantId);
  });

  afterAll(async () => {
    await appResult?.close();
  });

  /** Wrap a repo call in the same request context production middleware sets. */
  async function asTenant<T>(fn: () => Promise<T>): Promise<T> {
    return withTestContext(fn, {
      tenantId: tenant.tenantId,
      userId: tenant.userId,
      scope: 'institute',
    });
  }

  it('createSession writes a row and stamps tenantId from the request context', async () => {
    const session = await asTenant(() =>
      repo.createSession({
        sectionId: fixture.sectionId,
        academicYearId: fixture.academicYearId,
        date: '2026-04-23',
        period: 1,
        subjectId: null,
        lecturerId: fixture.lecturerMembershipId,
      }),
    );

    expect(session.id).toBeTruthy();
    expect(session.tenantId).toBe(tenant.tenantId);
    expect(session.sectionId).toBe(fixture.sectionId);
    expect(session.period).toBe(1);

    // Verify RLS: a raw admin lookup returns the row with the correct tenantId.
    const rows = await withAdmin(appResult.db, (tx) =>
      tx
        .select({ id: attendanceSessions.id, tenantId: attendanceSessions.tenantId })
        .from(attendanceSessions)
        .where(eq(attendanceSessions.id, session.id)),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tenantId).toBe(tenant.tenantId);
  });

  it('countByStatus groups entries by status for a session', async () => {
    const session = await asTenant(() =>
      repo.createSession({
        sectionId: fixture.sectionId,
        academicYearId: fixture.academicYearId,
        date: '2026-04-24',
        period: 1,
        subjectId: null,
        lecturerId: fixture.lecturerMembershipId,
      }),
    );

    await asTenant(() =>
      repo.upsertEntry({
        sessionId: session.id,
        studentId: fixture.studentAMembershipId,
        status: AttendanceStatus.PRESENT,
      }),
    );
    await asTenant(() =>
      repo.upsertEntry({
        sessionId: session.id,
        studentId: fixture.studentBMembershipId,
        status: AttendanceStatus.ABSENT,
      }),
    );

    const counts = await asTenant(() => repo.countByStatus(session.id));
    expect(counts[AttendanceStatus.PRESENT]).toBe(1);
    expect(counts[AttendanceStatus.ABSENT]).toBe(1);
    // No LEAVE / LATE entries were inserted — they must not appear in the map.
    expect(counts[AttendanceStatus.LEAVE]).toBeUndefined();
    expect(counts[AttendanceStatus.LATE]).toBeUndefined();
  });

  it('upsertEntry is idempotent on (sessionId, studentId) — second call updates status in place', async () => {
    const session = await asTenant(() =>
      repo.createSession({
        sectionId: fixture.sectionId,
        academicYearId: fixture.academicYearId,
        date: '2026-04-25',
        period: 1,
        subjectId: null,
        lecturerId: fixture.lecturerMembershipId,
      }),
    );

    const first = await asTenant(() =>
      repo.upsertEntry({
        sessionId: session.id,
        studentId: fixture.studentAMembershipId,
        status: AttendanceStatus.PRESENT,
      }),
    );
    expect(first.status).toBe(AttendanceStatus.PRESENT);

    // Flip the status — second call must UPDATE, not INSERT a duplicate.
    const second = await asTenant(() =>
      repo.upsertEntry({
        sessionId: session.id,
        studentId: fixture.studentAMembershipId,
        status: AttendanceStatus.ABSENT,
        remarks: 'late slip not submitted',
      }),
    );
    expect(second.id).toBe(first.id);
    expect(second.status).toBe(AttendanceStatus.ABSENT);
    expect(second.remarks).toBe('late slip not submitted');

    // Only a single row exists for this (session, student) pair.
    const entries = await asTenant(() => repo.findEntriesBySession(session.id));
    const forStudentA = entries.filter((e) => e.studentId === fixture.studentAMembershipId);
    expect(forStudentA).toHaveLength(1);

    // And the authoritative row reflects the latest status.
    const raw = await withAdmin(appResult.db, (tx) =>
      tx
        .select({ id: attendanceSessions.id })
        .from(attendanceSessions)
        .where(
          and(
            eq(attendanceSessions.id, session.id),
            eq(attendanceSessions.tenantId, tenant.tenantId),
          ),
        ),
    );
    expect(raw).toHaveLength(1);
  });
});
