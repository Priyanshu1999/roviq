/**
 * ROV-168 — Integration tests for Admission CRM: enquiries.
 *
 * Exercises the full InstituteScope → CASL → AdmissionService → withTenant →
 * RLS pipeline for enquiry CRUD + enquiry→application conversion. Uses a fresh
 * test institute per suite so no seeded data is mutated.
 */
import { randomUUID } from 'node:crypto';
import {
  academicYears,
  type DrizzleDB,
  SYSTEM_USER_ID,
  standards,
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
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../app/app.module';

interface AdmissionFixture {
  academicYearId: string;
  standardId: string;
}

async function createAdmissionFixture(db: DrizzleDB, tenantId: string): Promise<AdmissionFixture> {
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
        name: `Class 1 ${suffix}`,
        numericOrder: 1,
        level: 'PRIMARY',
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .returning({ id: standards.id });

    return { academicYearId: year.id, standardId: std.id };
  });
}

const CREATE_ENQUIRY = /* GraphQL */ `
  mutation CreateEnquiry($input: CreateEnquiryInput!) {
    createEnquiry(input: $input) {
      id
      studentName
      classRequested
      status
      parentPhone
    }
  }
`;

const LIST_ENQUIRIES = /* GraphQL */ `
  query ListEnquiries($filter: EnquiryFilterInput) {
    listEnquiries(filter: $filter) {
      totalCount
      edges {
        cursor
        node {
          id
          studentName
          status
        }
      }
    }
  }
`;

const UPDATE_ENQUIRY = /* GraphQL */ `
  mutation UpdateEnquiry($id: ID!, $input: UpdateEnquiryInput!) {
    updateEnquiry(id: $id, input: $input) {
      id
      status
      followUpDate
      assignedTo
    }
  }
`;

const CONVERT_ENQUIRY = /* GraphQL */ `
  mutation ConvertEnquiry($enquiryId: ID!, $standardId: ID!, $academicYearId: ID!) {
    convertEnquiryToApplication(
      enquiryId: $enquiryId
      standardId: $standardId
      academicYearId: $academicYearId
    ) {
      id
      status
      enquiryId
    }
  }
`;

interface CreateEnquiryResponse {
  createEnquiry: {
    id: string;
    studentName: string;
    classRequested: string;
    status: string;
    parentPhone: string;
  };
}

interface ListEnquiriesResponse {
  listEnquiries: {
    totalCount: number;
    edges: ReadonlyArray<{
      cursor: string;
      node: { id: string; studentName: string; status: string };
    }>;
  };
}

interface UpdateEnquiryResponse {
  updateEnquiry: {
    id: string;
    status: string;
    followUpDate: string | null;
    assignedTo: string | null;
  };
}

interface ConvertEnquiryResponse {
  convertEnquiryToApplication: {
    id: string;
    status: string;
    enquiryId: string | null;
  };
}

const FAKE_RESELLER = {
  USER: '00000000-0000-4000-a000-000000000aaa',
  MEMBERSHIP: '00000000-0000-4000-a000-000000000aab',
  ROLE: '00000000-0000-4000-a000-000000000aac',
  RESELLER: '00000000-0000-4000-a000-000000000aad',
} as const;

