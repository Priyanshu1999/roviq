import assert from 'node:assert';
import type { AuditLogConnection, SectionModel, StandardModel } from '@roviq/graphql/generated';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS } from '../../../scripts/seed-ids';
import { loginAsInstituteAdmin } from './helpers/auth';
import { gql } from './helpers/gql-client';

/** Valid user ID for FK constraints — all audit_logs inserts must reference a real user */
const AUDIT_USER_ID = SEED_IDS.USER_ADMIN;

// Use roviq_pooler (not superuser) — RLS applies to pooler via SET LOCAL ROLE.
//
// Resolution order:
//   1. DATABASE_URL_E2E — required when running against the dockerised e2e
//      stack; postgres in `compose.e2e.yaml` is published on a different port
//      than the dev stack so connections must NOT fall through to DATABASE_URL.
//   2. DATABASE_URL — for tests run against the dev/local stack.
//   3. hardcoded dev fallback for ad-hoc local runs.
const DATABASE_URL =
  process.env.DATABASE_URL_E2E ??
  process.env.DATABASE_URL ??
  'postgresql://roviq_pooler:roviq_pooler_dev@localhost:5435/roviq_test';

/**
 * Execute a query against audit_logs with RLS context set.
 * FORCE ROW LEVEL SECURITY is enabled on audit_logs, so even the table owner
 * must satisfy policies. We use set_config to scope the tenant context.
 */
async function queryWithRls(
  pool: pg.Pool,
  tenantId: string,
  sql: string,
  params: unknown[] = [],
): Promise<pg.QueryResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE roviq_app');
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
    const result = await client.query(sql, params);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Execute a query with admin role, bypassing tenant isolation.
 * Uses SET LOCAL ROLE roviq_admin so all admin policies pass.
 */
async function queryAsPlatformAdmin(
  pool: pg.Pool,
  sql: string,
  params: unknown[] = [],
): Promise<pg.QueryResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE roviq_admin');
    const result = await client.query(sql, params);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Execute a query with reseller role context.
 */
async function queryAsReseller(
  pool: pg.Pool,
  resellerId: string,
  sql: string,
  params: unknown[] = [],
): Promise<pg.QueryResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE roviq_reseller');
    await client.query("SELECT set_config('app.current_reseller_id', $1, true)", [resellerId]);
    const result = await client.query(sql, params);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

