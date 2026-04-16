/**
 * ROV-168 — Integration tests for Admission CRM: applications + statistics.
 *
 * Exercises the full InstituteScope → CASL → AdmissionService → withTenant →
 * RLS pipeline for application lifecycle and the admissionStatistics funnel.
 *
 * `approveApplication` is exercised via a `vi.spyOn` stub on `approveAndEnroll`
 * because the real implementation opens a live Temporal connection — that
 * belongs in an e2e test, not an in-process integration test.
 */
import { randomUUID } from 'node:crypto';
import { AdmissionApplicationStatus } from '@roviq/common-types';
import {
  academicYears,
  admissionApplications,
  type DrizzleDB,
  SYSTEM_USER_ID,
  standards,
  withAdmin,
} from '@roviq/database';
import {
  createInstituteToken,
  createIntegrationApp,
  createPlatformToken,
  createTestInstitute,
  gqlRequest,
  type IntegrationAppResult,
} from '@roviq/testing/integration';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../../app/app.module';
import { AdmissionService } from '../admission.service';
import type { ApplicationModel } from '../models/application.model';

interface AdmissionFixture {
  academicYearId: string;
  standardId: string;
  submittedApplicationId: string;
  offerAcceptedApplicationId: string;
}

async function createAdmissionFixture(
  db: DrizzleDB,
  tenantId: string,
  actorId: string,
): Promise<AdmissionFixture> {
  const suffix = randomUUID().slice(0, 8);
  return withAdmin(db, async (tx) => {
    const [year] = await tx
      .insert(academicYears)
      .values({
        tenantId,
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
        name: { en: `Class 1 ${suffix}` },
        numericOrder: 1,
        level: 'PRIMARY',
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .returning({ id: standards.id });

    const [submitted] = await tx
      .insert(admissionApplications)
      .values({
        tenantId,
        academicYearId: year.id,
        standardId: std.id,
        formData: { studentName: `Submitted ${suffix}` },
        status: AdmissionApplicationStatus.SUBMITTED,
        isRteApplication: false,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning({ id: admissionApplications.id });

    const [offerAccepted] = await tx
      .insert(admissionApplications)
      .values({
        tenantId,
        academicYearId: year.id,
        standardId: std.id,
        formData: { studentName: `OfferAccepted ${suffix}` },
        status: AdmissionApplicationStatus.OFFER_ACCEPTED,
        isRteApplication: false,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning({ id: admissionApplications.id });

    return {
      academicYearId: year.id,
      standardId: std.id,
      submittedApplicationId: submitted.id,
      offerAcceptedApplicationId: offerAccepted.id,
    };
  });
}

const LIST_APPLICATIONS = /* GraphQL */ `
  query ListApplications($filter: ApplicationFilterInput) {
    listApplications(filter: $filter) {
      totalCount
      edges {
        cursor
        node {
          id
          status
          academicYearId
          standardId
        }
      }
    }
  }
`;

const UPDATE_APPLICATION = /* GraphQL */ `
  mutation UpdateApplication($id: ID!, $input: UpdateApplicationInput!) {
    updateApplication(id: $id, input: $input) {
      id
      status
    }
  }
`;

const APPROVE_APPLICATION = /* GraphQL */ `
  mutation ApproveApplication($id: ID!) {
    approveApplication(id: $id) {
      id
      status
    }
  }
`;

const ADMISSION_STATISTICS = /* GraphQL */ `
  query AdmissionStatistics {
    admissionStatistics {
      totalEnquiries
      totalApplications
      funnel {
        stage
        count
      }
      enquiryToApplicationRate
      applicationToEnrolledRate
    }
  }
`;

interface ListApplicationsResponse {
  listApplications: {
    totalCount: number;
    edges: ReadonlyArray<{
      cursor: string;
      node: {
        id: string;
        status: string;
        academicYearId: string;
        standardId: string;
      };
    }>;
  };
}

interface UpdateApplicationResponse {
  updateApplication: { id: string; status: string };
}

interface ApproveApplicationResponse {
  approveApplication: { id: string; status: string };
}

interface AdmissionStatisticsResponse {
  admissionStatistics: {
    totalEnquiries: number;
    totalApplications: number;
    funnel: ReadonlyArray<{ stage: string; count: number }>;
    enquiryToApplicationRate: number;
    applicationToEnrolledRate: number;
  };
}

const FAKE_PLATFORM = {
  USER: '00000000-0000-4000-a000-000000000bbb',
  MEMBERSHIP: '00000000-0000-4000-a000-000000000bbc',
  ROLE: '00000000-0000-4000-a000-000000000bbd',
} as const;

describe('Admission applications (integration)', () => {
  let result: IntegrationAppResult;
  let instituteToken: string;
  let fixture: AdmissionFixture;

  beforeAll(async () => {
    result = await createIntegrationApp({ modules: [AppModule] });
    const institute = await createTestInstitute(result.db);
    instituteToken = createInstituteToken({
      sub: institute.userId,
      tenantId: institute.tenantId,
      membershipId: institute.membershipId,
      roleId: institute.roleId,
    });
    fixture = await createAdmissionFixture(result.db, institute.tenantId, institute.userId);
  });

  afterAll(async () => {
    await result?.close();
  });

  it('listApplications: returns tenant applications', async () => {
    const response = await gqlRequest<ListApplicationsResponse>(result.httpServer, {
      query: LIST_APPLICATIONS,
      token: instituteToken,
      variables: { filter: { first: 50 } },
    });
    expect(response.errors).toBeUndefined();
    expect(response.data?.listApplications.totalCount).toBeGreaterThanOrEqual(2);
    const ids = response.data?.listApplications.edges.map((e) => e.node.id) ?? [];
    expect(ids).toContain(fixture.submittedApplicationId);
    expect(ids).toContain(fixture.offerAcceptedApplicationId);
  });

  it('updateApplication: valid status transition submitted → documents_pending', async () => {
    const response = await gqlRequest<UpdateApplicationResponse>(result.httpServer, {
      query: UPDATE_APPLICATION,
      token: instituteToken,
      variables: {
        id: fixture.submittedApplicationId,
        input: { status: AdmissionApplicationStatus.DOCUMENTS_PENDING },
      },
    });
    expect(response.errors).toBeUndefined();
    expect(response.data?.updateApplication.id).toBe(fixture.submittedApplicationId);
    expect(response.data?.updateApplication.status).toBe(
      AdmissionApplicationStatus.DOCUMENTS_PENDING,
    );
  });

  it('approveApplication: triggers workflow path and returns enrolled application', async () => {
    // approveAndEnroll normally opens a real Temporal connection. Stub it on
    // the live service instance to simulate the workflow completing and
    // transitioning the application to `enrolled`.
    const service = result.app.get(AdmissionService);
    const enrolledModel: ApplicationModel = {
      id: fixture.offerAcceptedApplicationId,
      tenantId: '00000000-0000-0000-0000-000000000000',
      enquiryId: null,
      academicYearId: fixture.academicYearId,
      standardId: fixture.standardId,
      sectionId: null,
      formData: {},
      status: AdmissionApplicationStatus.ENROLLED,
      isRteApplication: false,
      testScore: null,
      interviewScore: null,
      meritRank: null,
      rteLotteryRank: null,
      offeredAt: null,
      offerExpiresAt: null,
      offerAcceptedAt: null,
      studentProfileId: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const spy = vi.spyOn(service, 'approveAndEnroll').mockResolvedValue(enrolledModel);

    const response = await gqlRequest<ApproveApplicationResponse>(result.httpServer, {
      query: APPROVE_APPLICATION,
      token: instituteToken,
      variables: { id: fixture.offerAcceptedApplicationId },
    });

    expect(response.errors).toBeUndefined();
    expect(response.data?.approveApplication.id).toBe(fixture.offerAcceptedApplicationId);
    expect(response.data?.approveApplication.status).toBe(AdmissionApplicationStatus.ENROLLED);
    expect(spy).toHaveBeenCalledWith(fixture.offerAcceptedApplicationId);
    spy.mockRestore();
  });

  it('admissionStatistics: returns funnel counts with submitted applications present', async () => {
    const response = await gqlRequest<AdmissionStatisticsResponse>(result.httpServer, {
      query: ADMISSION_STATISTICS,
      token: instituteToken,
    });
    expect(response.errors).toBeUndefined();
    const stats = response.data?.admissionStatistics;
    expect(stats).toBeDefined();
    expect(typeof stats?.totalEnquiries).toBe('number');
    expect(typeof stats?.totalApplications).toBe('number');
    expect(stats?.totalApplications).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(stats?.funnel)).toBe(true);
    // Funnel must contain the canonical stages.
    const stages = stats?.funnel.map((f) => f.stage) ?? [];
    expect(stages).toContain(AdmissionApplicationStatus.SUBMITTED);
    expect(stages).toContain(AdmissionApplicationStatus.ENROLLED);
    // Every count is a non-negative number.
    for (const entry of stats?.funnel ?? []) {
      expect(entry.count).toBeGreaterThanOrEqual(0);
    }
    expect(stats?.enquiryToApplicationRate).toBeGreaterThanOrEqual(0);
    expect(stats?.applicationToEnrolledRate).toBeGreaterThanOrEqual(0);
  });

  it('cross-scope rejection: platform token on listApplications is FORBIDDEN', async () => {
    const platformToken = createPlatformToken({
      sub: FAKE_PLATFORM.USER,
      membershipId: FAKE_PLATFORM.MEMBERSHIP,
      roleId: FAKE_PLATFORM.ROLE,
    });
    const response = await gqlRequest(result.httpServer, {
      query: LIST_APPLICATIONS,
      token: platformToken,
      variables: { filter: { first: 10 } },
    });
    expect(response.errors).toBeDefined();
    expect(response.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});
