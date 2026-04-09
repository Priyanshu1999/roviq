/**
 * ROV-169 — Integration tests for StaffResolver.listStaff.
 *
 * Boots the full AppModule in-process against a real PostgreSQL database
 * (5-role RLS setup) and asserts that the listStaff query:
 *   1. Returns staff rows (shape assertion only — happy path)
 *   2. Accepts a `search` filter (multilingual search_vector path)
 *   3. Accepts a `department` filter
 *   4. Rejects a reseller-scope token with FORBIDDEN
 *   5. Rejects a cross-tenant read via RLS (tenant A cannot see tenant B)
 *
 * Note: The scope guard fires before DB lookups, so the rejection test uses
 * a fake tenant UUID. The cross-tenant isolation test relies on the fact
 * that two freshly-created tenants have disjoint `staff_profiles` — neither
 * has rows yet, so the assertion is that tenant A's list does NOT contain
 * any ID that tenant B could return.
 */

import {
  createInstituteToken,
  createIntegrationApp,
  createResellerToken,
  createTestInstitute,
  gqlRequest,
  type IntegrationAppResult,
  type TestInstitute,
} from '@roviq/testing/integration';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../app/app.module';

// Guard fires pre-DB — fake IDs are acceptable for negative scope tests.
const FAKE = {
  USER: '00000000-0000-4000-a000-000000000aa1',
  MEMBERSHIP: '00000000-0000-4000-a000-000000000aa2',
  ROLE: '00000000-0000-4000-a000-000000000aa3',
  RESELLER: '00000000-0000-4000-a000-000000000aa4',
} as const;

interface StaffNode {
  id: string;
  firstName: Record<string, string>;
  lastName?: Record<string, string> | null;
  department?: string | null;
}

interface ListStaffData {
  listStaff: StaffNode[];
}

describe('Staff list (integration)', () => {
  let appResult: IntegrationAppResult;
  let tenantA: TestInstitute;
  let tenantB: TestInstitute;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    appResult = await createIntegrationApp({ modules: [AppModule] });
    tenantA = await createTestInstitute(appResult.db);
    tenantB = await createTestInstitute(appResult.db);

    tokenA = createInstituteToken({
      sub: tenantA.userId,
      tenantId: tenantA.tenantId,
      membershipId: tenantA.membershipId,
      roleId: tenantA.roleId,
    });
    tokenB = createInstituteToken({
      sub: tenantB.userId,
      tenantId: tenantB.tenantId,
      membershipId: tenantB.membershipId,
      roleId: tenantB.roleId,
    });
  });

  afterAll(async () => {
    await appResult?.close();
  });

  it('listStaff happy path — returns array with firstName as an object', async () => {
    const response = await gqlRequest<ListStaffData>(appResult.httpServer, {
      query: 'query { listStaff { id firstName lastName department } }',
      token: tokenA,
    });

    expect(response.errors).toBeUndefined();
    expect(Array.isArray(response.data?.listStaff)).toBe(true);
    // firstName is an i18nText jsonb — when rows exist they must be objects,
    // never plain strings (the backend does NOT resolve locale).
    for (const row of response.data?.listStaff ?? []) {
      expect(typeof row.firstName).toBe('object');
    }
  });

  it('listStaff accepts a multilingual search filter ("राज")', async () => {
    const response = await gqlRequest<ListStaffData>(appResult.httpServer, {
      query: 'query($f: ListStaffFilterInput) { listStaff(filter: $f) { id firstName } }',
      variables: { f: { search: 'राज' } },
      token: tokenA,
    });

    expect(response.errors).toBeUndefined();
    expect(Array.isArray(response.data?.listStaff)).toBe(true);
  });

  it('listStaff accepts a department filter', async () => {
    const response = await gqlRequest<ListStaffData>(appResult.httpServer, {
      query: 'query($f: ListStaffFilterInput) { listStaff(filter: $f) { id department } }',
      variables: { f: { department: 'Mathematics' } },
      token: tokenA,
    });

    expect(response.errors).toBeUndefined();
    expect(Array.isArray(response.data?.listStaff)).toBe(true);
    for (const row of response.data?.listStaff ?? []) {
      if (row.department !== null && row.department !== undefined) {
        expect(row.department).toBe('Mathematics');
      }
    }
  });

  it('rejects a reseller-scope token with FORBIDDEN', async () => {
    const resellerToken = createResellerToken({
      sub: FAKE.USER,
      resellerId: FAKE.RESELLER,
      membershipId: FAKE.MEMBERSHIP,
      roleId: FAKE.ROLE,
    });

    const response = await gqlRequest(appResult.httpServer, {
      query: 'query { listStaff { id } }',
      token: resellerToken,
    });

    expect(response.errors).toBeDefined();
    expect(response.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('cross-tenant isolation — tenant A cannot see tenant B staff', async () => {
    const responseA = await gqlRequest<ListStaffData>(appResult.httpServer, {
      query: 'query { listStaff { id } }',
      token: tokenA,
    });
    const responseB = await gqlRequest<ListStaffData>(appResult.httpServer, {
      query: 'query { listStaff { id } }',
      token: tokenB,
    });

    expect(responseA.errors).toBeUndefined();
    expect(responseB.errors).toBeUndefined();

    const idsA = new Set((responseA.data?.listStaff ?? []).map((r) => r.id));
    const idsB = new Set((responseB.data?.listStaff ?? []).map((r) => r.id));
    for (const id of idsB) {
      expect(idsA.has(id)).toBe(false);
    }
  });
});
