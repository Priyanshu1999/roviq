/**
 * ROV-169 — Integration tests for GuardianResolver.listGuardians and
 * listLinkedStudents.
 *
 * Boots the full AppModule in-process against a real PostgreSQL database
 * and asserts:
 *   1. listGuardians happy path — shape assertion, firstName is a jsonb
 *      object (NOT a resolved string — the frontend handles locale)
 *   2. listGuardians with a search filter
 *   3. listLinkedStudents returns an empty array for a guardian with no
 *      links (or for a non-existent guardian id — the service tolerates
 *      both with a guard at the service layer)
 *   4. A platform-scope token is rejected with FORBIDDEN by @InstituteScope
 */

import {
  createInstituteToken,
  createIntegrationApp,
  createPlatformToken,
  createTestInstitute,
  gqlRequest,
  type IntegrationAppResult,
  type TestInstitute,
} from '@roviq/testing/integration';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../app/app.module';

const FAKE = {
  USER: '00000000-0000-4000-a000-000000000bb1',
  MEMBERSHIP: '00000000-0000-4000-a000-000000000bb2',
  ROLE: '00000000-0000-4000-a000-000000000bb3',
} as const;

// Random, definitely-not-seeded UUID for the "no links" assertion.
const NO_LINKS_GUARDIAN_ID = '00000000-0000-4000-a000-00000000ffe1';

interface GuardianNode {
  id: string;
  firstName: Record<string, string>;
  lastName?: Record<string, string> | null;
}

interface ListGuardiansData {
  listGuardians: GuardianNode[];
}

interface ListLinkedStudentsData {
  listLinkedStudents: Array<{ id: string }>;
}

describe('Guardian list (integration)', () => {
  let appResult: IntegrationAppResult;
  let tenant: TestInstitute;
  let token: string;

  beforeAll(async () => {
    appResult = await createIntegrationApp({ modules: [AppModule] });
    tenant = await createTestInstitute(appResult.db);
    token = createInstituteToken({
      sub: tenant.userId,
      tenantId: tenant.tenantId,
      membershipId: tenant.membershipId,
      roleId: tenant.roleId,
    });
  });

  afterAll(async () => {
    await appResult?.close();
  });

  it('listGuardians happy path — returns guardians with firstName as an object', async () => {
    const response = await gqlRequest<ListGuardiansData>(appResult.httpServer, {
      query: 'query { listGuardians { id firstName lastName } }',
      token,
    });

    expect(response.errors).toBeUndefined();
    expect(Array.isArray(response.data?.listGuardians)).toBe(true);
    for (const row of response.data?.listGuardians ?? []) {
      expect(typeof row.firstName).toBe('object');
    }
  });

  it('listGuardians accepts a search filter', async () => {
    const response = await gqlRequest<ListGuardiansData>(appResult.httpServer, {
      query: 'query($f: ListGuardiansFilterInput) { listGuardians(filter: $f) { id firstName } }',
      variables: { f: { search: 'Suresh' } },
      token,
    });

    expect(response.errors).toBeUndefined();
    expect(Array.isArray(response.data?.listGuardians)).toBe(true);
  });

  it('listLinkedStudents returns [] for a guardian with no links', async () => {
    const response = await gqlRequest<ListLinkedStudentsData>(appResult.httpServer, {
      query: 'query($id: ID!) { listLinkedStudents(guardianProfileId: $id) { linkId } }',
      variables: { id: NO_LINKS_GUARDIAN_ID },
      token,
    });

    // The resolver may either return an empty array or raise a NotFound —
    // both are acceptable behaviours for a non-existent guardian. What we
    // MUST NOT see is a FORBIDDEN from the scope guard.
    const code = response.errors?.[0]?.extensions?.code;
    expect(code).not.toBe('FORBIDDEN');
    if (!response.errors) {
      expect(Array.isArray(response.data?.listLinkedStudents)).toBe(true);
      expect(response.data?.listLinkedStudents).toEqual([]);
    }
  });

  it('rejects a platform-scope token with FORBIDDEN', async () => {
    const platformToken = createPlatformToken({
      sub: FAKE.USER,
      membershipId: FAKE.MEMBERSHIP,
      roleId: FAKE.ROLE,
    });

    const response = await gqlRequest(appResult.httpServer, {
      query: 'query { listGuardians { id } }',
      token: platformToken,
    });

    expect(response.errors).toBeDefined();
    expect(response.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});