describe('Audit E2E', () => {
  let pool: pg.Pool;
  let adminToken: string;
  let adminTenantId: string;

  beforeAll(async () => {
    // Verify API is reachable
    const res = await gql('{ __typename }');
    expect(res.data?.__typename).toBe('Query');

    pool = new pg.Pool({ connectionString: DATABASE_URL, max: 3 });

    const admin = await loginAsInstituteAdmin();
    adminToken = admin.accessToken;
    adminTenantId = admin.tenantId;
  });

  afterAll(async () => {
    await pool.end();
  });

  // ═══════════════════════════════════════════════════
  // Full Pipeline (requires running NATS consumer)
  // ═══════════════════════════════════════════════════

  describe('Full pipeline: mutation → NATS → consumer → DB', () => {
    it('should create audit log entry for createSection mutation', async () => {
      // 1. Find a standard the admin can create a section under. Using the
      //    seeded Institute 1 academic year + its first standard.
      const standardsRes = await gql<{ standards: StandardModel[] }>(
        `query Standards($academicYearId: ID!) {
          standards(academicYearId: $academicYearId) { id name }
        }`,
        { academicYearId: SEED_IDS.ACADEMIC_YEAR_INST1 },
        adminToken,
      );
      expect(standardsRes.errors).toBeUndefined();
      const standardId = standardsRes.data?.standards?.[0]?.id;
      assert(standardId);

      // 2. Call an audited mutation (createSection has no @NoAudit decorator).
      const sectionName = `e2e-audit-${Date.now()}`;
      const createRes = await gql<{ createSection: SectionModel }>(
        `mutation CreateSection($input: CreateSectionInput!) {
          createSection(input: $input) { id name }
        }`,
        {
          input: {
            standardId,
            academicYearId: SEED_IDS.ACADEMIC_YEAR_INST1,
            name: { en: sectionName },
          },
        },
        adminToken,
      );
      expect(createRes.errors).toBeUndefined();
      const sectionId = createRes.data?.createSection?.id;
      assert(sectionId);

      // 3. Poll the audit log for an entry referencing the new section. The
      //    interceptor publishes to NATS asynchronously; the consumer writes
      //    in batches every 500ms or 50 events. Wait up to 10s.
      const deadline = Date.now() + 10_000;
      let matchedEntry: AuditLogConnection['edges'][number]['node'] | undefined;
      while (Date.now() < deadline) {
        const logsRes = await gql<{ entityAuditTimeline: AuditLogConnection }>(
          `query EntityAudit($entityType: String!, $entityId: String!) {
            entityAuditTimeline(entityType: $entityType, entityId: $entityId, first: 5) {
              edges {
                node { action actionType source userId actorId tenantId entityType entityId }
              }
            }
          }`,
          { entityType: 'Section', entityId: sectionId },
          adminToken,
        );
        expect(logsRes.errors).toBeUndefined();
        const edges = logsRes.data?.entityAuditTimeline?.edges;
        const createEntry = edges?.find((e) => e.node.actionType === 'CREATE');
        if (createEntry) {
          matchedEntry = createEntry.node;
          break;
        }
        await new Promise((r) => setTimeout(r, 250));
      }

      assert(matchedEntry, 'audit log entry for createSection not found');
      expect(matchedEntry.action).toBe('createSection');
      expect(matchedEntry.actionType).toBe('CREATE');
      expect(matchedEntry.source).toBe('GATEWAY');
      expect(matchedEntry.entityType).toBe('Section');
      expect(matchedEntry.entityId).toBe(sectionId);
      expect(matchedEntry.userId).toBe(AUDIT_USER_ID);
      expect(matchedEntry.actorId).toBe(AUDIT_USER_ID);
      expect(matchedEntry.tenantId).toBe(adminTenantId);
    });
  });

  // ═══════════════════════════════════════════════════
  // GraphQL Query API
  // ═══════════════════════════════════════════════════

  describe('GraphQL query API', () => {
    let testCorrelationId: string;

    beforeAll(async () => {
      testCorrelationId = crypto.randomUUID();
      await queryWithRls(
        pool,
        adminTenantId,
        `INSERT INTO audit_logs
          (scope, tenant_id, user_id, actor_id, action, action_type, entity_type,
           entity_id, correlation_id, source, metadata)
        VALUES
          ('institute', $1, $3, $3, 'createStudent',
           'CREATE', 'Student', gen_random_uuid(), $2, 'TEST', '{"test": true}')`,
        [adminTenantId, testCorrelationId, AUDIT_USER_ID],
      );
    });

    it('should return audit logs via GraphQL query', async () => {
      const res = await gql<{ auditLogs: AuditLogConnection }>(
        `query AuditLogs($filter: AuditLogFilterInput, $first: Int) {
          auditLogs(filter: $filter, first: $first) {
            totalCount
            edges {
              cursor
              node {
                id action actionType entityType source correlationId metadata createdAt
              }
            }
            pageInfo { hasNextPage hasPreviousPage endCursor startCursor }
          }
        }`,
        { filter: { correlationId: testCorrelationId }, first: 10 },
        adminToken,
      );

      expect(res.errors).toBeUndefined();
      const connection = res.data?.auditLogs;
      assert(connection);
      expect(connection.totalCount).toBeGreaterThanOrEqual(1);

      const node = connection.edges[0].node;
      expect(node.action).toBe('createStudent');
      expect(node.actionType).toBe('CREATE');
      expect(node.entityType).toBe('Student');
      expect(node.source).toBe('TEST');
      expect(node.correlationId).toBe(testCorrelationId);
    });

    it('should filter by entityType', async () => {
      const res = await gql<{ auditLogs: AuditLogConnection }>(
        `query {
          auditLogs(filter: { entityType: "NonExistentEntity" }, first: 10) {
            totalCount
            edges { node { id } }
          }
        }`,
        undefined,
        adminToken,
      );

      expect(res.errors).toBeUndefined();
      expect(res.data?.auditLogs.totalCount).toBe(0);
    });

    it('should filter by actionTypes', async () => {
      const res = await gql<{ auditLogs: AuditLogConnection }>(
        `query AuditLogs($filter: AuditLogFilterInput) {
          auditLogs(filter: $filter, first: 10) {
            edges { node { actionType correlationId } }
          }
        }`,
        { filter: { actionTypes: ['CREATE'], correlationId: testCorrelationId } },
        adminToken,
      );

      expect(res.errors).toBeUndefined();
      const edges = res.data?.auditLogs.edges ?? [];
      expect(edges.length).toBeGreaterThanOrEqual(1);
      expect(edges.every((e) => e.node.actionType === 'CREATE')).toBe(true);
    });

    it('should support cursor-based pagination', async () => {
      for (let i = 0; i < 3; i++) {
        await queryWithRls(
          pool,
          adminTenantId,
          `INSERT INTO audit_logs
            (scope, tenant_id, user_id, actor_id, action, action_type,
             entity_type, correlation_id, source)
          VALUES
            ('institute', $1, $3, $3, $2,
             'CREATE', 'PaginationTest', gen_random_uuid(), 'TEST')`,
          [adminTenantId, `paginationTest${i}`, AUDIT_USER_ID],
        );
      }

      const page1 = await gql<{ auditLogs: AuditLogConnection }>(
        `query {
          auditLogs(filter: { entityType: "PaginationTest" }, first: 2) {
            edges { cursor node { action } }
            pageInfo { hasNextPage endCursor }
          }
        }`,
        undefined,
        adminToken,
      );

      expect(page1.errors).toBeUndefined();
      expect(page1.data?.auditLogs.edges).toHaveLength(2);
      expect(page1.data?.auditLogs.pageInfo.hasNextPage).toBe(true);

      const page2 = await gql<{ auditLogs: AuditLogConnection }>(
        `query AuditLogs($after: String) {
          auditLogs(filter: { entityType: "PaginationTest" }, first: 2, after: $after) {
            edges { node { action } }
            pageInfo { hasNextPage hasPreviousPage }
          }
        }`,
        { after: page1.data?.auditLogs.pageInfo.endCursor },
        adminToken,
      );

      expect(page2.errors).toBeUndefined();
      expect(page2.data?.auditLogs.edges.length).toBeGreaterThanOrEqual(1);
      expect(page2.data?.auditLogs.pageInfo.hasPreviousPage).toBe(true);
    });

    it('should require authentication', async () => {
      const res = await gql(`query { auditLogs(first: 10) { totalCount } }`);
      expect(res.errors).toBeDefined();
      expect(res.errors?.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════
  // RLS Isolation
  // ═══════════════════════════════════════════════════

  describe('RLS isolation', () => {
    it('tenant A cannot see tenant B audit logs', async () => {
      const otherTenantId = SEED_IDS.INSTITUTE_2;
      const correlationId = crypto.randomUUID();

      // Insert as admin (bypasses RLS) into the OTHER tenant
      await queryAsPlatformAdmin(
        pool,
        `INSERT INTO audit_logs
          (scope, tenant_id, user_id, actor_id, action, action_type,
           entity_type, correlation_id, source)
        VALUES ('institute', $1, $3, $3,
                'rlsTest', 'CREATE', 'RlsTest', $2, 'TEST')`,
        [otherTenantId, correlationId, AUDIT_USER_ID],
      );

      // Query via GraphQL with admin's tenant — should NOT see other tenant's row
      const res = await gql<{ auditLogs: AuditLogConnection }>(
        `query AuditLogs($filter: AuditLogFilterInput) {
          auditLogs(filter: $filter, first: 10) {
            totalCount
            edges { node { id } }
          }
        }`,
        { filter: { correlationId } },
        adminToken,
      );

      expect(res.errors).toBeUndefined();
      expect(res.data?.auditLogs.totalCount).toBe(0);
    });

    it('platform admin sees all scopes via roviq_admin role', async () => {
      const correlationId = crypto.randomUUID();

      // Insert rows with different scopes
      await queryAsPlatformAdmin(
        pool,
        `INSERT INTO audit_logs
          (scope, tenant_id, user_id, actor_id, action, action_type,
           entity_type, correlation_id, source)
        VALUES
          ('institute', $1, $3, $3,
           'scopeTest', 'CREATE', 'ScopeTest', $2, 'TEST'),
          ('platform', NULL, $3, $3,
           'scopeTest', 'CREATE', 'ScopeTest', $2, 'TEST')`,
        [adminTenantId, correlationId, AUDIT_USER_ID],
      );

      const result = await queryAsPlatformAdmin(
        pool,
        `SELECT scope FROM audit_logs WHERE correlation_id = $1 ORDER BY scope`,
        [correlationId],
      );

      expect(result.rows).toHaveLength(2);
      expect(result.rows.map((r: { scope: string }) => r.scope).sort()).toEqual([
        'institute',
        'platform',
      ]);
    });

    it('reseller sees their institutes + own reseller entries', async () => {
      const resellerId = SEED_IDS.RESELLER_DIRECT;
      const correlationId = crypto.randomUUID();

      // Insert institute-scoped row (tenant belongs to this reseller)
      await queryAsPlatformAdmin(
        pool,
        `INSERT INTO audit_logs
          (scope, tenant_id, user_id, actor_id, action, action_type,
           entity_type, correlation_id, source)
        VALUES ('institute', $1, $3, $3,
                'resellerTest', 'CREATE', 'ResellerTest', $2, 'TEST')`,
        [SEED_IDS.INSTITUTE_1, correlationId, AUDIT_USER_ID],
      );

      // Insert reseller-scoped row
      await queryAsPlatformAdmin(
        pool,
        `INSERT INTO audit_logs
          (scope, reseller_id, user_id, actor_id, action, action_type,
           entity_type, correlation_id, source)
        VALUES ('reseller', $1, $3, $3,
                'resellerTest', 'CREATE', 'ResellerTest', $2, 'TEST')`,
        [resellerId, correlationId, AUDIT_USER_ID],
      );

      const result = await queryAsReseller(
        pool,
        resellerId,
        `SELECT scope FROM audit_logs WHERE correlation_id = $1 ORDER BY scope`,
        [correlationId],
      );

      expect(result.rows).toHaveLength(2);
      expect(result.rows.map((r: { scope: string }) => r.scope).sort()).toEqual([
        'institute',
        'reseller',
      ]);
    });
  });

  // ═══════════════════════════════════════════════════
  // Immutability
  // ═══════════════════════════════════════════════════

  describe('Immutability', () => {
    it('roviq_app UPDATE on audit_logs is denied by GRANT', async () => {
      await expect(
        queryWithRls(
          pool,
          adminTenantId,
          `UPDATE audit_logs SET action = 'HACKED' WHERE tenant_id = $1`,
          [adminTenantId],
        ),
      ).rejects.toThrow(/permission denied/);
    });

    it('roviq_app DELETE on audit_logs is denied by GRANT', async () => {
      await expect(
        queryWithRls(pool, adminTenantId, `DELETE FROM audit_logs WHERE tenant_id = $1`, [
          adminTenantId,
        ]),
      ).rejects.toThrow(/permission denied/);
    });

    it('roviq_app UPDATE is also denied at GRANT level via raw client', async () => {
      // REVOKE UPDATE was applied in ROV-64 custom migration
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE roviq_app');
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [adminTenantId]);
        await expect(
          client.query(`UPDATE audit_logs SET action = 'HACKED' WHERE tenant_id = $1`, [
            adminTenantId,
          ]),
        ).rejects.toThrow(/permission denied/);
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });
  });

  // ═══════════════════════════════════════════════════
  // CHECK Constraint (scope validation)
  // ═══════════════════════════════════════════════════

  describe('CHECK constraint (chk_audit_scope)', () => {
    it('rejects scope=institute with tenant_id=NULL', async () => {
      await expect(
        queryAsPlatformAdmin(
          pool,
          `INSERT INTO audit_logs
            (scope, tenant_id, user_id, actor_id, action, action_type,
             entity_type, correlation_id, source)
          VALUES ('institute', NULL, $1, $1,
                  'checkTest', 'CREATE', 'CheckTest', gen_random_uuid(), 'TEST')`,
          [AUDIT_USER_ID],
        ),
      ).rejects.toThrow(/chk_audit_scope/);
    });

    it('rejects scope=reseller with reseller_id=NULL', async () => {
      await expect(
        queryAsPlatformAdmin(
          pool,
          `INSERT INTO audit_logs
            (scope, reseller_id, user_id, actor_id, action, action_type,
             entity_type, correlation_id, source)
          VALUES ('reseller', NULL, $1, $1,
                  'checkTest', 'CREATE', 'CheckTest', gen_random_uuid(), 'TEST')`,
          [AUDIT_USER_ID],
        ),
      ).rejects.toThrow(/chk_audit_scope/);
    });

    it('accepts scope=platform with tenant_id=NULL and reseller_id=NULL', async () => {
      const result = await queryAsPlatformAdmin(
        pool,
        `INSERT INTO audit_logs
          (scope, user_id, actor_id, action, action_type, entity_type,
           correlation_id, source)
        VALUES ('platform', $1, $1,
                'checkTest', 'CREATE', 'CheckTest', gen_random_uuid(), 'TEST')
        RETURNING id`,
        [AUDIT_USER_ID],
      );
      expect(result.rows).toHaveLength(1);
    });
  });

  // ═══════════════════════════════════════════════════
  // Idempotency (ON CONFLICT DO NOTHING)
  // ═══════════════════════════════════════════════════

  describe('Idempotency', () => {
    it('duplicate (id, created_at) inserts result in single row', async () => {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const correlationId = crypto.randomUUID();

      const insertSql = `
        INSERT INTO audit_logs
          (id, scope, tenant_id, user_id, actor_id, action, action_type,
           entity_type, correlation_id, source, created_at)
        VALUES ($1, 'institute', $2, $5, $5,
                'idempotencyTest', 'CREATE', 'IdempotencyTest', $3, 'TEST', $4)
        ON CONFLICT (id, created_at) DO NOTHING`;

      // Insert twice with same id + created_at
      await queryWithRls(pool, adminTenantId, insertSql, [
        id,
        adminTenantId,
        correlationId,
        createdAt,
        AUDIT_USER_ID,
      ]);
      await queryWithRls(pool, adminTenantId, insertSql, [
        id,
        adminTenantId,
        correlationId,
        createdAt,
        AUDIT_USER_ID,
      ]);

      const result = await queryWithRls(
        pool,
        adminTenantId,
        `SELECT COUNT(*)::int as cnt FROM audit_logs WHERE id = $1`,
        [id],
      );
      expect(result.rows[0].cnt).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════
  // Impersonation fields
  // ═══════════════════════════════════════════════════

  describe('Impersonation tracking', () => {
    it('stores actor_id ≠ user_id and impersonation session ID', async () => {
      // Use two real seed users for the FK constraints
      const userId = SEED_IDS.USER_TEACHER;
      const actorId = SEED_IDS.USER_ADMIN;
      const impersonatorId = actorId;
      const correlationId = crypto.randomUUID();

      await queryWithRls(
        pool,
        adminTenantId,
        `INSERT INTO audit_logs
          (scope, tenant_id, user_id, actor_id, impersonator_id,
           action, action_type, entity_type,
           correlation_id, source)
        VALUES ('institute', $1, $2, $3, $4,
                'impersonationTest', 'UPDATE', 'ImpersonationTest', $5, 'TEST')`,
        [adminTenantId, userId, actorId, impersonatorId, correlationId],
      );

      const result = await queryWithRls(
        pool,
        adminTenantId,
        `SELECT user_id, actor_id, impersonator_id
         FROM audit_logs WHERE correlation_id = $1`,
        [correlationId],
      );

      expect(result.rows).toHaveLength(1);
      const row = result.rows[0];
      expect(row.user_id).toBe(userId);
      expect(row.actor_id).toBe(actorId);
      expect(row.impersonator_id).toBe(impersonatorId);
      expect(row.actor_id).not.toBe(row.user_id);
    });
  });

  // ═══════════════════════════════════════════════════
  // Correlation
  // ═══════════════════════════════════════════════════

  describe('Correlation', () => {
    it('all entries from one request share correlation_id', async () => {
      const correlationId = crypto.randomUUID();

      // Insert 3 rows with same correlation ID (simulating cascading side effects)
      for (const action of ['createEnrollment', 'createAttendance', 'assignSection']) {
        await queryWithRls(
          pool,
          adminTenantId,
          `INSERT INTO audit_logs
            (scope, tenant_id, user_id, actor_id, action, action_type,
             entity_type, correlation_id, source)
          VALUES ('institute', $1, $4, $4,
                  $2, 'CREATE', 'CorrelationTest', $3, 'TEST')`,
          [adminTenantId, action, correlationId, AUDIT_USER_ID],
        );
      }

      const result = await queryWithRls(
        pool,
        adminTenantId,
        `SELECT action FROM audit_logs WHERE correlation_id = $1 ORDER BY created_at`,
        [correlationId],
      );

      expect(result.rows).toHaveLength(3);
      expect(result.rows.map((r: { action: string }) => r.action)).toEqual([
        'createEnrollment',
        'createAttendance',
        'assignSection',
      ]);
    });
  });

  // ═══════════════════════════════════════════════════
  // @NoAudit opt-out
  // ═══════════════════════════════════════════════════

  describe('@NoAudit opt-out', () => {
    it('unauthenticated mutations produce no audit log', async () => {
      const uniqueUsername = `audit_test_${Date.now()}`;
      await gql(`
        mutation {
          register(input: {
            username: "${uniqueUsername}"
            password: "test1234"
            email: "${uniqueUsername}@test.com"
          }) {
            accessToken
          }
        }
      `);

      // Brief wait for any potential async pipeline
      await new Promise((r) => setTimeout(r, 1500));

      const result = await queryAsPlatformAdmin(
        pool,
        `SELECT id FROM audit_logs WHERE action = 'register' AND metadata->>'input' LIKE $1`,
        [`%${uniqueUsername}%`],
      );

      expect(result.rows).toHaveLength(0);
    });
  });
});
