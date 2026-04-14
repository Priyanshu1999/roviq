/**
 * CASL `@CheckAbility` enforcement — integration tests.
 *
 * Boots the full Nest app once, creates a fresh test institute with an
 * admin (manage:all) and a teacher (limited class_teacher abilities), and
 * asserts that the AbilityGuard rejects mutations the teacher does not
 * have permission for. Also includes a positive admin path to guard
 * against false-positive guard behavior (a misconfigured guard could
 * reject everyone, hiding bugs).
 *
 * The CheckAbility guard fires BEFORE the service runs, so negative
 * tests can target non-existent IDs without setting up rows — the
 * FORBIDDEN response is returned before the service ever sees the input.
 */

import {
  cleanupTestInstitute,
  cleanupTestTeacher,
  createInstituteToken,
  createIntegrationApp,
  createTestInstitute,
  createTestTeacher,
  gqlRequest,
  type IntegrationAppResult,
  type TestInstitute,
  type TestTeacher,
} from '@roviq/testing/integration';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app/app.module';

const FAKE_ID = '00000000-0000-4000-a000-00000000dead';

describe('CASL @CheckAbility enforcement', () => {
  let result: IntegrationAppResult;
  let tenant: TestInstitute;
  let teacher: TestTeacher;
  let adminToken: string;
  let teacherToken: string;

  beforeAll(async () => {
    result = await createIntegrationApp({ modules: [AppModule] });
    tenant = await createTestInstitute(result.db);
    teacher = await createTestTeacher(result.db, tenant.tenantId);

    adminToken = createInstituteToken({
      sub: tenant.userId,
      tenantId: tenant.tenantId,
      membershipId: tenant.membershipId,
      roleId: tenant.roleId,
    });
    teacherToken = createInstituteToken({
      sub: teacher.userId,
      tenantId: tenant.tenantId,
      membershipId: teacher.membershipId,
      roleId: teacher.roleId,
    });
  });

  afterAll(async () => {
    if (teacher) await cleanupTestTeacher(result.db, teacher);
    if (tenant) await cleanupTestInstitute(result.db, tenant);
    await result?.close();
  });

  describe('Positive admin path (false-positive guard)', () => {
    it('admin (manage:all) can read institutes — guard does NOT reject', async () => {
      // Sanity check: a misconfigured AbilityGuard could reject every
      // request, making the negative tests below pass for the wrong
      // reason. Verify the admin token, which has manage:all on every
      // membership, is allowed through the guard for a known-good query.
      const response = await gqlRequest(result.httpServer, {
        query: `query { institutes { totalCount } }`,
        token: adminToken,
      });
      if (response.errors) {
        expect(response.errors[0]?.extensions?.code).not.toBe('FORBIDDEN');
      }
    });
  });

  describe('Standard mutations', () => {
    it('teacher cannot create a standard (no create:Standard ability)', async () => {
      const response = await gqlRequest(result.httpServer, {
        query: `
          mutation CreateStandard($input: CreateStandardInput!) {
            createStandard(input: $input) { id }
          }
        `,
        variables: {
          input: {
            academicYearId: FAKE_ID,
            name: { en: 'Test Standard' },
            numericOrder: 1,
          },
        },
        token: teacherToken,
      });
      expect(response.errors).toBeDefined();
      expect(response.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });

    it('teacher cannot delete a standard (no delete:Standard ability)', async () => {
      const response = await gqlRequest(result.httpServer, {
        query: `mutation { deleteStandard(id: "${FAKE_ID}") }`,
        token: teacherToken,
      });
      expect(response.errors).toBeDefined();
      expect(response.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });
  });

  describe('Institute mutations', () => {
    it('teacher cannot update institute info (no update_info:Institute ability)', async () => {
      const response = await gqlRequest(result.httpServer, {
        query: `
          mutation UpdateInstituteInfo($id: ID!, $input: UpdateInstituteInfoInput!) {
            updateInstituteInfo(id: $id, input: $input) { id }
          }
        `,
        variables: {
          id: FAKE_ID,
          input: { version: 1, name: { en: 'Hacked' } },
        },
        token: teacherToken,
      });
      expect(response.errors).toBeDefined();
      expect(response.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });

    it('teacher cannot delete an institute (no delete:Institute ability)', async () => {
      const response = await gqlRequest(result.httpServer, {
        query: `mutation { deleteInstitute(id: "${FAKE_ID}") }`,
        token: teacherToken,
      });
      expect(response.errors).toBeDefined();
      expect(response.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });
  });
});