describe('Admission enquiries (integration)', () => {
  let result: IntegrationAppResult;
  let instituteToken: string;
  let fixture: AdmissionFixture;
  let instituteUserId: string;

  beforeAll(async () => {
    result = await createIntegrationApp({ modules: [AppModule] });
    const institute = await createTestInstitute(result.db);
    instituteUserId = institute.userId;
    instituteToken = createInstituteToken({
      sub: institute.userId,
      tenantId: institute.tenantId,
      membershipId: institute.membershipId,
      roleId: institute.roleId,
    });
    fixture = await createAdmissionFixture(result.db, institute.tenantId);
  });

  afterAll(async () => {
    await result?.close();
  });

  it('createEnquiry: institute admin creates enquiry and gets persisted row', async () => {
    const response = await gqlRequest<CreateEnquiryResponse>(result.httpServer, {
      query: CREATE_ENQUIRY,
      token: instituteToken,
      variables: {
        input: {
          studentName: 'Rajesh Kumar',
          classRequested: 'Class 1',
          parentName: 'Suresh Kumar',
          parentPhone: '9876543210',
          source: 'walk_in',
        },
      },
    });
    expect(response.errors).toBeUndefined();
    expect(response.data?.createEnquiry.id).toBeTruthy();
    expect(response.data?.createEnquiry.studentName).toBe('Rajesh Kumar');
    expect(response.data?.createEnquiry.classRequested).toBe('Class 1');
    expect(response.data?.createEnquiry.status).toBe('new');
    expect(response.data?.createEnquiry.parentPhone).toBe('9876543210');
  });

  it('listEnquiries: returns the tenant-scoped enquiries', async () => {
    // Seed one to ensure list is non-empty if the create test ran first.
    await gqlRequest<CreateEnquiryResponse>(result.httpServer, {
      query: CREATE_ENQUIRY,
      token: instituteToken,
      variables: {
        input: {
          studentName: 'Anita Sharma',
          classRequested: 'Class 2',
          parentName: 'Ravi Sharma',
          parentPhone: '9123456780',
        },
      },
    });

    const response = await gqlRequest<ListEnquiriesResponse>(result.httpServer, {
      query: LIST_ENQUIRIES,
      token: instituteToken,
      variables: { filter: { first: 25 } },
    });
    expect(response.errors).toBeUndefined();
    expect(response.data?.listEnquiries.totalCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(response.data?.listEnquiries.edges)).toBe(true);
    const names = response.data?.listEnquiries.edges.map((e) => e.node.studentName) ?? [];
    expect(names).toContain('Anita Sharma');
  });

  it('updateEnquiry: updates status, followUpDate, and assignedTo', async () => {
    const create = await gqlRequest<CreateEnquiryResponse>(result.httpServer, {
      query: CREATE_ENQUIRY,
      token: instituteToken,
      variables: {
        input: {
          studentName: 'Priya Mehta',
          classRequested: 'Class 3',
          parentName: 'Vijay Mehta',
          parentPhone: '9988776655',
        },
      },
    });
    const enquiryId = create.data?.createEnquiry.id;
    expect(enquiryId).toBeTruthy();

    const assignee = instituteUserId;
    const response = await gqlRequest<UpdateEnquiryResponse>(result.httpServer, {
      query: UPDATE_ENQUIRY,
      token: instituteToken,
      variables: {
        id: enquiryId,
        input: {
          status: 'contacted',
          followUpDate: '2026-05-15',
          assignedTo: assignee,
        },
      },
    });

    expect(response.errors).toBeUndefined();
    expect(response.data?.updateEnquiry.id).toBe(enquiryId);
    expect(response.data?.updateEnquiry.status).toBe('contacted');
    expect(response.data?.updateEnquiry.followUpDate).toBe('2026-05-15');
    expect(response.data?.updateEnquiry.assignedTo).toBe(assignee);
  });

  it('convertEnquiryToApplication: creates application and updates enquiry status', async () => {
    const create = await gqlRequest<CreateEnquiryResponse>(result.httpServer, {
      query: CREATE_ENQUIRY,
      token: instituteToken,
      variables: {
        input: {
          studentName: 'Kiran Patel',
          classRequested: 'Class 1',
          parentName: 'Manish Patel',
          parentPhone: '9012345678',
        },
      },
    });
    const enquiryId = create.data?.createEnquiry.id;
    expect(enquiryId).toBeTruthy();

    const convert = await gqlRequest<ConvertEnquiryResponse>(result.httpServer, {
      query: CONVERT_ENQUIRY,
      token: instituteToken,
      variables: {
        enquiryId,
        standardId: fixture.standardId,
        academicYearId: fixture.academicYearId,
      },
    });
    expect(convert.errors).toBeUndefined();
    expect(convert.data?.convertEnquiryToApplication.id).toBeTruthy();
    expect(convert.data?.convertEnquiryToApplication.status).toBe('submitted');
    expect(convert.data?.convertEnquiryToApplication.enquiryId).toBe(enquiryId);

    // Original enquiry now reflects conversion.
    const list = await gqlRequest<ListEnquiriesResponse>(result.httpServer, {
      query: LIST_ENQUIRIES,
      token: instituteToken,
      variables: { filter: { first: 100 } },
    });
    const converted = list.data?.listEnquiries.edges.find((e) => e.node.id === enquiryId);
    expect(converted?.node.status).toBe('application_submitted');
  });

  it('cross-scope rejection: reseller token on listEnquiries is FORBIDDEN', async () => {
    const resellerToken = createResellerToken({
      sub: FAKE_RESELLER.USER,
      resellerId: FAKE_RESELLER.RESELLER,
      membershipId: FAKE_RESELLER.MEMBERSHIP,
      roleId: FAKE_RESELLER.ROLE,
    });
    const response = await gqlRequest(result.httpServer, {
      query: LIST_ENQUIRIES,
      token: resellerToken,
      variables: { filter: { first: 10 } },
    });
    expect(response.errors).toBeDefined();
    expect(response.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});
