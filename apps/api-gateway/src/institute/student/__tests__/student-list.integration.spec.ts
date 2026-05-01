/**
 * ROV-167 — Integration tests for listStudents (institute-scoped).
 *
 * Exercises the real scope guard → CASL → service → withTenant → RLS pipeline
 * for the students list resolver. Uses a fresh test institute per suite so no
 * seeded data is mutated.
 */
import {
  createInstituteToken,
  createIntegrationApp,
  createPlatformToken,
  createResellerToken,
  createTestInstitute,
  gqlRequest,
  type IntegrationAppResult,
} from '@roviq/testing/integration';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../app/app.module';

const LIST_QUERY = /* GraphQL */ `
  query ListStudents($filter: StudentFilterInput) {
    listStudents(filter: $filter) {
      totalCount
      edges {
        cursor
        node {
          id
          admissionNumber
          academicStatus
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

interface ListStudentsResponse {
  listStudents: {
    totalCount: number;
    edges: ReadonlyArray<{
      cursor: string;
      node: { id: string; admissionNumber: string; academicStatus: string };
    }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

const FAKE = {
  USER: '00000000-0000-7000-a000-000000000fff',
  MEMBERSHIP: '00000000-0000-7000-a000-000000000ffe',
  ROLE: '00000000-0000-7000-a000-000000000ffd',
  TENANT: '00000000-0000-7000-a000-000000000ffc',
  RESELLER: '00000000-0000-7000-a000-000000000ffb',
} as const;

describe('listStudents (integration)', () => {
  let result: IntegrationAppResult;
  let instituteToken: string;

  beforeAll(async () => {
    result = await createIntegrationApp({ modules: [AppModule] });
    const institute = await createTestInstitute(result.db);
    instituteToken = createInstituteToken({
      sub: institute.userId,
      tenantId: institute.tenantId,
      membershipId: institute.membershipId,
      roleId: institute.roleId,
    });
  });

  afterAll(async () => {
    await result?.close();
  });

  describe('happy path', () => {
    it('institute admin can query listStudents and gets a valid connection back', async () => {
      const response = await gqlRequest<ListStudentsResponse>(result.httpServer, {
        query: LIST_QUERY,
        token: instituteToken,
      });
      expect(response.errors).toBeUndefined();
      expect(response.data?.listStudents).toBeDefined();
      expect(typeof response.data?.listStudents.totalCount).toBe('number');
      expect(Array.isArray(response.data?.listStudents.edges)).toBe(true);
    });

    it('multi-status filter is accepted by the resolver', async () => {
      const response = await gqlRequest<ListStudentsResponse>(result.httpServer, {
        query: LIST_QUERY,
        token: instituteToken,
        variables: { filter: { academicStatus: ['ENROLLED', 'PROMOTED'], first: 10 } },
      });
      expect(response.errors).toBeUndefined();
      // Every returned row (if any) must match the filter.
      for (const edge of response.data?.listStudents.edges ?? []) {
        expect(['ENROLLED', 'PROMOTED']).toContain(edge.node.academicStatus);
      }
    });

    it('orderBy=admissionNumber:asc is accepted and returns sorted results', async () => {
      const response = await gqlRequest<ListStudentsResponse>(result.httpServer, {
        query: LIST_QUERY,
        token: instituteToken,
        variables: { filter: { orderBy: 'admissionNumber:asc', first: 10 } },
      });
      expect(response.errors).toBeUndefined();
      const rows = response.data?.listStudents.edges ?? [];
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].node.admissionNumber >= rows[i - 1].node.admissionNumber).toBe(true);
      }
    });
  });

  describe('cross-scope rejection', () => {
    it('reseller token is rejected with FORBIDDEN', async () => {
      const resellerToken = createResellerToken({
        sub: FAKE.USER,
        resellerId: FAKE.RESELLER,
        membershipId: FAKE.MEMBERSHIP,
        roleId: FAKE.ROLE,
      });
      const response = await gqlRequest(result.httpServer, {
        query: LIST_QUERY,
        token: resellerToken,
      });
      expect(response.errors).toBeDefined();
      expect(response.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });

    it('platform token is rejected with FORBIDDEN', async () => {
      const platformToken = createPlatformToken({
        sub: FAKE.USER,
        membershipId: FAKE.MEMBERSHIP,
        roleId: FAKE.ROLE,
      });
      const response = await gqlRequest(result.httpServer, {
        query: LIST_QUERY,
        token: platformToken,
      });
      expect(response.errors).toBeDefined();
      expect(response.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });
  });
});
