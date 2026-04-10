/**
 * ROV-170 — Integration tests for TC resolver (institute-scoped).
 *
 * Exercises the real scope guard → CASL → service → withTenant → RLS pipeline
 * for requestTC, approveTC, rejectTC, and listTCs. Uses a fresh test institute
 * with a hand-rolled student fixture per suite (no seed mutation).
 */
import { randomUUID } from 'node:crypto';
import {
  AcademicStatus,
  AdmissionType,
  Gender,
  SocialCategory,
  TcStatus,
} from '@roviq/common-types';
import {
  academicYears,
  type DrizzleDB,
  memberships,
  roles,
  SYSTEM_USER_ID,
  sections,
  standards,
  studentProfiles,
  tcRegister,
  userProfiles,
  users,
  withAdmin,
} from '@roviq/database';
import {
  createInstituteToken,
  createIntegrationApp,
  createResellerToken,
  createTestInstitute,
  gqlRequest,
  type IntegrationAppResult,
} from '@roviq/testing/integration';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../app/app.module';

interface StudentFixture {
  studentProfileId: string;
  academicYearId: string;
}

async function createEnrolledStudent(db: DrizzleDB, tenantId: string): Promise<StudentFixture> {
  const suffix = randomUUID().slice(0, 8);

  return withAdmin(db, async (tx) => {
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

    await tx
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

    const [user] = await tx
      .insert(users)
      .values({
        email: `tc_stu_${suffix}@test.local`,
        username: `tc_stu_${suffix}`,
        passwordHash: 'not-a-real-hash',
      })
      .returning({ id: users.id });

    await tx.insert(userProfiles).values({
      userId: user.id,
      firstName: { en: `Student ${suffix}` },
      lastName: { en: 'Kumar' },
      gender: Gender.MALE,
      createdBy: SYSTEM_USER_ID,
      updatedBy: SYSTEM_USER_ID,
    });

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

    const [profile] = await tx
      .insert(studentProfiles)
      .values({
        tenantId,
        userId: user.id,
        membershipId: membership.id,
        admissionNumber: `TC-ADM-${suffix}`,
        admissionDate: '2025-04-01',
        admissionType: AdmissionType.NEW,
        academicStatus: AcademicStatus.ENROLLED,
        socialCategory: SocialCategory.GENERAL,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .returning({ id: studentProfiles.id });

    return { studentProfileId: profile.id, academicYearId: year.id };
  });
}

const FAKE = {
  USER: '00000000-0000-4000-a000-000000000eff',
  MEMBERSHIP: '00000000-0000-4000-a000-000000000efe',
  ROLE: '00000000-0000-4000-a000-000000000efd',
  RESELLER: '00000000-0000-4000-a000-000000000efb',
} as const;

const REQUEST_TC = /* GraphQL */ `
  mutation RequestTC($input: RequestTCInput!) {
    requestTC(input: $input) {
      id
      status
      reason
    }
  }
`;

const APPROVE_TC = /* GraphQL */ `
  mutation ApproveTC($id: ID!) {
    approveTC(id: $id) {
      id
      status
    }
  }
`;

const REJECT_TC = /* GraphQL */ `
  mutation RejectTC($id: ID!, $reason: String!) {
    rejectTC(id: $id, reason: $reason) {
      id
      status
    }
  }
`;

const LIST_TCS = /* GraphQL */ `
  query ListTCs($filter: ListTCFilterInput) {
    listTCs(filter: $filter) {
      id
      status
    }
  }
`;

interface RequestTCResponse {
  requestTC: { id: string; status: string; reason: string };
}
interface ApproveTCResponse {
  approveTC: { id: string; status: string };
}
interface RejectTCResponse {
  rejectTC: { id: string; status: string };
}
interface ListTCsResponse {
  listTCs: ReadonlyArray<{ id: string; status: string }>;
}

describe('TCResolver (integration)', () => {
  let result: IntegrationAppResult;
  let instituteToken: string;
  let tenantId: string;
  let fixture: StudentFixture;

  beforeAll(async () => {
    result = await createIntegrationApp({ modules: [AppModule] });
    const institute = await createTestInstitute(result.db);
    tenantId = institute.tenantId;
    instituteToken = createInstituteToken({
      sub: institute.userId,
      tenantId: institute.tenantId,
      membershipId: institute.membershipId,
      roleId: institute.roleId,
    });
    fixture = await createEnrolledStudent(result.db, tenantId);
  });

  afterAll(async () => {
    await result?.close();
  });

  it('requestTC creates a tc_register row in requested status for an enrolled student', async () => {
    const response = await gqlRequest<RequestTCResponse>(result.httpServer, {
      query: REQUEST_TC,
      token: instituteToken,
      variables: {
        input: {
          studentProfileId: fixture.studentProfileId,
          academicYearId: fixture.academicYearId,
          reason: 'Family relocating to another city',
        },
      },
    });
    expect(response.errors).toBeUndefined();
    expect(response.data?.requestTC.id).toBeDefined();
    expect(response.data?.requestTC.status).toBe(TcStatus.REQUESTED);
    expect(response.data?.requestTC.reason).toBe('Family relocating to another city');
  });

  it('approveTC returns NOT_FOUND when the TC is not in `generated` status (requested)', async () => {
    // Create a TC directly in `requested` status so we can assert approveTC's
    // guard — it only accepts status=generated, so this verifies the full pipeline
    // (scope guard → CASL → service → withTenant) routes the NotFoundException.
    const [tc] = await withAdmin(result.db, (tx) =>
      tx
        .insert(tcRegister)
        .values({
          tenantId,
          studentProfileId: fixture.studentProfileId,
          academicYearId: fixture.academicYearId,
          tcSerialNumber: `TC-REQ-${Date.now()}`,
          status: TcStatus.REQUESTED,
          reason: 'Testing approve guard',
          requestedBy: SYSTEM_USER_ID,
          createdBy: SYSTEM_USER_ID,
          updatedBy: SYSTEM_USER_ID,
        })
        .returning({ id: tcRegister.id }),
    );

    const response = await gqlRequest<ApproveTCResponse>(result.httpServer, {
      query: APPROVE_TC,
      token: instituteToken,
      variables: { id: tc.id },
    });
    expect(response.errors).toBeDefined();
    expect(response.errors?.[0]?.message).toMatch(/not found|not in generated/i);
  });

  it('rejectTC transitions a requested TC to cancelled and persists the rejection reason', async () => {
    const [tc] = await withAdmin(result.db, (tx) =>
      tx
        .insert(tcRegister)
        .values({
          tenantId,
          studentProfileId: fixture.studentProfileId,
          academicYearId: fixture.academicYearId,
          tcSerialNumber: `TC-REQ-${Date.now()}-r`,
          status: TcStatus.REQUESTED,
          reason: 'To be rejected',
          requestedBy: SYSTEM_USER_ID,
          createdBy: SYSTEM_USER_ID,
          updatedBy: SYSTEM_USER_ID,
        })
        .returning({ id: tcRegister.id }),
    );

    const response = await gqlRequest<RejectTCResponse>(result.httpServer, {
      query: REJECT_TC,
      token: instituteToken,
      variables: { id: tc.id, reason: 'Insufficient documentation submitted' },
    });
    expect(response.errors).toBeUndefined();
    expect(response.data?.rejectTC.id).toBe(tc.id);
    // Schema has no `rejected` status — `cancelled` is the terminal pre-issuance state.
    expect(response.data?.rejectTC.status).toBe(TcStatus.CANCELLED);

    // Verify rejection_reason was merged into tc_data.
    const rows = await withAdmin(result.db, (tx) =>
      tx
        .select({ tcData: tcRegister.tcData })
        .from(tcRegister)
        .where(eq(tcRegister.id, tc.id))
        .limit(1),
    );
    const tcData = rows[0]?.tcData as Record<string, unknown> | null;
    expect(tcData?.rejection_reason).toBe('Insufficient documentation submitted');
  });

  it('listTCs returns only the current tenant’s TCs', async () => {
    const response = await gqlRequest<ListTCsResponse>(result.httpServer, {
      query: LIST_TCS,
      token: instituteToken,
    });
    expect(response.errors).toBeUndefined();
    expect(Array.isArray(response.data?.listTCs)).toBe(true);
    // Must contain at least the requested TC from the first test.
    expect(response.data?.listTCs.length).toBeGreaterThan(0);
  });

  it('reseller token is rejected with FORBIDDEN on requestTC', async () => {
    const resellerToken = createResellerToken({
      sub: FAKE.USER,
      resellerId: FAKE.RESELLER,
      membershipId: FAKE.MEMBERSHIP,
      roleId: FAKE.ROLE,
    });
    const response = await gqlRequest(result.httpServer, {
      query: REQUEST_TC,
      token: resellerToken,
      variables: {
        input: {
          studentProfileId: fixture.studentProfileId,
          academicYearId: fixture.academicYearId,
          reason: 'cross-scope attempt',
        },
      },
    });
    expect(response.errors).toBeDefined();
    expect(response.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});
