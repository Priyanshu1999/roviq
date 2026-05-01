/**
 * Proof-of-concept integration tests for the `@roviq/testing/integration`
 * library. These validate the full lib surface end-to-end against a real
 * PostgreSQL database.
 *
 *  1. Scope guard rejection — reseller token on a `@PlatformScope` query
 *  2. Scope guard rejection — institute token on a `@PlatformScope` query
 *  3. Real resolver pipeline — `createTestInstitute` + platform token →
 *     `adminListInstitutes` → cleanup. Proves JWT validation → scope guard →
 *     CASL (platform = manage:all) → `withAdmin()` → Drizzle → RLS → response
 *     serialization all work together.
 *  4. Test data factories — `createTestInstitute` / `cleanupTestInstitute`
 *     leave the DB in a clean state.
 *  5. Reseller factory — `createTestReseller` / `cleanupTestReseller` round-trip.
 *  6. Audit-log polling — manually insert an `audit_logs` row and verify
 *     `waitForAuditLog` discovers it.
 *
 * Run with `pnpm test:int`. Requires `pnpm db:reset --test` to have seeded
 * the five-role DB.
 */

import {
  auditLogs,
  institutes,
  memberships,
  mkAdminCtx,
  resellerMemberships,
  resellers,
  roles,
  withAdmin,
} from '@roviq/database';
import {
  cleanupTestInstitute,
  cleanupTestReseller,
  createInstituteToken,
  createIntegrationApp,
  createPlatformToken,
  createResellerToken,
  createTestInstitute,
  createTestReseller,
  gqlRequest,
  type IntegrationAppResult,
  waitForAuditLog,
} from '@roviq/testing/integration';
import { eq, sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app/app.module';

const ADMIN_LIST_INSTITUTES_QUERY = /* GraphQL */ `
  query AdminListInstitutes($search: String!) {
    adminListInstitutes(filter: { search: $search }) {
      edges {
        node {
          id
          slug
        }
      }
    }
  }
`;

const ADMIN_LIST_USERS_QUERY = /* GraphQL */ `
  query AdminListUsers {
    adminListUsers {
      totalCount
    }
  }
`;

// Random IDs for the rejection tests — the scope guard fires before any DB
// lookup, so these never need to exist.
const FAKE_USER_ID = '00000000-0000-7000-a000-000000000999';
const FAKE_MEMBERSHIP_ID = '00000000-0000-7000-a000-000000000998';
const FAKE_ROLE_ID = '00000000-0000-7000-a000-000000000997';
const FAKE_TENANT_ID = '00000000-0000-7000-a000-000000000996';
const FAKE_RESELLER_ID = '00000000-0000-7000-a000-000000000995';

describe('@roviq/testing/integration — proof-of-concept', () => {
  let result: IntegrationAppResult;

  beforeAll(async () => {
    result = await createIntegrationApp({ modules: [AppModule] });
  });

  afterAll(async () => {
    await result?.close();
  });

  it('rejects a reseller-scoped token on a @PlatformScope query', async () => {
    const token = createResellerToken({
      sub: FAKE_USER_ID,
      resellerId: FAKE_RESELLER_ID,
      membershipId: FAKE_MEMBERSHIP_ID,
      roleId: FAKE_ROLE_ID,
    });

    const response = await gqlRequest(result.httpServer, {
      query: ADMIN_LIST_USERS_QUERY,
      token,
    });

    expect(response.errors).toBeDefined();
    expect(response.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('rejects an institute-scoped token on a @PlatformScope query', async () => {
    const token = createInstituteToken({
      sub: FAKE_USER_ID,
      tenantId: FAKE_TENANT_ID,
      membershipId: FAKE_MEMBERSHIP_ID,
      roleId: FAKE_ROLE_ID,
    });

    const response = await gqlRequest(result.httpServer, {
      query: ADMIN_LIST_USERS_QUERY,
      token,
    });

    expect(response.errors).toBeDefined();
    expect(response.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('runs a real platform query through the full resolver pipeline', async () => {
    // Create a fresh institute so the query has at least one row to return,
    // and so the round-trip exercises withAdmin → Drizzle → RLS → response.
    const tenant = await createTestInstitute(result.db);
    try {
      const token = createPlatformToken({
        sub: FAKE_USER_ID,
        membershipId: FAKE_MEMBERSHIP_ID,
        roleId: FAKE_ROLE_ID,
      });

      // Search matches name/code, not slug — use the slug suffix which is
      // embedded in the test institute's name as "Test Institute <suffix>".
      const suffix = tenant.slug.replace(/^test-/, '');
      const response = await gqlRequest<{
        adminListInstitutes: { edges: Array<{ node: { id: string; slug: string } }> };
      }>(result.httpServer, {
        query: ADMIN_LIST_INSTITUTES_QUERY,
        variables: { search: suffix },
        token,
      });

      expect(response.errors).toBeUndefined();
      const edges = response.data?.adminListInstitutes.edges ?? [];
      expect(edges).toBeInstanceOf(Array);
      const slugs = edges.map((edge: { node: { slug: string } }) => edge.node.slug);
      expect(slugs).toContain(tenant.slug);
    } finally {
      await cleanupTestInstitute(result.db, tenant);
    }
  });

  it('createTestInstitute inserts rows and cleanupTestInstitute removes them', async () => {
    const tenant = await createTestInstitute(result.db);

    // Row visible via withAdmin (RLS bypassed).
    const afterCreate = await withAdmin(result.db, mkAdminCtx(), (tx) =>
      tx.select({ id: institutes.id }).from(institutes).where(eq(institutes.id, tenant.tenantId)),
    );
    expect(afterCreate).toHaveLength(1);

    const membershipRows = await withAdmin(result.db, mkAdminCtx(), (tx) =>
      tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(eq(memberships.id, tenant.membershipId)),
    );
    expect(membershipRows).toHaveLength(1);

    await cleanupTestInstitute(result.db, tenant);

    const afterCleanup = await withAdmin(result.db, mkAdminCtx(), (tx) =>
      tx.select({ id: institutes.id }).from(institutes).where(eq(institutes.id, tenant.tenantId)),
    );
    expect(afterCleanup).toHaveLength(0);

    const membershipAfter = await withAdmin(result.db, mkAdminCtx(), (tx) =>
      tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(eq(memberships.id, tenant.membershipId)),
    );
    expect(membershipAfter).toHaveLength(0);

    const roleAfter = await withAdmin(result.db, mkAdminCtx(), (tx) =>
      tx.select({ id: roles.id }).from(roles).where(eq(roles.id, tenant.roleId)),
    );
    expect(roleAfter).toHaveLength(0);
  });

  it('createTestReseller + cleanupTestReseller round-trip', async () => {
    const reseller = await createTestReseller(result.db);

    const afterCreate = await withAdmin(result.db, mkAdminCtx(), (tx) =>
      tx.select({ id: resellers.id }).from(resellers).where(eq(resellers.id, reseller.resellerId)),
    );
    expect(afterCreate).toHaveLength(1);

    await cleanupTestReseller(result.db, reseller);

    const afterCleanup = await withAdmin(result.db, mkAdminCtx(), (tx) =>
      tx.select({ id: resellers.id }).from(resellers).where(eq(resellers.id, reseller.resellerId)),
    );
    expect(afterCleanup).toHaveLength(0);

    const membershipAfter = await withAdmin(result.db, mkAdminCtx(), (tx) =>
      tx
        .select({ id: resellerMemberships.id })
        .from(resellerMemberships)
        .where(eq(resellerMemberships.id, reseller.membershipId)),
    );
    expect(membershipAfter).toHaveLength(0);
  });

  it('waitForAuditLog discovers a manually-inserted audit row', async () => {
    // audit_logs.user_id / actor_id are FK-constrained to users.id, so we
    // need a real user. Create a disposable tenant for this test.
    const tenant = await createTestInstitute(result.db);
    const action = `test_action_${Date.now()}`;
    const entityId = '00000000-0000-7000-a000-000000000aaa';
    const correlationId = '00000000-0000-7000-a000-000000000bbb';

    // Insert directly via withAdmin so RLS is bypassed.
    await withAdmin(result.db, mkAdminCtx(), (tx) =>
      tx.insert(auditLogs).values({
        scope: 'institute',
        tenantId: tenant.tenantId,
        userId: tenant.userId,
        actorId: tenant.userId,
        action,
        actionType: 'CREATE',
        entityType: 'TestEntity',
        entityId,
        correlationId,
        source: 'test',
      }),
    );

    // waitForAuditLog requires a pg.Pool, not a DrizzleDB. Integration tests
    // that exercise the audit pipeline typically have the pool already;
    // here we open a throwaway pool on the same DATABASE_URL.
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,
    });
    try {
      const rows = await waitForAuditLog(pool, { action, entityId, timeoutMs: 2_000 });
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows[0]?.action).toBe(action);
    } finally {
      await pool.end();
      // Clean up the test audit row, then the disposable tenant.
      await withAdmin(result.db, mkAdminCtx(), (tx) =>
        tx.execute(sql`DELETE FROM audit_logs WHERE action = ${action}`),
      );
      await cleanupTestInstitute(result.db, tenant);
    }
  });
});
